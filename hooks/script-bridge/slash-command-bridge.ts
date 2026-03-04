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
import type { CommandHandler, ExecutionContext } from "@/lib/slash-command/types";

export interface SlashCommandDefinition {
  name: string;
  callback?: (...args: unknown[]) => unknown | Promise<unknown>;
  hasCallback?: boolean;
  iframeId?: string;
  aliases?: string[];
  namedArgumentList?: SlashNamedArgumentDefinition[];
  unnamedArgumentList?: SlashUnnamedArgumentDefinition[];
  helpString?: string;
}

interface SlashNamedArgumentDefinition {
  name: string;
  description?: string;
  isRequired?: boolean;
  acceptsMultiple?: boolean;
}

interface SlashUnnamedArgumentDefinition {
  description?: string;
  isRequired?: boolean;
  acceptsMultiple?: boolean;
}

interface SlashNamedArgumentAssignment {
  name: string;
  value: string;
  description?: string;
  isRequired: boolean;
}

interface SlashUnnamedArgumentAssignment {
  value: string;
  description?: string;
  isRequired: boolean;
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
  namedArgs: Record<string, string>,
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

function assertSlashCommandArguments(
  definition: SlashCommandDefinition,
  cmdArgs: string[],
  namedArgs: Record<string, string>,
): void {
  const commandName = definition.name;
  const namedDefinitions = definition.namedArgumentList ?? [];
  const namedDefinitionMap = new Map<string, SlashNamedArgumentDefinition>();
  for (const namedDef of namedDefinitions) {
    if (namedDef?.name) {
      namedDefinitionMap.set(namedDef.name, namedDef);
    }
  }

  if (namedDefinitionMap.size > 0) {
    const unknownNamedArgs = Object.keys(namedArgs).filter((key) => !namedDefinitionMap.has(key));
    if (unknownNamedArgs.length > 0) {
      throw new Error(`/${commandName} got unsupported named argument(s): ${unknownNamedArgs.join(", ")}`);
    }

    const missingRequiredNamedArgs = namedDefinitions
      .filter((namedDef) => namedDef?.isRequired)
      .map((namedDef) => namedDef.name)
      .filter((namedName) => namedArgs[namedName] === undefined);

    if (missingRequiredNamedArgs.length > 0) {
      throw new Error(`/${commandName} missing required named argument(s): ${missingRequiredNamedArgs.join(", ")}`);
    }
  }

  const unnamedDefinitions = definition.unnamedArgumentList ?? [];
  if (unnamedDefinitions.length === 0) {
    return;
  }

  const missingRequiredUnnamedArgs = unnamedDefinitions
    .map((unnamedDef, index) => ({ unnamedDef, index }))
    .filter(({ unnamedDef, index }) => unnamedDef?.isRequired && cmdArgs[index] === undefined)
    .map(({ index }) => `#${index + 1}`);

  if (missingRequiredUnnamedArgs.length > 0) {
    throw new Error(`/${commandName} missing required unnamed argument(s): ${missingRequiredUnnamedArgs.join(", ")}`);
  }

  const lastUnnamedDefinition = unnamedDefinitions[unnamedDefinitions.length - 1];
  const acceptsExtraUnnamedArgs = Boolean(lastUnnamedDefinition?.acceptsMultiple);
  if (!acceptsExtraUnnamedArgs && cmdArgs.length > unnamedDefinitions.length) {
    throw new Error(
      `/${commandName} got too many unnamed arguments: expected <= ${unnamedDefinitions.length}, got ${cmdArgs.length}`,
    );
  }
}

function buildNamedArgumentAssignments(
  definition: SlashCommandDefinition,
  namedArgs: Record<string, string>,
): SlashNamedArgumentAssignment[] {
  const namedDefinitionMap = new Map<string, SlashNamedArgumentDefinition>();
  for (const namedDef of definition.namedArgumentList ?? []) {
    if (namedDef?.name) {
      namedDefinitionMap.set(namedDef.name, namedDef);
    }
  }

  return Object.entries(namedArgs).map(([name, value]) => {
    const namedDef = namedDefinitionMap.get(name);
    return {
      name,
      value,
      description: namedDef?.description,
      isRequired: Boolean(namedDef?.isRequired),
    };
  });
}

function buildUnnamedArgumentAssignments(
  definition: SlashCommandDefinition,
  cmdArgs: string[],
): SlashUnnamedArgumentAssignment[] {
  return cmdArgs.map((value, index) => {
    const unnamedDef = definition.unnamedArgumentList?.[index];
    return {
      value,
      description: unnamedDef?.description,
      isRequired: Boolean(unnamedDef?.isRequired),
    };
  });
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
  ): Promise<string> => {
    assertSlashCommandArguments(definition, cmdArgs, namedArgs);

    const slashArgs = cmdArgs.join(" ");
    const namedArgumentList = buildNamedArgumentAssignments(definition, namedArgs);
    const unnamedArgumentList = buildUnnamedArgumentAssignments(definition, cmdArgs);
    const runtimeContext = {
      ...execCtx,
      pipe,
      namedArgumentList,
      unnamedArgumentList,
    };

    const result = hasLocalCallback
      ? await callback!(slashArgs, namedArgs, runtimeContext)
      : await invokeIframeSlashCommandCallback(
        sourceIframeId,
        name,
        slashArgs,
        cmdArgs,
        namedArgs,
        namedArgumentList,
        unnamedArgumentList,
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
