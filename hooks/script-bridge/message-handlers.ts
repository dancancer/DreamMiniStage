/**
 * @input  hooks/script-bridge/types, types/character-dialogue
 * @output messageHandlers
 * @pos    消息操作 Handlers - SillyTavern 兼容的聊天消息 CRUD
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         消息操作 Handlers                                  ║
 * ║                                                                            ║
 * ║  SillyTavern 兼容层：                                                       ║
 * ║  • getChatMessages()              - 获取所有聊天消息 (Req 4.1)              ║
 * ║  • setChatMessages(messages)      - 更新指定消息 (Req 4.2)                  ║
 * ║  • setChatMessage(data, id)       - 旧版单条消息写接口 (Req 4.2 compat)     ║
 * ║  • createChatMessages(messages)   - 追加新消息 (Req 4.3)                    ║
 * ║  • deleteChatMessages(messageIds) - 删除指定消息 (Req 4.4)                  ║
 * ║  • rotateChatMessages()           - 旧版区间旋转接口 (Req 4.4 compat)       ║
 * ║  • refreshOneMessage(messageId)   - 单条消息刷新事件 (compat)               ║
 * ║  • getCurrentMessageId()          - 获取最新消息 ID (Req 4.5)               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiCallContext, ApiHandlerMap } from "./types";
import type { DialogueMessage } from "@/types/character-dialogue";

// ============================================================================
//                              类型定义
// ============================================================================

interface SetMessagePayload {
  message_id: string | number;
  [key: string]: unknown;
}

interface CreateMessagePayload {
  role: "user" | "assistant";
  content: string;
  id?: string;
}

interface SetMessagesOptions {
  refresh?: "none" | "affected" | "all";
}

interface SetChatMessageOptions {
  swipe_id?: "current" | number;
  refresh?: "none" | "display_current" | "display_and_render_current" | "all";
}

interface RotateChatMessagesOptions {
  refresh?: "none" | "all";
}

// ============================================================================
//                              消息查询
// ============================================================================

/**
 * 获取所有聊天消息
 * Requirements: 4.1
 */
function getChatMessages(_args: unknown[], ctx: ApiCallContext): DialogueMessage[] {
  return ctx.messages;
}

/**
 * 获取最新消息 ID
 * Requirements: 4.5
 */
function getCurrentMessageId(_args: unknown[], ctx: ApiCallContext): string | null {
  if (ctx.messages.length === 0) return null;
  return ctx.messages[ctx.messages.length - 1]?.id ?? null;
}

function resolveMessageIndex(rawMessageId: unknown, messages: DialogueMessage[]): number {
  if (messages.length === 0) {
    throw new Error("refreshOneMessage requires at least one message");
  }

  if (rawMessageId === undefined || rawMessageId === null || rawMessageId === "last") {
    return messages.length - 1;
  }

  if (typeof rawMessageId === "number" && Number.isInteger(rawMessageId)) {
    if (rawMessageId < 0 || rawMessageId >= messages.length) {
      throw new Error(`refreshOneMessage message_id out of range: ${rawMessageId}`);
    }
    return rawMessageId;
  }

  if (typeof rawMessageId === "string") {
    const byIdIndex = messages.findIndex((message) => message.id === rawMessageId);
    if (byIdIndex >= 0) {
      return byIdIndex;
    }
  }

  throw new Error("refreshOneMessage requires message_id (index|id|'last')");
}

// ============================================================================
//                              消息更新
// ============================================================================

/**
 * 更新指定消息
 * Requirements: 4.2
 *
 * 通过事件通知父组件更新消息内容
 * 支持批量更新多条消息
 */
function setChatMessages(args: unknown[], ctx: ApiCallContext): boolean {
  const [chatMessages, options] = args as [SetMessagePayload[], SetMessagesOptions?];
  if (!Array.isArray(chatMessages)) return false;

  window.dispatchEvent(
    new CustomEvent("DreamMiniStage:setChatMessages", {
      detail: {
        messages: chatMessages,
        options: options || {},
        characterId: ctx.characterId,
      },
    }),
  );
  return true;
}

function normalizeLegacyRefreshMode(
  refresh: SetChatMessageOptions["refresh"] | RotateChatMessagesOptions["refresh"],
): SetMessagesOptions["refresh"] {
  if (refresh === "none") {
    return "none";
  }
  if (refresh === "all") {
    return "all";
  }
  return "affected";
}

function setChatMessage(args: unknown[], ctx: ApiCallContext): boolean {
  const [rawFieldValues, rawMessageId, rawOptions] = args as [
    string | { message?: string; data?: Record<string, unknown>; extra?: Record<string, unknown> },
    number,
    SetChatMessageOptions?,
  ];

  if (typeof rawMessageId !== "number" || !Number.isFinite(rawMessageId)) {
    throw new Error("setChatMessage requires numeric message_id");
  }

  const options = rawOptions || {};
  if (options.swipe_id !== undefined && options.swipe_id !== "current") {
    throw new Error("setChatMessage currently supports swipe_id='current' only");
  }

  const fieldValues = typeof rawFieldValues === "string"
    ? { message: rawFieldValues }
    : rawFieldValues;
  if (!fieldValues || typeof fieldValues !== "object") {
    throw new Error("setChatMessage requires field values object or string message");
  }

  const payload: SetMessagePayload = {
    message_id: String(rawMessageId),
  };

  if (fieldValues.message !== undefined) {
    payload.message = fieldValues.message;
  }
  if (fieldValues.data !== undefined) {
    payload.data = fieldValues.data;
  }
  if (fieldValues.extra !== undefined) {
    payload.extra = fieldValues.extra;
  }

  return setChatMessages(
    [
      [payload],
      {
        refresh: normalizeLegacyRefreshMode(options.refresh),
      },
    ],
    ctx,
  );
}

// ============================================================================
//                              消息创建
// ============================================================================

/**
 * 追加新消息到聊天
 * Requirements: 4.3
 *
 * 通过事件通知父组件创建新消息
 * 返回创建的消息 ID 数组
 */
function createChatMessages(args: unknown[], ctx: ApiCallContext): string[] {
  const [messages] = args as [CreateMessagePayload[]];
  if (!Array.isArray(messages)) return [];

  // 为每条消息生成 ID（如果未提供）
  const messagesWithIds = messages.map((msg) => ({
    id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role: msg.role,
    content: msg.content,
  }));

  window.dispatchEvent(
    new CustomEvent("DreamMiniStage:createChatMessages", {
      detail: {
        messages: messagesWithIds,
        characterId: ctx.characterId,
      },
    }),
  );

  return messagesWithIds.map((m) => m.id);
}

// ============================================================================
//                              消息删除
// ============================================================================

/**
 * 删除指定消息
 * Requirements: 4.4
 *
 * 通过事件通知父组件删除消息
 * 支持批量删除多条消息
 */
function deleteChatMessages(args: unknown[], ctx: ApiCallContext): boolean {
  const [messageIds] = args as [string[]];
  if (!Array.isArray(messageIds)) return false;

  window.dispatchEvent(
    new CustomEvent("DreamMiniStage:deleteChatMessages", {
      detail: {
        messageIds,
        characterId: ctx.characterId,
      },
    }),
  );

  return true;
}

function normalizeRotationIndex(index: number, length: number): number {
  if (!Number.isInteger(index)) {
    throw new Error("rotateChatMessages expects integer indices");
  }
  return Math.min(Math.max(index, 0), length);
}

function rotateChatMessages(args: unknown[], ctx: ApiCallContext): string[] {
  const [beginRaw, middleRaw, endRaw, rawOptions] = args as [
    number,
    number,
    number,
    RotateChatMessagesOptions?,
  ];
  const total = ctx.messages.length;
  const begin = normalizeRotationIndex(beginRaw, total);
  const middle = normalizeRotationIndex(middleRaw, total);
  const end = normalizeRotationIndex(endRaw, total);

  if (!(begin <= middle && middle <= end)) {
    throw new Error("rotateChatMessages expects begin <= middle <= end");
  }
  if (begin === middle || middle === end) {
    return [];
  }

  const rotatingRange = ctx.messages.slice(begin, end);
  const offset = middle - begin;
  const rotated = rotatingRange.slice(offset).concat(rotatingRange.slice(0, offset));
  const affected = ctx.messages.slice(begin, end);
  const updates = affected.map((message, index) => {
    const next = rotated[index];
    return {
      message_id: message.id,
      message: next?.content ?? "",
      name: next?.name,
      role: next?.role,
    };
  });

  setChatMessages(
    [
      updates,
      {
        refresh: normalizeLegacyRefreshMode(rawOptions?.refresh),
      },
    ],
    ctx,
  );

  return updates.map((item) => String(item.message_id));
}

function refreshOneMessage(args: unknown[], ctx: ApiCallContext): boolean {
  const [rawMessageId] = args as [unknown];
  const messageIndex = resolveMessageIndex(rawMessageId, ctx.messages);
  const message = ctx.messages[messageIndex];
  if (!message) {
    return false;
  }

  window.dispatchEvent(
    new CustomEvent("DreamMiniStage:refreshOneMessage", {
      detail: {
        message_id: message.id,
        index: messageIndex,
        message,
        characterId: ctx.characterId,
      },
    }),
  );

  return true;
}

// ============================================================================
//                              事件发射
// ============================================================================

/**
 * 发射自定义事件
 * 用于脚本间通信
 */
function eventEmit(args: unknown[]): string {
  const [eventName, ...eventData] = args as [string, ...unknown[]];
  window.dispatchEvent(
    new CustomEvent(`DreamMiniStage:${eventName}`, {
      detail: eventData.length === 1 ? eventData[0] : eventData,
    }),
  );
  return eventName;
}

// ============================================================================
//                              导出 Handler Map
// ============================================================================

export const messageHandlers: ApiHandlerMap = {
  // 消息查询 API
  "getChatMessages": getChatMessages,
  "getCurrentMessageId": getCurrentMessageId,

  // 消息操作 API
  "setChatMessages": setChatMessages,
  "setChatMessage": setChatMessage,
  "createChatMessages": createChatMessages,
  "deleteChatMessages": deleteChatMessages,
  "rotateChatMessages": rotateChatMessages,
  "refreshOneMessage": refreshOneMessage,

  // 事件 API（兼容）
  "eventEmit": eventEmit,
  "events.emit": eventEmit,
};
