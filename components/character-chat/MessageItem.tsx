/**
 * @input  @/components, @/utils
 * @output MessageItem, Message, MemoizedMessageItem
 * @pos    角色对话交互组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Message Item Component                             ║
 * ║                                                                            ║
 * ║  单条消息渲染：用户消息 vs 助手消息                                         ║
 * ║  设计原则：只渲染故事内容，不接触 TavernHelper 脚本字段                     ║
 * ║  【性能优化】使用 React.memo 避免不必要的重渲染                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useCallback } from "react";
import MessageBubble from "@/components/MessageBubble";
import ThinkBubble from "@/components/ThinkBubble";
import { trackButtonClick } from "@/utils/google-analytics";
import type { ChatStreamingIntent } from "./streaming-types";
import {
  MessageHeader,
  normalizeRole,
  pickRoleTone,
  renderRoleLabel,
} from "./message-item/presentation";
import type {
  Message,
  MessageCharacter,
  MessageRoleKind,
} from "./message-item/types";

export type { Message, MessageCharacter } from "./message-item/types";

// ============================================================================
//                              类型定义
// ============================================================================

interface MessageItemProps {
  message: Message;
  index: number;
  character: MessageCharacter;
  isLastMessage: boolean;
  streamingIntent: ChatStreamingIntent;
  onTruncate: (id: string) => void;
  onRegenerate: (id: string) => void;
  fontClass: string;
  serifFontClass: string;
  t: (key: string) => string;
  headerSlot?: React.ReactNode;
  onAppendInput?: (value: string) => void;
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  系统/旁白/自定义角色消息渲染                                      ║
// ╚══════════════════════════════════════════════════════════════════╝

interface RoleMessageProps {
  message: Message;
  index: number;
  roleKind: Exclude<MessageRoleKind, "assistant">;
}

function RoleMessage({
  message,
  index,
  roleKind,
}: RoleMessageProps) {
  const tone = pickRoleTone(roleKind);
  const displayName = (message.name || "").trim();
  return (
    <div
      className="flex justify-start mb-4"
      data-session-message-id={message.id}
      data-session-message-index={index}
    >
      <div className="max-w-3xl w-full space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`px-2 py-0.5 rounded-full border ${tone.badgeBg} ${tone.badgeText} ${tone.badgeBorder}`}>
            {renderRoleLabel(message.role)}
          </span>
          {displayName ? <span className="text-sm font-medium text-foreground">{displayName}</span> : null}
          <span className="text-[11px] uppercase tracking-wide">{tone.caption}</span>
        </div>
        <div className={`rounded-lg border px-4 py-3 shadow-sm ${tone.bodyBg} ${tone.bodyBorder}`}>
          <MessageBubble
            html={message.content}
            characterId={message.role}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
//                              主组件
// ============================================================================

export default function MessageItem({
  message,
  index,
  character,
  isLastMessage,
  streamingIntent,
  onTruncate,
  onRegenerate,
  fontClass,
  serifFontClass,
  t,
  headerSlot,
  onAppendInput,
}: MessageItemProps) {
  // 用户消息直接返回简化版
  if (message.role === "user") {
    return <UserMessage message={message} index={index} serifFontClass={serifFontClass} />;
  }

  // 系统 / 旁白 / 自定义角色消息
  const roleKind = normalizeRole(message.role);
  if (roleKind !== "assistant") {
    return (
      <RoleMessage
        message={message}
        index={index}
        roleKind={roleKind}
      />
    );
  }

  // 助手消息需要完整渲染
  return (
    <AssistantMessage
      message={message}
      index={index}
      character={character}
      isLastMessage={isLastMessage}
      streamingIntent={streamingIntent}
      onTruncate={onTruncate}
      onRegenerate={onRegenerate}
      fontClass={fontClass}
      serifFontClass={serifFontClass}
      t={t}
      headerSlot={headerSlot}
      onAppendInput={onAppendInput}
    />
  );
}

// ============================================================================
//                              用户消息
// ============================================================================

interface UserMessageProps {
  message: Message;
  index: number;
  serifFontClass: string;
}

function UserMessage({ message, index, serifFontClass }: UserMessageProps) {
  const extractedContent = extractUserContent(message.content);

  return (
    <div
      className="flex justify-end mb-4"
      data-session-message-id={message.id}
      data-session-message-index={index}
    >
      <div className="max-w-md lg:max-w-2xl break-words whitespace-pre-line text-cream story-text leading-relaxed magical-text">
        <p
          className={serifFontClass}
          dangerouslySetInnerHTML={{ __html: extractedContent }}
        />
      </div>
    </div>
  );
}

/**
 * 提取用户消息内容
 * 
 * 【兼容性】支持两种格式：
 * 1. 带 <input_message> 标签的消息（正常发送）
 * 2. 纯文本消息（/send 命令添加）
 */
function extractUserContent(content: string): string {
  const match = content.match(/<input_message>([\s\S]*?)<\/input_message>/);
  // 如果没有 <input_message> 标签，直接使用原始内容
  const extracted = match?.[1] ?? content;
  return extracted.replace(
    /^[\s\n\r]*((<[^>]+>\s*)*)?(玩家输入指令|Player Input)[:：]\s*/i,
    "",
  );
}

// ============================================================================
//                              助手消息
// ============================================================================

interface AssistantMessageProps {
  message: Message;
  index: number;
  character: MessageCharacter;
  isLastMessage: boolean;
  streamingIntent: ChatStreamingIntent;
  onTruncate: (id: string) => void;
  onRegenerate: (id: string) => void;
  fontClass: string;
  serifFontClass: string;
  t: (key: string) => string;
  headerSlot?: React.ReactNode;
  onAppendInput?: (value: string) => void;
}

function AssistantMessage({
  message,
  index,
  character,
  isLastMessage,
  streamingIntent,
  onTruncate,
  onRegenerate,
  fontClass,
  serifFontClass,
  t,
  headerSlot,
  onAppendInput,
}: AssistantMessageProps) {
  const { enabled, targetIndex, isSending, activeMessageId } = streamingIntent;
  const isStoryAgent = typeof character.extensions?.storyBlueprintId === "string";
  const showRegenerateButton = !isSending && isLastMessage;
  const isStreamingCandidate = enabled && index >= targetIndex;
  const isActivelyStreaming = (
    isStreamingCandidate &&
    isSending &&
    isLastMessage &&
    activeMessageId === message.id
  );

  const handleTruncate = useCallback(() => {
    trackButtonClick("page", "跳转到此消息");
    onTruncate(message.id);
  }, [message.id, onTruncate]);

  const handleRegenerate = useCallback(() => {
    trackButtonClick("page", "重新生成消息");
    onRegenerate(message.id);
  }, [message.id, onRegenerate]);

  return (
    <div
      className="mb-6"
      data-session-message-id={message.id}
      data-session-message-index={index}
    >
      {/* 消息头部 */}
      <MessageHeader
        character={character}
        showRegenerateButton={showRegenerateButton}
        onTruncate={handleTruncate}
        onRegenerate={handleRegenerate}
        t={t}
        headerSlot={headerSlot}
      />

      {/* 思考气泡 */}
      <ThinkBubble
        thinkingContent={message.thinkingContent || ""}
        characterName={character.name}
        fontClass={fontClass}
        serifFontClass={serifFontClass}
        t={t}
      />

      {/* 消息内容 */}
      <MessageBubble
        key={message.id}
        html={message.content}
        characterId={character.id}
        renderMode={isStoryAgent ? "story" : "legacy"}
        renderIntents={character.extensions?.storyRenderIntents || []}
        onAppendInput={onAppendInput}
        isLoading={isSending && isLastMessage && message.content.trim() === ""}
        enableStreaming={isActivelyStreaming}
      />
    </div>
  );
}

// ============================================================================
//                              Memo 化导出
// ============================================================================

/**
 * 【性能优化】MessageItem memo 化
 * 
 * 只有以下情况才重新渲染：
 * 1. 消息 ID 或内容变化
 * 2. isLastMessage 状态变化（影响操作按钮显示）
 * 3. isSending 状态变化（仅对最后一条消息有效）
 * 4. 流式传输相关状态变化（仅对最后一条消息有效）
 */
export const MemoizedMessageItem = React.memo(MessageItem, (prev, next) => {
  // 消息本身变化 → 必须重渲染
  if (prev.message.id !== next.message.id) return false;
  if (prev.message.content !== next.message.content) return false;
  if (prev.message.thinkingContent !== next.message.thinkingContent) return false;
  
  // 位置状态变化 → 必须重渲染
  if (prev.isLastMessage !== next.isLastMessage) return false;
  
  // 角色信息变化 → 必须重渲染
  if (prev.character.id !== next.character.id) return false;
  
  // ═══════════════════════════════════════════════════════════════
  // 【关键优化】以下状态只对最后一条消息有意义
  // 非最后一条消息不需要因为这些状态变化而重渲染
  // ═══════════════════════════════════════════════════════════════
  if (next.isLastMessage) {
    if (prev.streamingIntent.isSending !== next.streamingIntent.isSending) return false;
    if (prev.streamingIntent.enabled !== next.streamingIntent.enabled) return false;
    if (prev.streamingIntent.targetIndex !== next.streamingIntent.targetIndex) return false;
    if (prev.streamingIntent.activeMessageId !== next.streamingIntent.activeMessageId) return false;
  }
  
  // 其他情况 → 跳过重渲染
  return true;
});
