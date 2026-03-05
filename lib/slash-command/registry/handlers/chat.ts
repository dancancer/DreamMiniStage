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

function resolveGroupMemberTarget(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
  commandName: string,
): string {
  const target = (args.join(" ") || namedArgs.member || namedArgs.name || pipe || "").trim();
  if (!target) {
    throw new Error(`/${commandName} requires a member target`);
  }
  return target;
}

function normalizeGroupMemberMutationResult(commandName: string, result: unknown): string {
  if (result === undefined || result === null) {
    return "";
  }
  if (typeof result !== "string" && typeof result !== "number") {
    throw new Error(`/${commandName} host returned invalid value`);
  }
  return String(result);
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

  const target = resolveGroupMemberTarget(args, namedArgs, pipe, "addmember");
  const result = await Promise.resolve(ctx.addGroupMember(target));
  return normalizeGroupMemberMutationResult("addmember", result);
};

/**
 * /member-remove [member] - 移除群聊成员
 * 别名：/removemember /memberremove
 */
export const handleRemoveMember: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.removeGroupMember) {
    throw new Error("/member-remove is not available in current context");
  }

  const target = resolveGroupMemberTarget(args, namedArgs, pipe, "member-remove");
  const result = await Promise.resolve(ctx.removeGroupMember(target));
  return normalizeGroupMemberMutationResult("member-remove", result);
};

/**
 * /member-up [member] - 向上移动群聊成员
 * 别名：/upmember /memberup
 */
export const handleMoveMemberUp: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.moveGroupMember) {
    throw new Error("/member-up is not available in current context");
  }

  const target = resolveGroupMemberTarget(args, namedArgs, pipe, "member-up");
  const result = await Promise.resolve(ctx.moveGroupMember(target, "up"));
  return normalizeGroupMemberMutationResult("member-up", result);
};

/**
 * /member-down [member] - 向下移动群聊成员
 * 别名：/downmember /memberdown
 */
export const handleMoveMemberDown: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.moveGroupMember) {
    throw new Error("/member-down is not available in current context");
  }

  const target = resolveGroupMemberTarget(args, namedArgs, pipe, "member-down");
  const result = await Promise.resolve(ctx.moveGroupMember(target, "down"));
  return normalizeGroupMemberMutationResult("member-down", result);
};

/**
 * /member-peek [member] - 预览群聊成员
 * 别名：/peek /memberpeek /peekmember
 */
export const handlePeekMember: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.peekGroupMember) {
    throw new Error("/member-peek is not available in current context");
  }

  const target = resolveGroupMemberTarget(args, namedArgs, pipe, "member-peek");
  const result = await Promise.resolve(ctx.peekGroupMember(target));
  return normalizeGroupMemberMutationResult("member-peek", result);
};

/**
 * /member-count - 获取群成员数量
 * 别名：/countmember /membercount
 */
export const handleCountMember: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.getGroupMemberCount) {
    throw new Error("/countmember is not available in current context");
  }

  const count = await Promise.resolve(ctx.getGroupMemberCount());
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("/countmember host returned invalid member count");
  }

  return String(count);
};

/**
 * /member-disable [member] - 禁用群聊成员
 * 别名：/disable /disablemember /memberdisable
 */
export const handleDisableMember: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.setGroupMemberEnabled) {
    throw new Error("/disable is not available in current context");
  }

  const target = resolveGroupMemberTarget(args, namedArgs, pipe, "disable");
  const result = await Promise.resolve(ctx.setGroupMemberEnabled(target, false));
  return normalizeGroupMemberMutationResult("disable", result);
};

/**
 * /member-enable [member] - 启用群聊成员
 * 别名：/enable /enablemember /memberenable
 */
export const handleEnableMember: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.setGroupMemberEnabled) {
    throw new Error("/enable is not available in current context");
  }

  const target = resolveGroupMemberTarget(args, namedArgs, pipe, "enable");
  const result = await Promise.resolve(ctx.setGroupMemberEnabled(target, true));
  return normalizeGroupMemberMutationResult("enable", result);
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
 * /flushinject [id] - 删除当前会话注入项
 * 别名：/flushinjects
 * SillyTavern 语义：无返回值（空字符串）；未提供 id 时删除全部。
 */
export const handleFlushInjects: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.removePromptInjections) {
    throw new Error("/flushinject is not available in current context");
  }

  const targetId = (args[0] || namedArgs.id || pipe || "").trim() || undefined;
  const removed = await Promise.resolve(ctx.removePromptInjections(targetId));
  if (!Number.isInteger(removed) || removed < 0) {
    throw new Error("/flushinject host returned invalid remove count");
  }
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
