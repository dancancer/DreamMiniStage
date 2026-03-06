/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                   System Prompt Command Handlers                         ║
 * ║                                                                          ║
 * ║  sysprompt/sysname/sysgen 命令，共享 localStorage 单路径与 fail-fast      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import { buildSendReturn, parseBoolean } from "../utils/helpers";
import {
  DEFAULT_SYSTEM_NARRATOR_NAME,
  emitSystemMessage,
  readSystemNarratorNameFromStorage,
  readSystemPromptStateFromStorage,
  writeSystemNarratorNameToStorage,
  writeSystemPromptStateToStorage,
} from "../utils/system-message";

type InvocationMeta = Parameters<CommandHandler>[4];

function resolveCommandText(args: string[], pipe: string): string {
  return (args.join(" ") || pipe || "").trim();
}

function hasExplicitUnnamedArgument(invocationMeta: InvocationMeta): boolean {
  return (invocationMeta?.unnamedArgumentList?.length || 0) > 0;
}

function parseOptionalFlag(
  raw: string | undefined,
  commandName: string,
  fieldName: string,
  defaultValue: boolean,
): boolean {
  if (raw === undefined) {
    return defaultValue;
  }

  const parsed = parseBoolean(raw, undefined);
  if (parsed === undefined) {
    throw new Error(`/${commandName} invalid ${fieldName} value: ${raw || ""}`);
  }
  return parsed;
}

function parseStrictOptionalBoolean(
  raw: string | undefined,
  commandName: string,
  fieldName: string,
): boolean | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const parsed = parseBoolean(raw, undefined);
  if (parsed === undefined) {
    throw new Error(`/${commandName} invalid ${fieldName} value: ${raw || ""}`);
  }
  return parsed;
}

function parseOptionalInteger(
  raw: string | undefined,
  commandName: string,
  fieldName: string,
): number | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error(`/${commandName} invalid ${fieldName} value: ${raw}`);
  }
  return parsed;
}

function trimToSentenceBoundary(text: string): string {
  const normalized = text.trim();
  if (!normalized) {
    return normalized;
  }

  const boundaries = ["。", "！", "？", ".", "!", "?"];
  const lastBoundary = boundaries
    .map((boundary) => normalized.lastIndexOf(boundary))
    .reduce((current, index) => Math.max(current, index), -1);

  return lastBoundary >= 0
    ? normalized.slice(0, lastBoundary + 1).trim()
    : normalized;
}

/** /sysprompt [name] - 读取或切换当前 system prompt 名称 */
export const handleSystemPrompt: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  const forceGet = parseOptionalFlag(namedArgs.forceGet, "sysprompt", "forceGet", false);
  parseOptionalFlag(namedArgs.quiet, "sysprompt", "quiet", false);

  const target = resolveCommandText(args, pipe);
  if (!target) {
    const current = readSystemPromptStateFromStorage();
    return current.enabled || forceGet ? current.name : "";
  }

  const updated = writeSystemPromptStateToStorage({
    enabled: true,
    name: target,
  });
  return updated.name;
};

/** /sysprompt-on - 开启 system prompt */
export const handleSystemPromptOn: CommandHandler = async () => {
  const updated = writeSystemPromptStateToStorage({ enabled: true });
  return String(updated.enabled);
};

/** /sysprompt-off - 关闭 system prompt */
export const handleSystemPromptOff: CommandHandler = async () => {
  const updated = writeSystemPromptStateToStorage({ enabled: false });
  return String(updated.enabled);
};

/** /sysprompt-state|/sysprompt-toggle [state] - 读取或设置启用状态 */
export const handleSystemPromptState: CommandHandler = async (args, _namedArgs, _ctx, _pipe) => {
  if (args.length === 0) {
    return String(readSystemPromptStateFromStorage().enabled);
  }

  const nextState = parseBoolean(args[0], undefined);
  if (nextState === undefined) {
    throw new Error(`/sysprompt-state invalid state value: ${args[0]}`);
  }

  return String(writeSystemPromptStateToStorage({ enabled: nextState }).enabled);
};

/** /sysname [name] - 读取或设置系统旁白显示名 */
export const handleSystemName: CommandHandler = async (
  args,
  _namedArgs,
  _ctx,
  pipe,
  invocationMeta,
) => {
  const target = resolveCommandText(args, pipe);
  if (!target && !hasExplicitUnnamedArgument(invocationMeta)) {
    return readSystemNarratorNameFromStorage() || DEFAULT_SYSTEM_NARRATOR_NAME;
  }

  const updated = writeSystemNarratorNameToStorage(target);
  return updated || DEFAULT_SYSTEM_NARRATOR_NAME;
};

/** /sysgen <prompt> - 生成一条系统消息 */
export const handleSystemGenerate: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.generateQuiet && !ctx.generate) {
    throw new Error("/sysgen is not available in current context");
  }

  const prompt = resolveCommandText(args, pipe);
  if (!prompt) {
    throw new Error("/sysgen requires prompt");
  }

  const trim = parseOptionalFlag(namedArgs.trim, "sysgen", "trim", false);
  const compact = parseStrictOptionalBoolean(namedArgs.compact, "sysgen", "compact");
  const at = parseOptionalInteger(namedArgs.at, "sysgen", "at");
  const configuredName = namedArgs.name?.trim() || readSystemNarratorNameFromStorage();
  const generator = ctx.generateQuiet || ctx.generate;
  const generated = await Promise.resolve(generator!(prompt));

  if (typeof generated !== "string") {
    throw new Error("/sysgen host returned non-string result");
  }

  const output = trim ? trimToSentenceBoundary(generated) : generated;
  await emitSystemMessage(ctx, output, {
    at,
    compact,
    name: configuredName || undefined,
  });

  return buildSendReturn(namedArgs.return, output, pipe, at);
};
