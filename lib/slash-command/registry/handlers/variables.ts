/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  Variable Command Handlers                                ║
 * ║                                                                           ║
 * ║  变量命令 - setvar / getvar / delvar / listvar 等                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import type { ExecutionContext, VariableScope } from "@/lib/slash-command/types";

/* ═══════════════════════════════════════════════════════════════════════════
   基础变量操作
   ═══════════════════════════════════════════════════════════════════════════ */

/** /setvar key=value 或 /setvar key value - 设置变量 */
export const handleSetVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  // 优先使用命名参数
  if (Object.keys(namedArgs).length > 0) {
    for (const [key, value] of Object.entries(namedArgs)) {
      ctx.setVariable(key, value);
    }
    return pipe;
  }

  // 位置参数: /setvar key value
  if (args.length >= 2) {
    const [key, ...rest] = args;
    const value = rest.join(" ");
    ctx.setVariable(key, value);
    return value;
  }

  // 单参数带等号: /setvar key=value
  if (args.length === 1 && args[0].includes("=")) {
    const eqIndex = args[0].indexOf("=");
    const key = args[0].slice(0, eqIndex);
    const value = args[0].slice(eqIndex + 1);
    ctx.setVariable(key, value);
    return value;
  }

  // 使用 pipe 作为值
  if (args.length === 1 && pipe) {
    ctx.setVariable(args[0], pipe);
    return pipe;
  }

  return pipe;
};

/** /getvar key - 获取变量 */
export const handleGetVar: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  const value = ctx.getVariable(args[0]);
  return value !== undefined ? String(value) : "";
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
  const key = resolveVariableKey(args, namedArgs);
  if (!key) return pipe;

  const value = resolveVariableValue(args, namedArgs, pipe);
  if (value === undefined) return pipe;

  scopedSet(ctx, "global", key, value);
  return String(value);
};

/** /getglobalvar key - 获取全局变量 */
export const handleGetGlobalVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const key = resolveVariableKey(args, namedArgs);
  if (!key) return pipe;

  const value = scopedGet(ctx, "global", key);
  return value !== undefined ? String(value) : "";
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
  const key = resolveVariableKey(args, namedArgs);
  if (!key) return pipe;

  const value = resolveVariableValue(args, namedArgs, pipe);
  if (value === undefined) return pipe;

  const next = addToScopedVariable(ctx, "local", key, value);
  return stringifyVariable(next);
};

/** /addglobalvar key value - 追加或累加全局变量 */
export const handleAddGlobalVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const key = resolveVariableKey(args, namedArgs);
  if (!key) return pipe;

  const value = resolveVariableValue(args, namedArgs, pipe);
  if (value === undefined) return pipe;

  const next = addToScopedVariable(ctx, "global", key, value);
  return stringifyVariable(next);
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

/* ═══════════════════════════════════════════════════════════════════════════
   内部工具
   ═══════════════════════════════════════════════════════════════════════════ */

function resolveVariableKey(args: string[], namedArgs: Record<string, string>): string | undefined {
  return namedArgs.key ?? namedArgs.name ?? args[0];
}

function resolveVariableValue(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
): string | undefined {
  if (namedArgs.value !== undefined) {
    return namedArgs.value;
  }

  if (namedArgs.key !== undefined || namedArgs.name !== undefined) {
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

function scopedGet(ctx: ExecutionContext, scope: VariableScope, key: string): unknown {
  if (scope === "local") {
    return ctx.getVariable(key);
  }
  if (ctx.getScopedVariable) {
    return ctx.getScopedVariable(scope, key);
  }
  return ctx.getVariable(key);
}

function scopedSet(ctx: ExecutionContext, scope: VariableScope, key: string, value: unknown): void {
  if (scope === "local") {
    ctx.setVariable(key, value);
    return;
  }
  if (ctx.setScopedVariable) {
    ctx.setScopedVariable(scope, key, value);
    return;
  }
  ctx.setVariable(key, value);
}

function scopedDelete(ctx: ExecutionContext, scope: VariableScope, key: string): void {
  if (scope === "local") {
    ctx.deleteVariable(key);
    return;
  }
  if (ctx.deleteScopedVariable) {
    ctx.deleteScopedVariable(scope, key);
    return;
  }
  ctx.deleteVariable(key);
}

function addToScopedVariable(
  ctx: ExecutionContext,
  scope: VariableScope,
  key: string,
  value: string,
): unknown {
  const current = scopedGet(ctx, scope, key) ?? 0;

  const list = parseListValue(current);
  if (list) {
    list.push(value);
    scopedSet(ctx, scope, key, list);
    return list;
  }

  const increment = Number(value);
  const currentNumber = Number(current);
  if (Number.isFinite(increment) && Number.isFinite(currentNumber)) {
    const nextNumber = currentNumber + increment;
    scopedSet(ctx, scope, key, nextNumber);
    return nextNumber;
  }

  const nextText = `${String(current ?? "")}${value}`;
  scopedSet(ctx, scope, key, nextText);
  return nextText;
}

function parseListValue(current: unknown): string[] | undefined {
  if (Array.isArray(current)) {
    return current.map((item) => String(item));
  }

  if (typeof current !== "string") {
    return undefined;
  }

  try {
    const parsed = JSON.parse(current);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item));
    }
  } catch {
    // 非 JSON 文本不按数组处理
  }

  return undefined;
}

function stringifyVariable(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(",");
  }
  return String(value);
}
