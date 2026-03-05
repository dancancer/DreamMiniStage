/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                 Chat Management Command Handlers                          ║
 * ║                                                                           ║
 * ║  聊天管理命令 - chat-* / member-* / delchat / delmode / delname / swipe  ║
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

function parseGroupMemberField(raw: string | undefined): "name" | "index" | "id" | "avatar" {
  if (!raw || raw.trim().length === 0) {
    return "name";
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "name" || normalized === "index" || normalized === "id" || normalized === "avatar") {
    return normalized;
  }

  throw new Error(`/getmember invalid field: ${raw}`);
}

function resolveReasoningMessageIndex(
  raw: string | undefined,
  messages: Array<{ content: string }>,
  commandName: "get-reasoning" | "set-reasoning",
): number {
  if (messages.length === 0) {
    throw new Error(`/${commandName} requires at least one message`);
  }

  if (!raw || raw.trim().length === 0) {
    return messages.length - 1;
  }

  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`/${commandName} invalid message index: ${raw}`);
  }
  if (parsed >= messages.length) {
    throw new Error(`/${commandName} message index out of range: ${parsed}`);
  }
  return parsed;
}

function normalizeInjectionRecord(record: unknown): Record<string, unknown> {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("/listinjects host returned invalid injection record");
  }

  const raw = record as Record<string, unknown>;
  if (typeof raw.id !== "string" || raw.id.trim().length === 0) {
    throw new Error("/listinjects host returned injection with invalid id");
  }
  if (typeof raw.content !== "string") {
    throw new Error(`/listinjects host returned injection ${raw.id} with invalid content`);
  }

  return {
    id: raw.id,
    content: raw.content,
    role: typeof raw.role === "string" ? raw.role : "system",
    position: typeof raw.position === "string" ? raw.position : "in_chat",
    depth: typeof raw.depth === "number" ? raw.depth : 0,
    should_scan: raw.should_scan === true,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
  };
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

/**
 * /member-get [member] [field=name|index|id|avatar]
 * 别名：/getmember /memberget
 */
export const handleGetMember: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.getGroupMember) {
    throw new Error("/getmember is not available in current context");
  }

  const target = (args.join(" ") || namedArgs.member || pipe || "").trim();
  if (!target) {
    throw new Error("/getmember requires a member target");
  }

  const field = parseGroupMemberField(namedArgs.field);
  const value = await Promise.resolve(ctx.getGroupMember(target, field));
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("/getmember host returned invalid value");
  }

  return String(value);
};

/**
 * /member-add [member] - 添加群聊成员
 * 别名：/addmember /memberadd
 */
export const handleAddMember: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.addGroupMember) {
    throw new Error("/addmember is not available in current context");
  }

  const target = (args.join(" ") || namedArgs.name || pipe || "").trim();
  if (!target) {
    throw new Error("/addmember requires a member target");
  }

  const result = await Promise.resolve(ctx.addGroupMember(target));
  if (result === undefined || result === null) {
    return "";
  }
  if (typeof result !== "string" && typeof result !== "number") {
    throw new Error("/addmember host returned invalid value");
  }

  return String(result);
};

/**
 * /addswipe [text] [switch=true|false] - 为末条 assistant 追加 swipe
 */
export const handleAddSwipe: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.addSwipe) {
    throw new Error("/addswipe is not available in current context");
  }

  const swipeText = args.join(" ") || namedArgs.text || pipe || "";
  if (!swipeText.trim()) {
    throw new Error("/addswipe requires swipe text");
  }

  const switchToNewSwipe = parseBoolean(namedArgs.switch, undefined);
  if (namedArgs.switch !== undefined && switchToNewSwipe === undefined) {
    throw new Error(`/addswipe invalid switch value: ${namedArgs.switch}`);
  }

  const result = await Promise.resolve(
    ctx.addSwipe(swipeText, { switch: switchToNewSwipe }),
  );
  if (result === undefined || result === null) {
    return "";
  }
  if (typeof result !== "string" && typeof result !== "number") {
    throw new Error("/addswipe host returned invalid value");
  }

  return String(result);
};

/**
 * /get-reasoning [index] - 获取消息推理块
 * SillyTavern 语义：默认读取最后一条消息的 reasoning 内容。
 */
export const handleGetReasoning: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const messages = ctx.messages ?? [];
  const index = resolveReasoningMessageIndex(args[0] || namedArgs.at || pipe, messages, "get-reasoning");

  if (ctx.getMessageReasoning) {
    const reasoning = await Promise.resolve(ctx.getMessageReasoning(index));
    if (reasoning === undefined || reasoning === null) {
      return "";
    }
    if (typeof reasoning !== "string") {
      throw new Error("/get-reasoning host returned non-string reasoning");
    }
    return reasoning;
  }

  return messages[index]?.thinkingContent || "";
};

/**
 * /set-reasoning [text] - 设置消息推理块
 * SillyTavern 语义：默认写入最后一条消息，可通过 at= 指定索引。
 */
export const handleSetReasoning: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const messages = ctx.messages ?? [];
  const index = resolveReasoningMessageIndex(namedArgs.at, messages, "set-reasoning");
  const reasoning = args.join(" ") || pipe || "";

  const collapse = parseBoolean(namedArgs.collapse, undefined);
  if (namedArgs.collapse !== undefined && collapse === undefined) {
    throw new Error(`/set-reasoning invalid collapse value: ${namedArgs.collapse}`);
  }

  if (ctx.setMessageReasoning) {
    await Promise.resolve(ctx.setMessageReasoning(index, reasoning, { collapse }));
    return reasoning;
  }

  const message = messages[index];
  if (!message) {
    throw new Error(`/set-reasoning message index out of range: ${index}`);
  }
  message.thinkingContent = reasoning;
  return reasoning;
};

/**
 * /listinjects - 列出当前会话注入项
 * SillyTavern 语义：返回注入对象；这里统一返回 JSON 字符串。
 */
export const handleListInjects: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.listPromptInjections) {
    throw new Error("/listinjects is not available in current context");
  }

  const injections = await Promise.resolve(ctx.listPromptInjections());
  if (!Array.isArray(injections)) {
    throw new Error("/listinjects host returned non-array injections");
  }

  return JSON.stringify(injections.map(normalizeInjectionRecord));
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
