/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  Message Management Handlers                              ║
 * ║                                                                           ║
 * ║  消息管理命令 - getmessage / setmessage / messages / delmessage 等         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";

interface SerializableMessage {
  index: number;
  id: string;
  role: string;
  content: string;
  name?: string;
  compact?: boolean;
}

function normalizeMessageIndex(raw: string, length: number): number {
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid message index: ${raw}`);
  }
  const normalized = parsed < 0 ? length + parsed : parsed;
  if (normalized < 0 || normalized >= length) {
    throw new Error(`Message index out of range: ${raw}`);
  }
  return normalized;
}

function toSerializableMessage(
  message: {
    id: string;
    role: string;
    content: string;
    name?: string;
    compact?: boolean;
  },
  index: number,
): SerializableMessage {
  return {
    index,
    id: message.id,
    role: message.role,
    content: message.content,
    name: message.name,
    compact: message.compact,
  };
}

/** /getmessage <index> - 获取指定索引的消息 */
export const handleGetMessage: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if ((ctx.messages?.length ?? 0) === 0) return "";
  const index = normalizeMessageIndex(args[0] ?? "-1", ctx.messages.length);
  const message = ctx.getMessage ? ctx.getMessage(index) : ctx.messages[index];
  if (!message) return "";
  return JSON.stringify(toSerializableMessage(message, index));
};

/** /editmessage <index> <content> - 编辑指定索引的消息 */
export const handleEditMessage: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.editMessage) return pipe;
  if (args.length < 2) return pipe;
  const index = normalizeMessageIndex(args[0], ctx.messages?.length ?? 0);
  const content = args.slice(1).join(" ") || pipe;
  await ctx.editMessage(index, content);
  return content;
};

/** /delmessage <index> - 删除指定索引的消息 */
export const handleDelMessage: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.deleteMessage) return pipe;
  if (args.length === 0) return pipe;
  const index = normalizeMessageIndex(args[0], ctx.messages?.length ?? 0);
  await ctx.deleteMessage(index);
  return pipe;
};

/** /messages [index] - 获取全部消息或单条消息 */
export const handleMessages: CommandHandler = async (args, _namedArgs, ctx) => {
  const messages = ctx.messages ?? [];
  if (messages.length === 0) return "[]";

  if (args.length === 0) {
    return JSON.stringify(messages.map((message, index) => toSerializableMessage(message, index)));
  }

  const index = normalizeMessageIndex(args[0], messages.length);
  const message = ctx.getMessage ? ctx.getMessage(index) : messages[index];
  if (!message) return "[]";
  return JSON.stringify([toSerializableMessage(message, index)]);
};

/** /messagecount - 获取消息数量 */
export const handleMessageCount: CommandHandler = async (_args, _namedArgs, ctx, pipe) => {
  if (!ctx.getMessageCount) return String(ctx.messages?.length ?? 0);
  return String(ctx.getMessageCount());
};
