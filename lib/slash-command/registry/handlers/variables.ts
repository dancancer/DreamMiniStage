/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  Variable Command Handlers                                ║
 * ║                                                                           ║
 * ║  变量命令 - setvar / getvar / delvar / listvar等                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";

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
    ctx.setVariable(key, rest.join(" "));
    return rest.join(" ");
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

/* ═══════════════════════════════════════════════════════════════════════════
   数值变量操作
   ═══════════════════════════════════════════════════════════════════════════ */

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
