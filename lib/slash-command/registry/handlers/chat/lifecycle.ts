/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║               Chat Lifecycle Command Handlers                            ║
 * ║                                                                          ║
 * ║  聊天生命周期 - chat-manager / newchat / closechat / hide / cut / del    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../../types";
import { parseBoolean } from "../../utils/helpers";

/* ═══════════════════════════════════════════════════════════════════════════
   解析工具
   ═══════════════════════════════════════════════════════════════════════════ */

function parseMessageIndex(raw: string | undefined, commandName: string): number {
  const parsed = Number.parseInt((raw || "").trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`/${commandName} invalid message index: ${raw || ""}`);
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

function parseNewChatDelete(raw: string | undefined): boolean {
  if (raw === undefined) {
    return false;
  }

  const parsed = parseBoolean(raw, undefined);
  if (parsed === undefined) {
    throw new Error(`/newchat invalid delete value: ${raw}`);
  }
  return parsed;
}

function resolveHideStartIndex(
  raw: string | undefined,
  messages: Parameters<CommandHandler>[2]["messages"],
  commandName: string,
): number {
  if (messages.length === 0) {
    throw new Error(`/${commandName} requires at least one message`);
  }

  if (raw !== undefined) {
    const index = parseMessageIndex(raw, commandName);
    if (index >= messages.length) {
      throw new Error(`/${commandName} message index out of range: ${index}`);
    }
    return index;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      return index;
    }
  }

  return messages.length - 1;
}

function parseCutSelector(raw: string, commandName: string, maxIndex: number): number[] {
  const normalized = raw.trim();
  if (!normalized) {
    return [];
  }

  const rangeMatch = /^(\d+)-(\d+)$/.exec(normalized);
  if (rangeMatch) {
    const start = Number.parseInt(rangeMatch[1], 10);
    const end = Number.parseInt(rangeMatch[2], 10);
    if (start > end) {
      throw new Error(`/${commandName} invalid range: ${raw}`);
    }
    if (end > maxIndex) {
      throw new Error(`/${commandName} message index out of range: ${end}`);
    }

    return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
  }

  const index = Number.parseInt(normalized, 10);
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`/${commandName} invalid message selector: ${raw}`);
  }
  if (index > maxIndex) {
    throw new Error(`/${commandName} message index out of range: ${index}`);
  }

  return [index];
}

function resolveCutTargetIndexes(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
  commandName: string,
  messageCount: number,
): number[] {
  if (messageCount <= 0) {
    throw new Error(`/${commandName} requires at least one message`);
  }

  const fromArgs = args.join(" ");
  const rawInput = (fromArgs || namedArgs.range || namedArgs.id || pipe || "").trim();
  if (!rawInput) {
    throw new Error(`/${commandName} requires at least one message index or range`);
  }

  const selectors = rawInput
    .split(/[\s,]+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
  if (selectors.length === 0) {
    throw new Error(`/${commandName} requires at least one message index or range`);
  }

  const selected = new Set<number>();
  for (const selector of selectors) {
    for (const index of parseCutSelector(selector, commandName, messageCount - 1)) {
      selected.add(index);
    }
  }

  return Array.from(selected.values()).sort((a, b) => a - b);
}

function isMessageNameMatched(messageName: string | undefined, targetName: string): boolean {
  return (messageName || "").trim().toLowerCase() === targetName;
}

/* ═══════════════════════════════════════════════════════════════════════════
   命令处理器
   ═══════════════════════════════════════════════════════════════════════════ */

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
 * /closechat - 关闭当前会话（不删除聊天记录）
 * SillyTavern 语义：无返回值（空字符串）。
 */
export const handleCloseChat: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.closeCurrentChat) {
    throw new Error("/closechat is not available in current context");
  }

  await Promise.resolve(ctx.closeCurrentChat());
  return "";
};

/**
 * /newchat [delete=true|false] - 创建新会话
 * SillyTavern 语义：返回空字符串。
 */
export const handleNewChat: CommandHandler = async (args, namedArgs, ctx, _pipe) => {
  if (!ctx.createNewChat) {
    throw new Error("/newchat is not available in current context");
  }

  const deleteRaw = namedArgs.delete ?? args[0];
  const deleteCurrentChat = parseNewChatDelete(deleteRaw);
  await Promise.resolve(ctx.createNewChat({ deleteCurrentChat }));
  return "";
};

/**
 * /tempchat - 打开临时会话
 * SillyTavern 语义：创建 Assistant 临时会话并返回空字符串。
 */
export const handleTempChat: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.openTemporaryChat) {
    throw new Error("/tempchat is not available in current context");
  }

  await Promise.resolve(ctx.openTemporaryChat());
  return "";
};

/**
 * /getchatname - 获取当前聊天名称
 * SillyTavern 语义：返回聊天名称字符串。
 */
export const handleGetChatName: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.getCurrentChatName) {
    throw new Error("/getchatname is not available in current context");
  }

  const chatName = await Promise.resolve(ctx.getCurrentChatName());
  if (typeof chatName !== "string") {
    throw new Error("/getchatname host returned non-string chat name");
  }
  return chatName;
};

/** /renamechat <name> - 重命名当前聊天 */
export const handleRenameChat: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.renameCurrentChat) {
    throw new Error("/renamechat is not available in current context");
  }

  const nextName = (args.join(" ") || namedArgs.name || pipe || "").trim();
  if (!nextName) {
    throw new Error("/renamechat requires a chat name");
  }

  const result = await Promise.resolve(ctx.renameCurrentChat(nextName));
  if (typeof result !== "string") {
    throw new Error("/renamechat host returned non-string result");
  }
  return result;
};

/**
 * /setinput [text] - 设置聊天输入框内容
 * SillyTavern 语义：支持位置参数、namedArgs.text、pipe 作为写入来源。
 */
export const handleSetInput: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.setInputText) {
    throw new Error("/setinput is not available in current context");
  }

  const fromArgs = args.join(" ");
  const fromNamed = namedArgs.text;
  const nextInput = fromArgs || fromNamed || pipe;
  await Promise.resolve(ctx.setInputText(nextInput));
  return nextInput;
};

/** /forcesave - 强制保存当前聊天 */
export const handleForceSave: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.forceSaveChat) {
    throw new Error("/forcesave is not available in current context");
  }

  await Promise.resolve(ctx.forceSaveChat());
  return "";
};

/** /hide [at=<index>] - 隐藏目标消息及其后续消息 */
export const handleHide: CommandHandler = async (_args, namedArgs, ctx, _pipe) => {
  if (!ctx.hideMessages) {
    throw new Error("/hide is not available in current context");
  }

  const startIndex = resolveHideStartIndex(namedArgs.at, ctx.messages, "hide");
  await Promise.resolve(ctx.hideMessages(startIndex));
  return "";
};

/** /unhide - 重新显示当前分支中的隐藏消息 */
export const handleUnhide: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.unhideMessages) {
    throw new Error("/unhide is not available in current context");
  }

  await Promise.resolve(ctx.unhideMessages());
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
 * 为保持单路径与 fail-fast，这里统一收敛到"明确数量删除"语义。
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
 * /cut [index|range...] - 剪切消息并返回文本
 * SillyTavern 语义：range 为闭区间，支持多个 index/range 组合。
 */
export const handleCut: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.deleteMessage) {
    throw new Error("/cut is not available in current context");
  }

  const messages = ctx.messages ?? [];
  const targetIndexes = resolveCutTargetIndexes(args, namedArgs, pipe, "cut", messages.length);
  const deletedTexts = targetIndexes.map((index) => messages[index]?.content || "");

  for (const index of [...targetIndexes].sort((a, b) => b - a)) {
    await Promise.resolve(ctx.deleteMessage(index));
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

