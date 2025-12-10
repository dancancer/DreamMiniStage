/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         消息操作 Handlers                                  ║
 * ║                                                                            ║
 * ║  SillyTavern 兼容层：                                                       ║
 * ║  • getChatMessages()              - 获取所有聊天消息 (Req 4.1)              ║
 * ║  • setChatMessages(messages)      - 更新指定消息 (Req 4.2)                  ║
 * ║  • createChatMessages(messages)   - 追加新消息 (Req 4.3)                    ║
 * ║  • deleteChatMessages(messageIds) - 删除指定消息 (Req 4.4)                  ║
 * ║  • getCurrentMessageId()          - 获取最新消息 ID (Req 4.5)               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiCallContext, ApiHandlerMap } from "./types";
import type { DialogueMessage } from "@/types/character-dialogue";

// ============================================================================
//                              类型定义
// ============================================================================

interface SetMessagePayload {
  message_id: string;
  message?: string;
  data?: Record<string, unknown>;
}

interface CreateMessagePayload {
  role: "user" | "assistant";
  content: string;
  id?: string;
}

interface SetMessagesOptions {
  refresh?: "none" | "affected" | "all";
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
    })
  );
  return true;
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
    })
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
    })
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
    })
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
  "createChatMessages": createChatMessages,
  "deleteChatMessages": deleteChatMessages,

  // 事件 API（兼容）
  "eventEmit": eventEmit,
  "events.emit": eventEmit,
};
