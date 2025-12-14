/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  Message Management Handlers                              ║
 * ║                                                                           ║
 * ║  消息管理命令 - getmessage / editmessage / delmessage等                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";

/** /getmessage <index> - 获取指定索引的消息 */
export const handleGetMessage: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.getMessage) return pipe;
  const index = args.length > 0 ? parseInt(args[0], 10) : -1;
  const msg = ctx.getMessage(index);
  return msg ? JSON.stringify({ role: msg.role, content: msg.content }) : "";
};

/** /editmessage <index> <content> - 编辑指定索引的消息 */
export const handleEditMessage: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.editMessage) return pipe;
  if (args.length < 2) return pipe;
  const index = parseInt(args[0], 10);
  const content = args.slice(1).join(" ") || pipe;
  await ctx.editMessage(index, content);
  return content;
};

/** /delmessage <index> - 删除指定索引的消息 */
export const handleDelMessage: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.deleteMessage) return pipe;
  if (args.length === 0) return pipe;
  const index = parseInt(args[0], 10);
  await ctx.deleteMessage(index);
  return pipe;
};

/** /messagecount - 获取消息数量 */
export const handleMessageCount: CommandHandler = async (_args, _namedArgs, ctx, pipe) => {
  if (!ctx.getMessageCount) return String(ctx.messages?.length ?? 0);
  return String(ctx.getMessageCount());
};
