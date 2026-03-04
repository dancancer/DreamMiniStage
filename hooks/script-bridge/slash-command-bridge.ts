/**
 * @input  hooks/script-bridge/iframe-dispatcher-registry, lib/slash-command/registry
 * @output registerSlashCommandDefinition, handleSlashCommandResult, clearIframeSlashCommands
 * @pos    Slash 命令回调桥接层
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command Bridge                              ║
 * ║                                                                           ║
 * ║  单一路径：注册 -> 执行 -> iframe 回调 -> 生命周期清理                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { dispatchToIframe } from "./iframe-dispatcher-registry";
import { registerCommand } from "@/lib/slash-command/registry/index";
import type {
  CommandHandler,
  CommandInvocationMeta,
  ExecutionContext,
  ParsedNamedArgument,
  ParsedUnnamedArgument,
} from "@/lib/slash-command/types";

export interface SlashCommandDefinition {
  name: string;
  callback?: (...args: unknown[]) => unknown | Promise<unknown>;
  hasCallback?: boolean;
  iframeId?: string;
  aliases?: string[];
  namedArgumentList?: SlashNamedArgumentDefinition[];
  unnamedArgumentList?: SlashUnnamedArgumentDefinition[];
  helpString?: string;
  rawQuotes?: boolean;
}

interface SlashNamedArgumentDefinition {
  name: string;
  description?: string;
  isRequired?: boolean;
  acceptsMultiple?: boolean;
  defaultValue?: string;
}

interface SlashUnnamedArgumentDefinition {
  description?: string;
  isRequired?: boolean;
  acceptsMultiple?: boolean;
  defaultValue?: string;
}

interface SlashNamedArgumentAssignment {
  name: string;
  value: string;
  rawValue: string;
  wasQuoted: boolean;
  description?: string;
  isRequired: boolean;
  acceptsMultiple: boolean;
  isDefaultValue: boolean;
}

interface SlashUnnamedArgumentAssignment {
  value: string;
  rawValue: string;
  wasQuoted: boolean;
  description?: string;
  isRequired: boolean;
  acceptsMultiple: boolean;
  isDefaultValue: boolean;
}

type RuntimeNamedArgs = Record<string, string | string[]>;

interface NormalizedSlashArguments {
  slashArgs: string;
  namedArgs: RuntimeNamedArgs;
  unnamedArgs: string[];
  namedArgumentList: SlashNamedArgumentAssignment[];
  unnamedArgumentList: SlashUnnamedArgumentAssignment[];
}

interface PendingSlashCommandCall {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  iframeId: string;
}

const CALLBACK_TIMEOUT_MS = 30000;
const customSlashCommands = new Map<string, { iframeId: string }>();
const pendingSlashCommandCalls = new Map<string, PendingSlashCommandCall>();

function generateSlashCallbackId(): string {
  return `scc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function invokeIframeSlashCommandCallback(
  iframeId: string,
  name: string,
  args: string,
  unnamedArgs: string[],
  namedArgs: RuntimeNamedArgs,
  namedArgumentList: SlashNamedArgumentAssignment[],
  unnamedArgumentList: SlashUnnamedArgumentAssignment[],
  pipe: string,
): Promise<unknown> {
  const callbackId = generateSlashCallbackId();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingSlashCommandCalls.delete(callbackId);
      reject(new Error(`Slash command callback timeout: /${name}`));
    }, CALLBACK_TIMEOUT_MS);

    pendingSlashCommandCalls.set(callbackId, {
      resolve,
      reject,
      timeout: timeoutId,
      iframeId,
    });

    dispatchToIframe(iframeId, "SLASH_COMMAND_CALL", {
      name,
      args,
      unnamedArgs,
      namedArgs,
      namedArgumentList,
      unnamedArgumentList,
      pipe,
      callbackId,
    });
  });
}

function normalizeSlashCommandArguments(
  definition: SlashCommandDefinition,
  cmdArgs: string[],
  namedArgs: Record<string, string>,
  invocationMeta?: CommandInvocationMeta,
): NormalizedSlashArguments {
  const commandName = definition.name;
  const parseMeta = ensureInvocationMeta(cmdArgs, namedArgs, invocationMeta);
  const namedDefinitions = definition.namedArgumentList ?? [];
  const unnamedDefinitions = definition.unnamedArgumentList ?? [];

  const namedDefinitionMap = new Map<string, SlashNamedArgumentDefinition>();
  for (const namedDefinition of namedDefinitions) {
    if (namedDefinition?.name) {
      namedDefinitionMap.set(namedDefinition.name, namedDefinition);
    }
  }

  if (namedDefinitionMap.size > 0) {
    const unknownNamedArgs = uniqueValues(
      parseMeta.namedArgumentList
        .filter((arg) => {
          if (namedDefinitionMap.has(arg.name)) {
            return false;
          }
          return !isRawQuotesOverrideArgument(arg.name, definition);
        })
        .map((arg) => arg.name),
    );
    if (unknownNamedArgs.length > 0) {
      throw new Error(`/${commandName} got unsupported named argument(s): ${unknownNamedArgs.join(", ")}`);
    }
  }

  const rawQuotesEnabled = resolveRawQuotesEnabled(definition, parseMeta.namedArgumentList);
  const normalizedNamedArgumentList: SlashNamedArgumentAssignment[] = [];
  const namedAssignmentsByName = new Map<string, SlashNamedArgumentAssignment[]>();

  for (const parsedNamed of parseMeta.namedArgumentList) {
    const namedDefinition = namedDefinitionMap.get(parsedNamed.name);
    const normalized = buildNamedAssignment(parsedNamed, namedDefinition, false);
    normalizedNamedArgumentList.push(normalized);
    appendNamedAssignment(namedAssignmentsByName, normalized.name, normalized);
  }

  for (const namedDefinition of namedDefinitions) {
    if (!namedDefinition?.name) {
      continue;
    }
    const assigned = namedAssignmentsByName.get(namedDefinition.name);
    if (assigned && assigned.length > 0) {
      continue;
    }
    if (namedDefinition.defaultValue === undefined) {
      continue;
    }

    const normalizedDefault = buildNamedDefaultAssignment(namedDefinition);
    normalizedNamedArgumentList.push(normalizedDefault);
    appendNamedAssignment(namedAssignmentsByName, namedDefinition.name, normalizedDefault);
  }

  const missingRequiredNamedArgs = namedDefinitions
    .filter((namedDefinition) => namedDefinition?.isRequired)
    .map((namedDefinition) => namedDefinition.name)
    .filter((name) => {
      const assigned = namedAssignmentsByName.get(name);
      return !assigned || assigned.length === 0;
    });
  if (missingRequiredNamedArgs.length > 0) {
    throw new Error(`/${commandName} missing required named argument(s): ${missingRequiredNamedArgs.join(", ")}`);
  }

  const normalizedNamedArgs: RuntimeNamedArgs = {};
  for (const [name, assignments] of namedAssignmentsByName.entries()) {
    const namedDefinition = namedDefinitionMap.get(name);
    if (namedDefinition?.acceptsMultiple) {
      normalizedNamedArgs[name] = assignments.map((assignment) => assignment.value);
      continue;
    }
    normalizedNamedArgs[name] = assignments[assignments.length - 1]?.value ?? "";
  }

  const normalizedUnnamedArgumentList: SlashUnnamedArgumentAssignment[] = [];
  const lastUnnamedDefinition = unnamedDefinitions[unnamedDefinitions.length - 1];
  const acceptsExtraUnnamedArgs = Boolean(lastUnnamedDefinition?.acceptsMultiple);

  if (unnamedDefinitions.length > 0 && !acceptsExtraUnnamedArgs && parseMeta.unnamedArgumentList.length > unnamedDefinitions.length) {
    throw new Error(
      `/${commandName} got too many unnamed arguments: expected <= ${unnamedDefinitions.length}, got ${parseMeta.unnamedArgumentList.length}`,
    );
  }

  for (let index = 0; index < parseMeta.unnamedArgumentList.length; index++) {
    const parsedUnnamed = parseMeta.unnamedArgumentList[index];
    const unnamedDefinition = unnamedDefinitions[index] ?? (acceptsExtraUnnamedArgs ? lastUnnamedDefinition : undefined);
    normalizedUnnamedArgumentList.push(buildUnnamedAssignment(parsedUnnamed, unnamedDefinition, false, rawQuotesEnabled));
  }

  for (let index = parseMeta.unnamedArgumentList.length; index < unnamedDefinitions.length; index++) {
    const unnamedDefinition = unnamedDefinitions[index];
    if (unnamedDefinition?.defaultValue === undefined) {
      continue;
    }
    normalizedUnnamedArgumentList.push(buildUnnamedDefaultAssignment(unnamedDefinition));
  }

  const missingRequiredUnnamedArgs = unnamedDefinitions
    .map((unnamedDefinition, index) => ({ unnamedDefinition, index }))
    .filter(({ unnamedDefinition, index }) => {
      if (!unnamedDefinition?.isRequired) {
        return false;
      }
      const wasProvided = index < parseMeta.unnamedArgumentList.length;
      const hasDefault = unnamedDefinition.defaultValue !== undefined;
      return !wasProvided && !hasDefault;
    })
    .map(({ index }) => `#${index + 1}`);
  if (missingRequiredUnnamedArgs.length > 0) {
    throw new Error(`/${commandName} missing required unnamed argument(s): ${missingRequiredUnnamedArgs.join(", ")}`);
  }

  const normalizedUnnamedArgs = normalizedUnnamedArgumentList.map((assignment) => assignment.value);
  return {
    slashArgs: normalizedUnnamedArgs.join(" "),
    namedArgs: normalizedNamedArgs,
    unnamedArgs: normalizedUnnamedArgs,
    namedArgumentList: normalizedNamedArgumentList,
    unnamedArgumentList: normalizedUnnamedArgumentList,
  };
}

function ensureInvocationMeta(
  cmdArgs: string[],
  namedArgs: Record<string, string>,
  invocationMeta?: CommandInvocationMeta,
): CommandInvocationMeta {
  if (invocationMeta) {
    return invocationMeta;
  }

  return {
    raw: cmdArgs.join(" "),
    namedArgumentList: Object.entries(namedArgs).map(([name, value]) => ({
      name,
      value,
      rawValue: value,
      wasQuoted: false,
    })),
    unnamedArgumentList: cmdArgs.map((value) => ({
      value,
      rawValue: value,
      wasQuoted: false,
    })),
  };
}

function appendNamedAssignment(
  target: Map<string, SlashNamedArgumentAssignment[]>,
  name: string,
  assignment: SlashNamedArgumentAssignment,
): void {
  const current = target.get(name);
  if (current) {
    current.push(assignment);
    return;
  }
  target.set(name, [assignment]);
}

function buildNamedAssignment(
  parsed: ParsedNamedArgument,
  definition: SlashNamedArgumentDefinition | undefined,
  isDefaultValue: boolean,
): SlashNamedArgumentAssignment {
  const canonicalName = definition?.name ?? parsed.name;
  return {
    name: canonicalName,
    value: parsed.value,
    rawValue: parsed.rawValue,
    wasQuoted: parsed.wasQuoted,
    description: definition?.description,
    isRequired: Boolean(definition?.isRequired),
    acceptsMultiple: Boolean(definition?.acceptsMultiple),
    isDefaultValue,
  };
}

function buildNamedDefaultAssignment(
  definition: SlashNamedArgumentDefinition,
): SlashNamedArgumentAssignment {
  const defaultValue = definition.defaultValue ?? "";
  return {
    name: definition.name,
    value: defaultValue,
    rawValue: defaultValue,
    wasQuoted: false,
    description: definition.description,
    isRequired: Boolean(definition.isRequired),
    acceptsMultiple: Boolean(definition.acceptsMultiple),
    isDefaultValue: true,
  };
}

function buildUnnamedAssignment(
  parsed: ParsedUnnamedArgument,
  definition: SlashUnnamedArgumentDefinition | undefined,
  isDefaultValue: boolean,
  rawQuotesEnabled: boolean,
): SlashUnnamedArgumentAssignment {
  const resolvedValue = rawQuotesEnabled && parsed.wasQuoted ? parsed.rawValue : parsed.value;
  return {
    value: resolvedValue,
    rawValue: parsed.rawValue,
    wasQuoted: parsed.wasQuoted,
    description: definition?.description,
    isRequired: Boolean(definition?.isRequired),
    acceptsMultiple: Boolean(definition?.acceptsMultiple),
    isDefaultValue,
  };
}

function buildUnnamedDefaultAssignment(
  definition: SlashUnnamedArgumentDefinition,
): SlashUnnamedArgumentAssignment {
  const defaultValue = definition.defaultValue ?? "";
  return {
    value: defaultValue,
    rawValue: defaultValue,
    wasQuoted: false,
    description: definition.description,
    isRequired: Boolean(definition.isRequired),
    acceptsMultiple: Boolean(definition.acceptsMultiple),
    isDefaultValue: true,
  };
}

function resolveRawQuotesEnabled(
  definition: SlashCommandDefinition,
  namedArgumentList: ParsedNamedArgument[],
): boolean {
  if (!definition.rawQuotes) {
    return false;
  }
  const rawArgument = findLastNamedArgumentValue(namedArgumentList, "raw");
  if (rawArgument === undefined) {
    return true;
  }
  return !isFalseBooleanLiteral(rawArgument);
}

function findLastNamedArgumentValue(
  namedArgumentList: ParsedNamedArgument[],
  targetName: string,
): string | undefined {
  for (let index = namedArgumentList.length - 1; index >= 0; index--) {
    const current = namedArgumentList[index];
    if (current.name === targetName) {
      return current.value;
    }
  }
  return undefined;
}

function isFalseBooleanLiteral(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "off" || normalized === "false" || normalized === "0";
}

function isRawQuotesOverrideArgument(name: string, definition: SlashCommandDefinition): boolean {
  return definition.rawQuotes === true && name === "raw";
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function handleSlashCommandResult(callbackId: string, result: unknown, error?: string): void {
  const pending = pendingSlashCommandCalls.get(callbackId);
  if (!pending) {
    console.warn("[handleSlashCommandResult] Unknown callbackId:", callbackId);
    return;
  }

  clearTimeout(pending.timeout);
  pendingSlashCommandCalls.delete(callbackId);

  if (error) {
    pending.reject(new Error(error));
    return;
  }

  pending.resolve(result);
}

export function clearIframeSlashCommands(iframeId: string): void {
  for (const [name, info] of customSlashCommands.entries()) {
    if (info.iframeId === iframeId) {
      customSlashCommands.delete(name);
      // 注意：当前 registry 不支持 unregister，命令会保留但标记为已清理
    }
  }

  for (const [callbackId, pending] of pendingSlashCommandCalls.entries()) {
    if (pending.iframeId !== iframeId) {
      continue;
    }
    clearTimeout(pending.timeout);
    pending.reject(new Error(`Slash command callback cancelled: iframe disposed (${iframeId})`));
    pendingSlashCommandCalls.delete(callbackId);
  }
}

export function registerSlashCommandDefinition(
  definition: SlashCommandDefinition | undefined,
  ctxIframeId?: string,
): boolean {
  if (!definition || !definition.name) {
    console.warn("[registerSlashCommand] Invalid definition:", definition);
    return false;
  }

  const { name, callback, aliases, hasCallback } = definition;
  const sourceIframeId = definition.iframeId || ctxIframeId || "unknown";
  const hasLocalCallback = typeof callback === "function";
  const shouldBridgeToIframe = hasCallback === true;

  if (!hasLocalCallback && !shouldBridgeToIframe) {
    console.warn(`[registerSlashCommand] Missing callback for /${name}`);
    return false;
  }

  if (shouldBridgeToIframe && sourceIframeId === "unknown") {
    console.warn(`[registerSlashCommand] Missing iframeId for bridged command /${name}`);
    return false;
  }

  const handler: CommandHandler = async (
    cmdArgs: string[],
    namedArgs: Record<string, string>,
    execCtx: ExecutionContext,
    pipe: string,
    invocationMeta?: CommandInvocationMeta,
  ): Promise<string> => {
    const normalized = normalizeSlashCommandArguments(definition, cmdArgs, namedArgs, invocationMeta);
    const runtimeContext = {
      ...execCtx,
      pipe,
      namedArgumentList: normalized.namedArgumentList,
      unnamedArgumentList: normalized.unnamedArgumentList,
    };

    const result = hasLocalCallback
      ? await callback!(normalized.slashArgs, normalized.namedArgs, runtimeContext)
      : await invokeIframeSlashCommandCallback(
        sourceIframeId,
        name,
        normalized.slashArgs,
        normalized.unnamedArgs,
        normalized.namedArgs,
        normalized.namedArgumentList,
        normalized.unnamedArgumentList,
        pipe,
      );

    return result !== undefined ? String(result) : pipe;
  };

  registerCommand(name, handler);
  customSlashCommands.set(name, {
    iframeId: sourceIframeId,
  });

  if (aliases && Array.isArray(aliases)) {
    for (const alias of aliases) {
      registerCommand(alias, handler);
      customSlashCommands.set(alias, {
        iframeId: sourceIframeId,
      });
    }
  }

  console.log("[registerSlashCommand] Registered:", name, aliases ? `(aliases: ${aliases.join(", ")})` : "");
  return true;
}
