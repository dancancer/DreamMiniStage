/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                 Chat Management Command Handlers                          ║
 * ║                                                                           ║
 * ║  聊天管理命令 - chat-* / delchat / delmode / delname / delswipe          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import { parseBoolean } from "../utils/helpers";

function parseMessageIndex(raw: string | undefined, commandName: string): number {
  const parsed = Number.parseInt((raw || "").trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`/${commandName} invalid message index: ${raw || ""}`);
  }
  return parsed;
}

function parseRenderCount(raw: string | undefined, commandName: string): number {
  if (!raw || raw.trim().length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`/${commandName} invalid message count: ${raw}`);
  }
  return parsed;
}

function parseDeleteCount(raw: string | undefined, commandName: string): number {
  if (!raw || raw.trim().length === 0) {
    return 1;
  }

  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`/${commandName} invalid delete count: ${raw}`);
  }
  return parsed;
}

function parseSwipeId(raw: string | undefined): number | undefined {
  if (!raw || raw.trim().length === 0) {
    return undefined;
  }
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`/delswipe invalid swipe id: ${raw}`);
  }
  return parsed;
}

function isMessageNameMatched(messageName: string | undefined, targetName: string): boolean {
  return (messageName || "").trim().toLowerCase() === targetName;
}

/**
 * /chat-manager - 打开聊天管理器
 * SillyTavern 语义：无返回值（空字符串），支持别名 chat-history / manage-chats。
 */
export const handleChatManager: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.openChatManager) {
    throw new Error("/chat-manager is not available in current context");
  }

  await ctx.openChatManager();
  return "";
};

/**
 * /chat-reload - 重载当前会话
 * SillyTavern 语义：无返回值（空字符串）。
 */
export const handleChatReload: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.reloadCurrentChat) {
    throw new Error("/chat-reload is not available in current context");
  }

  await ctx.reloadCurrentChat();
  return "";
};

/**
 * /delchat - 删除当前聊天
 * SillyTavern 语义：无返回值（空字符串）。
 */
export const handleDelChat: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.deleteCurrentChat) {
    throw new Error("/delchat is not available in current context");
  }

  await ctx.deleteCurrentChat();
  return "";
};

/**
 * /delmode [count] - 删除最后 N 条消息（默认 1）
 * 为保持单路径与 fail-fast，这里统一收敛到“明确数量删除”语义。
 */
export const handleDelMode: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.deleteMessage) {
    throw new Error("/delmode is not available in current context");
  }

  const messages = ctx.messages ?? [];
  if (messages.length === 0) {
    throw new Error("/delmode requires at least one message");
  }

  const countRaw = args[0] || namedArgs.count || pipe;
  const count = parseDeleteCount(countRaw, "delmode");
  if (count > messages.length) {
    throw new Error(`/delmode delete count out of range: ${count}`);
  }

  const deletedTexts: string[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const index = messages.length - 1 - offset;
    deletedTexts.push(messages[index]?.content || "");
    await ctx.deleteMessage(index);
  }

  return deletedTexts.join("\n");
};

/**
 * /delete [count] - /delmode 的语义别名
 */
export const handleDelete: CommandHandler = async (args, namedArgs, ctx, pipe, invocationMeta) => {
  return handleDelMode(args, namedArgs, ctx, pipe, invocationMeta);
};

/**
 * /delname <name> - 删除指定 name 归属的消息
 * 返回值：删除数量（字符串）。
 */
export const handleDelName: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const targetRaw = (args.join(" ") || namedArgs.name || pipe || "").trim();
  if (!targetRaw) {
    throw new Error("/delname requires a target name");
  }

  if (ctx.deleteMessagesByName) {
    const deletedCount = await Promise.resolve(ctx.deleteMessagesByName(targetRaw));
    return String(deletedCount);
  }

  if (!ctx.deleteMessage) {
    throw new Error("/delname is not available in current context");
  }

  const targetName = targetRaw.toLowerCase();
  const matchedIndexes = (ctx.messages ?? [])
    .map((message, index) => ({ index, message }))
    .filter((item) => isMessageNameMatched(item.message.name, targetName))
    .map((item) => item.index)
    .sort((a, b) => b - a);

  for (const index of matchedIndexes) {
    await ctx.deleteMessage(index);
  }

  return String(matchedIndexes.length);
};

/**
 * /delswipe [id] - 删除末尾 assistant 消息的指定 swipe
 * 返回值：新的 swipe 索引（若宿主返回），否则空字符串。
 */
export const handleDelSwipe: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.deleteSwipe) {
    throw new Error("/delswipe is not available in current context");
  }

  const swipeId = parseSwipeId(args[0] || namedArgs.id || pipe);
  const nextSwipe = await Promise.resolve(ctx.deleteSwipe(swipeId));
  return nextSwipe === undefined || nextSwipe === null
    ? ""
    : String(nextSwipe);
};

/**
 * /chat-jump <index> - 跳转到指定消息索引
 * SillyTavern 语义：无返回值（空字符串），索引必须是非负整数。
 */
export const handleChatJump: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.jumpToMessage) {
    throw new Error("/chat-jump is not available in current context");
  }

  const rawIndex = args[0] || pipe;
  const index = parseMessageIndex(rawIndex, "chat-jump");
  if (index >= (ctx.messages?.length ?? 0)) {
    throw new Error(`/chat-jump message index out of range: ${index}`);
  }

  await ctx.jumpToMessage(index);
  return "";
};

/**
 * /chat-render [count] [scroll=true|false] - 触发聊天窗口重新渲染
 * SillyTavern 语义：无返回值（空字符串）。
 */
export const handleChatRender: CommandHandler = async (args, namedArgs, ctx, _pipe) => {
  if (!ctx.renderChatMessages) {
    throw new Error("/chat-render is not available in current context");
  }

  const count = parseRenderCount(args[0], "chat-render");
  const scroll = parseBoolean(namedArgs.scroll, false) ?? false;
  await ctx.renderChatMessages(count, { scroll });
  return "";
};
