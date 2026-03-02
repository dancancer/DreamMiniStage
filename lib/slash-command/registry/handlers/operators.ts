/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Operator Command Handlers                              ║
 * ║                                                                           ║
 * ║  算子命令 - add / sub / len / trim / push等                               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import { collectNumbers, pickText, parseNumber, toNumber } from "../utils/helpers";

/* ═══════════════════════════════════════════════════════════════════════════
   数学算子
   ═══════════════════════════════════════════════════════════════════════════ */

/** /add a b ... - 数值求和，pipe 也参与计算 */
export const handleAdd: CommandHandler = async (args, _namedArgs, _ctx, pipe) => {
  const nums = collectNumbers(args, pipe, 0);
  const sum = nums.reduce((acc, n) => acc + n, 0);
  return String(sum);
};

/** /sub a b ... - 依次相减，默认以 pipe 作为首项 */
export const handleSub: CommandHandler = async (args, _namedArgs, _ctx, pipe) => {
  const nums = collectNumbers(args, pipe, 0);
  const [head, ...rest] = nums;
  const result = rest.reduce((acc, n) => acc - n, head);
  return String(result);
};

/** /mul a b ... - 数值相乘，pipe 也参与计算 */
export const handleMul: CommandHandler = async (args, _namedArgs, _ctx, pipe) => {
  const nums = collectNumbers(args, pipe, 0);
  const result = nums.reduce((acc, n) => acc * n, 1);
  return String(result);
};

/** /div a b ... - 依次相除，除数为 0 时显式失败 */
export const handleDiv: CommandHandler = async (args, _namedArgs, _ctx, pipe) => {
  const nums = collectNumbers(args, pipe, 0);
  const [head, ...rest] = nums;
  const result = rest.reduce((acc, n) => {
    if (n === 0) {
      throw new Error("Division by zero");
    }
    return acc / n;
  }, head);
  return String(result);
};

/** /mod a b ... - 依次取模，除数为 0 时显式失败 */
export const handleMod: CommandHandler = async (args, _namedArgs, _ctx, pipe) => {
  const nums = collectNumbers(args, pipe, 0);
  const [head, ...rest] = nums;
  const result = rest.reduce((acc, n) => {
    if (n === 0) {
      throw new Error("Division by zero");
    }
    return acc % n;
  }, head);
  return String(result);
};

/**
 * /rand [to] | /rand from=0 to=1 [round=round|ceil|floor]
 * - 兼容常见位置参数与命名参数写法
 */
export const handleRand: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  const roundModeRaw = (namedArgs.round ?? args[2] ?? "").toLowerCase();
  if (roundModeRaw && roundModeRaw !== "round" && roundModeRaw !== "ceil" && roundModeRaw !== "floor") {
    throw new Error(`Invalid round mode: ${roundModeRaw}`);
  }

  const range = resolveRandRange(args, namedArgs, pipe);
  const value = range.from + Math.random() * (range.to - range.from);

  if (roundModeRaw === "round") return String(Math.round(value));
  if (roundModeRaw === "ceil") return String(Math.ceil(value));
  if (roundModeRaw === "floor") return String(Math.floor(value));
  return String(value);
};

/* ═══════════════════════════════════════════════════════════════════════════
   字符串算子
   ═══════════════════════════════════════════════════════════════════════════ */

/** /len text - 返回文本长度（默认使用 pipe） */
export const handleLen: CommandHandler = async (args, _namedArgs, _ctx, pipe) => {
  const target = pickText(args, pipe);
  return String(target.length);
};

/** /trim text - 去除首尾空白（默认使用 pipe） */
export const handleTrim: CommandHandler = async (args, _namedArgs, _ctx, pipe) => {
  const target = pickText(args, pipe);
  return target.trim();
};

/** /split [separator] [text] - 分割文本并返回 JSON 数组 */
export const handleSplit: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  const separatorFromNamed = namedArgs.separator ?? namedArgs.sep;
  const { separator, text } = resolveSplitInput(args, pipe, separatorFromNamed);
  const limit = parseNumber(namedArgs.limit);

  if (namedArgs.limit !== undefined && limit === undefined) {
    throw new Error(`Invalid limit: ${namedArgs.limit}`);
  }

  const result = limit !== undefined
    ? text.split(separator, limit)
    : text.split(separator);
  return JSON.stringify(result);
};

/** /join [separator] [list] - 连接数组或 CSV 文本 */
export const handleJoin: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  const separatorFromNamed = namedArgs.separator ?? namedArgs.sep;
  const { separator, list } = resolveJoinInput(args, pipe, separatorFromNamed);
  return list.join(separator);
};

/**
 * /replace mode=literal|regex pattern=... replacer=... [text]
 * /replace <pattern> [replacer] [text]
 */
export const handleReplace: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  const mode = (namedArgs.mode ?? "literal").toLowerCase();
  if (mode !== "literal" && mode !== "regex") {
    throw new Error(`Invalid replace mode: ${mode}`);
  }

  const params = resolveReplaceInput(args, namedArgs, pipe);
  if (params.pattern === "") {
    throw new Error("Argument 'pattern' cannot be empty");
  }

  if (mode === "literal") {
    return params.text.replaceAll(params.pattern, params.replacer);
  }

  const re = regexFromString(params.pattern);
  if (!re) {
    throw new Error(`Invalid regex pattern: ${params.pattern}`);
  }
  return params.text.replace(re, params.replacer);
};

function resolveRandRange(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
): { from: number; to: number } {
  if (namedArgs.from !== undefined || namedArgs.to !== undefined) {
    const from = toNumber(namedArgs.from ?? "0");
    const to = toNumber(namedArgs.to ?? (args[0] ?? (pipe || "1")));
    return { from, to };
  }

  if (args.length >= 2) {
    return { from: toNumber(args[0]), to: toNumber(args[1]) };
  }

  if (args.length === 1) {
    return { from: 0, to: toNumber(args[0]) };
  }

  if (pipe) {
    return { from: 0, to: toNumber(pipe) };
  }

  return { from: 0, to: 1 };
}

function resolveSplitInput(
  args: string[],
  pipe: string,
  separatorFromNamed: string | undefined,
): { separator: string; text: string } {
  if (separatorFromNamed !== undefined) {
    return {
      separator: separatorFromNamed,
      text: args.length > 0 ? args.join(" ") : pipe,
    };
  }

  if (args.length === 0) {
    return { separator: ",", text: pipe };
  }

  if (args.length === 1) {
    if (pipe) {
      return { separator: args[0], text: pipe };
    }
    return { separator: ",", text: args[0] };
  }

  return {
    separator: args[0],
    text: args.slice(1).join(" "),
  };
}

function resolveJoinInput(
  args: string[],
  pipe: string,
  separatorFromNamed: string | undefined,
): { separator: string; list: string[] } {
  if (separatorFromNamed !== undefined) {
    if (args.length > 1) {
      return { separator: separatorFromNamed, list: [...args] };
    }
    const raw = args[0] ?? pipe;
    return { separator: separatorFromNamed, list: parseList(raw) };
  }

  if (args.length === 0) {
    return { separator: ",", list: parseList(pipe) };
  }

  if (args.length === 1) {
    if (pipe) {
      return { separator: args[0], list: parseList(pipe) };
    }
    return { separator: ",", list: parseList(args[0]) };
  }

  return { separator: args[0], list: args.slice(1) };
}

function resolveReplaceInput(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
): { pattern: string; replacer: string; text: string } {
  if (namedArgs.pattern !== undefined) {
    return {
      pattern: namedArgs.pattern,
      replacer: namedArgs.replacer ?? "",
      text: args.length > 0 ? args.join(" ") : pipe,
    };
  }

  if (args.length === 0) {
    throw new Error("Missing pattern");
  }

  if (args.length >= 3) {
    return {
      pattern: args[0],
      replacer: args[1],
      text: args.slice(2).join(" "),
    };
  }

  if (args.length === 2) {
    if (pipe) {
      return {
        pattern: args[0],
        replacer: args[1],
        text: pipe,
      };
    }
    return {
      pattern: args[0],
      replacer: "",
      text: args[1],
    };
  }

  return {
    pattern: args[0],
    replacer: "",
    text: pipe,
  };
}

function parseList(raw: string): string[] {
  if (raw.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item));
    }
  } catch {
    // 不是 JSON 数组时按 CSV 处理
  }

  return raw.split(",").map((item) => item.trim());
}

function regexFromString(input: string): RegExp | undefined {
  try {
    const matched = input.match(/(\/?)(.+)\1([a-z]*)/i);
    if (!matched) return undefined;

    const [, , source, flags] = matched;
    if (flags && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(flags)) {
      return new RegExp(input);
    }
    return new RegExp(source, flags);
  } catch {
    return undefined;
  }
}
