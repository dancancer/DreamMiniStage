/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command 注册表                               ║
 * ║                                                                            ║
 * ║  好品味：用 Map 消灭 switch/case                                            ║
 * ║  新增命令只需在 COMMAND_REGISTRY 添加一行                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler, ExecutionContext } from "./types";

// ============================================================================
//                              核心命令实现
// ============================================================================

/** /send <text> - 发送消息（支持 at/name/compact/return） */
const handleSend: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const text = (args.join(" ") || pipe || "").toString();
  const at = normalizeIndex(parseNumber(namedArgs.at), ctx.messages?.length ?? 0);
  const name = namedArgs.name;
  const compact = parseBoolean(namedArgs.compact);
  const returnType = namedArgs["return"];

  await ctx.onSend(text, { at, name, compact, returnType });
  return buildSendReturn(returnType, text, pipe, at);
};

/** /trigger - 触发 AI 生成，支持 await 与群组成员选择 */
const TRIGGER_LOCKS: Map<string, Promise<void>> = new Map();

const handleTrigger: CommandHandler = async (args, namedArgs, ctx, _pipe) => {
  const member = args[0] ?? namedArgs.member;
  const shouldAwait = parseBoolean(namedArgs["await"], true);
  const lockKey = ctx.characterId || "__default__";

  const pending = TRIGGER_LOCKS.get(lockKey);
  if (pending) {
    await pending.catch(() => {});
  }

  const triggerPromise = (async () => {
    await ctx.onTrigger(member);
  })();

  TRIGGER_LOCKS.set(lockKey, triggerPromise);

  try {
    if (shouldAwait) {
      await triggerPromise;
    } else {
      triggerPromise.catch(() => {});
    }
    return "";
  } finally {
    triggerPromise.finally(() => {
      if (TRIGGER_LOCKS.get(lockKey) === triggerPromise) {
        TRIGGER_LOCKS.delete(lockKey);
      }
    });
  }
};

/** /setvar key=value 或 /setvar key value - 设置变量 */
const handleSetVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
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
const handleGetVar: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  const value = ctx.getVariable(args[0]);
  return value !== undefined ? String(value) : "";
};

/** /delvar key - 删除变量 */
const handleDelVar: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  ctx.deleteVariable(args[0]);
  return pipe;
};

/** /echo <text> - 回显文本（用于调试） */
const handleEcho: CommandHandler = async (args, _namedArgs, _ctx, pipe) => {
  return args.length > 0 ? args.join(" ") : pipe;
};

/** /pass - 透传 pipe 值 */
const handlePass: CommandHandler = async (_args, _namedArgs, _ctx, pipe) => {
  return pipe;
};

/** /return <value?> - 返回一个值并中止执行链 */
const handleReturn: CommandHandler = async (args, _namedArgs, _ctx, pipe) => {
  return args[0] ?? pipe;
};

/** /sendas <role> <text> - 以指定角色发送 */
const handleSendAs: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  const [role, ...rest] = args;
  const text = rest.join(" ") || pipe;
  if (!text) return pipe;

  if (ctx.onSendAs) {
    await ctx.onSendAs(role, text);
    return text;
  }

  await ctx.onSend(`[${role}] ${text}`);
  return text;
};

/** /sys <text> - 发送系统/旁白消息 */
const handleSys: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  const text = args.join(" ") || pipe;
  if (!text) return pipe;
  if (ctx.onSendSystem) {
    await ctx.onSendSystem(text);
    return text;
  }
  await ctx.onSend(`[SYS] ${text}`);
  return text;
};

/** /impersonate <text> - AI 扮演用户回复 */
const handleImpersonate: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  const text = args.join(" ") || pipe;
  if (!text) return pipe;
  if (ctx.onImpersonate) {
    await ctx.onImpersonate(text);
  } else {
    await ctx.onSend(`[impersonate] ${text}`);
    await ctx.onTrigger();
  }
  return text;
};

/** /continue - 继续生成 */
const handleContinue: CommandHandler = async (_args, _namedArgs, ctx, pipe) => {
  if (ctx.onContinue) {
    await ctx.onContinue();
  } else {
    await ctx.onTrigger();
  }
  return pipe;
};

/** /swipe - 切换回复 swipe（占位实现） */
const handleSwipe: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (ctx.onSwipe) {
    await ctx.onSwipe(args[0]);
  }
  return pipe;
};

// ============================================================================
//                              P2 基础算子
// ============================================================================

/** /add a b ... - 数值求和，pipe 也参与计算 */
const handleAdd: CommandHandler = async (args, _namedArgs, _ctx, pipe) => {
  const nums = collectNumbers(args, pipe, 0);
  const sum = nums.reduce((acc, n) => acc + n, 0);
  return String(sum);
};

/** /sub a b ... - 依次相减，默认以 pipe 作为首项 */
const handleSub: CommandHandler = async (args, _namedArgs, _ctx, pipe) => {
  const nums = collectNumbers(args, pipe, 0);
  const [head, ...rest] = nums;
  const result = rest.reduce((acc, n) => acc - n, head);
  return String(result);
};

/** /len text - 返回文本长度（默认使用 pipe） */
const handleLen: CommandHandler = async (args, _namedArgs, _ctx, pipe) => {
  const target = pickText(args, pipe);
  return String(target.length);
};

/** /trim text - 去除首尾空白（默认使用 pipe） */
const handleTrim: CommandHandler = async (args, _namedArgs, _ctx, pipe) => {
  const target = pickText(args, pipe);
  return target.trim();
};

/** /push key value? - 将值压入变量数组，默认用 pipe 作为值 */
const handlePush: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  const [key, ...rest] = args;
  const values = rest.length > 0 ? rest : (pipe ? [pipe] : []);
  if (values.length === 0) return pipe;

  const current = ctx.getVariable(key);
  const base = Array.isArray(current) ? [...current] : [];
  base.push(...values);
  ctx.setVariable(key, base);
  return JSON.stringify(base);
};

// ============================================================================
//                              命令注册表
// ============================================================================

export const COMMAND_REGISTRY: Map<string, CommandHandler> = new Map([
  ["send", handleSend],
  ["trigger", handleTrigger],
  ["setvar", handleSetVar],
  ["getvar", handleGetVar],
  ["delvar", handleDelVar],
  ["echo", handleEcho],
  ["pass", handlePass],
  ["return", handleReturn],
  ["sendas", handleSendAs],
  ["sys", handleSys],
  ["impersonate", handleImpersonate],
  ["continue", handleContinue],
  ["cont", handleContinue],
  ["swipe", handleSwipe],
  ["add", handleAdd],
  ["sub", handleSub],
  ["len", handleLen],
  ["trim", handleTrim],
  ["push", handlePush],
]);

// ============================================================================
//                              注册表操作
// ============================================================================

/** 获取命令处理器 */
export function getCommandHandler(name: string): CommandHandler | undefined {
  return COMMAND_REGISTRY.get(name.toLowerCase());
}

/** 注册新命令 */
export function registerCommand(name: string, handler: CommandHandler): void {
  COMMAND_REGISTRY.set(name.toLowerCase(), handler);
}

/** 检查命令是否存在 */
export function hasCommand(name: string): boolean {
  return COMMAND_REGISTRY.has(name.toLowerCase());
}

/** 获取所有已注册命令名 */
export function getRegisteredCommands(): string[] {
  return Array.from(COMMAND_REGISTRY.keys());
}

// ============================================================================
//                              工具函数
// ============================================================================

function collectNumbers(args: string[], pipe: string, fallback: number): number[] {
  const sources = (pipe ? [pipe] : []).concat(args);
  const list = sources.length === 0 ? [String(fallback)] : sources;
  return list.map(toNumber);
}

function toNumber(raw: string): number {
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid number: ${raw}`);
  }
  return value;
}

function pickText(args: string[], pipe: string): string {
  if (args.length > 0) return args.join(" ");
  return pipe;
}

function parseNumber(raw?: string): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (Number.isNaN(n)) return undefined;
  return n;
}

function parseBoolean(raw?: string, defaultValue?: boolean): boolean | undefined {
  if (raw === undefined) return defaultValue;
  const lowered = raw.toLowerCase();
  if (lowered === "false" || lowered === "0" || lowered === "off") return false;
  if (lowered === "true" || lowered === "1" || lowered === "on") return true;
  return defaultValue;
}

function normalizeIndex(raw: number | undefined, length: number): number | undefined {
  if (raw === undefined || Number.isNaN(raw)) return raw;
  if (raw < 0) return Math.max(length + raw, 0);
  if (raw > length) return length;
  return raw;
}

function buildSendReturn(
  returnType: string | undefined,
  text: string,
  pipe: string,
  at?: number,
): string {
  const normalized = returnType?.toLowerCase();
  if (!normalized) return text;
  if (normalized === "none") return "";
  if (normalized === "pipe") return pipe ?? "";
  if (normalized === "object") return JSON.stringify({ text, at });
  return text;
}
