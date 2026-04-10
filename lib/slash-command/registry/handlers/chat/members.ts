/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║               Group Member Command Handlers                              ║
 * ║                                                                          ║
 * ║  群聊成员 - member-get / member-add / member-remove / addswipe / delswipe║
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

/* ═══════════════════════════════════════════════════════════════════════════
   命令处理器
   ═══════════════════════════════════════════════════════════════════════════ */

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
