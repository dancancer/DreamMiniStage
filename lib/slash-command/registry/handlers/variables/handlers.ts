/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  Variable Command Handlers                                ║
 * ║                                                                           ║
 * ║  变量命令 - setvar / getvar / delvar / listvar / incvar / push 等         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../../types";
import type { VariableScope } from "@/lib/slash-command/types";
import {
  scopedGet,
  scopedSet,
  scopedDelete,
  addToScopedVariable,
  setIndexedScopedVariable,
  getIndexedScopedVariable,
  addToIndexedScopedVariable,
  stringifyVariable,
  normalizeReadValue,
} from "./scoped-ops";

/* ═══════════════════════════════════════════════════════════════════════════
   参数解析工具
   ═══════════════════════════════════════════════════════════════════════════ */

function resolveVariableKey(args: string[], namedArgs: Record<string, string>): string | undefined {
  return namedArgs.key ?? args[0];
}

function resolveVariableValue(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
): string | undefined {
  if (namedArgs.value !== undefined) {
    return namedArgs.value;
  }

  if (namedArgs.key !== undefined) {
    if (args.length > 0) {
      return args.join(" ");
    }
    return pipe || undefined;
  }

  if (args.length >= 2) {
    return args.slice(1).join(" ");
  }

  return pipe || undefined;
}

function resolveVariableIndex(namedArgs: Record<string, string>): string | undefined {
  return namedArgs.index;
}

function normalizeAssignmentNamedArgs(
  namedArgs: Record<string, string>,
  args: string[],
  pipe: string,
): Record<string, string> {
  if (args.length > 0) {
    return namedArgs;
  }

  const entries = Object.entries(namedArgs);
  if (entries.length !== 1) {
    return namedArgs;
  }

  const [[key, value]] = entries;
  if (key === "key" && pipe) {
    return namedArgs;
  }

  if (["value", "index", "as"].includes(key)) {
    return namedArgs;
  }

  return { key, value };
}

function assertSupportedNamedArgs(
  namedArgs: Record<string, string>,
  allowedKeys: string[],
  commandName: string,
): void {
  const allowed = new Set(allowedKeys);
  const unsupported = Object.keys(namedArgs).find((key) => !allowed.has(key));
  if (unsupported) {
    throw new Error(`/${commandName} does not support named argument '${unsupported}'`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   变量读写辅助
   ═══════════════════════════════════════════════════════════════════════════ */

function handleScopedSet(
  args: string[],
  namedArgs: Record<string, string>,
  ctx: Parameters<CommandHandler>[2],
  pipe: string,
  scope: VariableScope,
  commandName: string,
): string {
  const resolvedNamedArgs = normalizeAssignmentNamedArgs(namedArgs, args, pipe);
  assertSupportedNamedArgs(resolvedNamedArgs, ["key", "value", "index", "as"], commandName);

  const key = resolveVariableKey(args, resolvedNamedArgs);
  if (!key) return pipe;

  const value = resolveVariableValue(args, resolvedNamedArgs, pipe);
  if (value === undefined) return pipe;

  const index = resolveVariableIndex(resolvedNamedArgs);
  if (index !== undefined) {
    setIndexedScopedVariable(ctx, scope, key, index, value, resolvedNamedArgs.as);
    return String(value);
  }

  scopedSet(ctx, scope, key, value);
  return String(value);
}

function handleScopedGet(
  args: string[],
  namedArgs: Record<string, string>,
  ctx: Parameters<CommandHandler>[2],
  pipe: string,
  scope: VariableScope,
  commandName: string,
): string {
  assertSupportedNamedArgs(namedArgs, ["key", "index"], commandName);

  const key = resolveVariableKey(args, namedArgs);
  if (!key) return pipe;

  const index = resolveVariableIndex(namedArgs);
  const value = index === undefined
    ? scopedGet(ctx, scope, key)
    : getIndexedScopedVariable(ctx, scope, key, index);
  return normalizeReadValue(value);
}

function handleScopedAdd(
  args: string[],
  namedArgs: Record<string, string>,
  ctx: Parameters<CommandHandler>[2],
  pipe: string,
  scope: VariableScope,
  commandName: string,
): string {
  assertSupportedNamedArgs(namedArgs, ["key", "value", "index", "as"], commandName);

  const key = resolveVariableKey(args, namedArgs);
  if (!key) return pipe;

  const value = resolveVariableValue(args, namedArgs, pipe);
  if (value === undefined) return pipe;

  const index = resolveVariableIndex(namedArgs);
  if (index !== undefined) {
    const next = addToIndexedScopedVariable(ctx, scope, key, index, value, namedArgs.as);
    return normalizeReadValue(next);
  }

  const next = addToScopedVariable(ctx, scope, key, value);
  return stringifyVariable(next);
}

/* ═══════════════════════════════════════════════════════════════════════════
   基础变量操作
   ═══════════════════════════════════════════════════════════════════════════ */

/** /setvar key=value 或 /setvar key value - 设置变量 */
export const handleSetVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  return handleScopedSet(args, namedArgs, ctx, pipe, "local", "setvar");
};

/** /getvar key - 获取变量 */
export const handleGetVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  return handleScopedGet(args, namedArgs, ctx, pipe, "local", "getvar");
};

/** /delvar key - 删除变量 */
export const handleDelVar: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  ctx.deleteVariable(args[0]);
  return pipe;
};

/** /listvar - 列出所有变量 */
export const handleListVar: CommandHandler = async (_args, _namedArgs, ctx, pipe) => {
  if (!ctx.listVariables) return pipe;
  const vars = ctx.listVariables();
  return JSON.stringify(vars);
};

/** /flushvar - 清空所有变量 */
export const handleFlushVar: CommandHandler = async (_args, _namedArgs, ctx, pipe) => {
  if (!ctx.flushVariables) return pipe;
  ctx.flushVariables();
  return pipe;
};

/** /dumpvar - 导出所有变量为 JSON */
export const handleDumpVar: CommandHandler = async (_args, _namedArgs, ctx, pipe) => {
  if (!ctx.dumpVariables) return pipe;
  const dump = ctx.dumpVariables();
  return JSON.stringify(dump, null, 2);
};

/** /setglobalvar key value - 设置全局变量 */
export const handleSetGlobalVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  return handleScopedSet(args, namedArgs, ctx, pipe, "global", "setglobalvar");
};

/** /getglobalvar key - 获取全局变量 */
export const handleGetGlobalVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  return handleScopedGet(args, namedArgs, ctx, pipe, "global", "getglobalvar");
};

/** /flushglobalvar key - 删除全局变量 */
export const handleFlushGlobalVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const key = resolveVariableKey(args, namedArgs);
  if (!key) return pipe;

  scopedDelete(ctx, "global", key);
  return pipe;
};

/* ═══════════════════════════════════════════════════════════════════════════
   数值变量操作
   ═══════════════════════════════════════════════════════════════════════════ */

/** /addvar key value - 追加或累加本地变量 */
export const handleAddVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  return handleScopedAdd(args, namedArgs, ctx, pipe, "local", "addvar");
};

/** /addglobalvar key value - 追加或累加全局变量 */
export const handleAddGlobalVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  return handleScopedAdd(args, namedArgs, ctx, pipe, "global", "addglobalvar");
};

/** /incvar key [amount] - 增加数值变量 */
export const handleIncVar: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  const key = args[0];
  const rawAmount = args.length > 1 ? parseFloat(args[1]) : 1;
  const amount = Number.isFinite(rawAmount) ? rawAmount : 1;
  const current = ctx.getVariable(key);
  const parsed = typeof current === "number" ? current : parseFloat(String(current));
  const base = Number.isFinite(parsed) ? parsed : 0;
  const newValue = base + amount;
  ctx.setVariable(key, newValue);
  return String(newValue);
};

/** /decvar key [amount] - 减少数值变量 */
export const handleDecVar: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  const key = args[0];
  const rawAmount = args.length > 1 ? parseFloat(args[1]) : 1;
  const amount = Number.isFinite(rawAmount) ? rawAmount : 1;
  const current = ctx.getVariable(key);
  const parsed = typeof current === "number" ? current : parseFloat(String(current));
  const base = Number.isFinite(parsed) ? parsed : 0;
  const newValue = base - amount;
  ctx.setVariable(key, newValue);
  return String(newValue);
};

/** /incglobalvar key - 增加全局变量 */
export const handleIncGlobalVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const key = resolveVariableKey(args, namedArgs);
  if (!key) return pipe;

  const next = addToScopedVariable(ctx, "global", key, "1");
  return stringifyVariable(next);
};

/** /decglobalvar key - 减少全局变量 */
export const handleDecGlobalVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const key = resolveVariableKey(args, namedArgs);
  if (!key) return pipe;

  const next = addToScopedVariable(ctx, "global", key, "-1");
  return stringifyVariable(next);
};

/* ═══════════════════════════════════════════════════════════════════════════
   数组变量操作
   ═══════════════════════════════════════════════════════════════════════════ */

/** /push key value? - 将值压入变量数组，默认用 pipe 作为值 */
export const handlePush: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  const [key, ...rest] = args;
  const values = rest.length > 0 ? rest : pipe ? [pipe] : [];
  if (values.length === 0) return pipe;

  const current = ctx.getVariable(key);
  const base = Array.isArray(current) ? [...current] : [];
  base.push(...values);
  ctx.setVariable(key, base);
  return JSON.stringify(base);
};
