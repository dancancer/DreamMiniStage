/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Operator Command Handlers                              ║
 * ║                                                                           ║
 * ║  算子命令 - add / sub / len / trim / push等                               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import { collectNumbers, pickText } from "../utils/helpers";

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
