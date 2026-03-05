/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                 Chat Management Command Handlers                          ║
 * ║                                                                           ║
 * ║  聊天管理命令 - chat-manager / chat-reload / chat-jump / chat-render      ║
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
