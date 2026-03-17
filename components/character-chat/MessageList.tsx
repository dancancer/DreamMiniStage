/**
 * @input  @/components
 * @output MessageList
 * @pos    角色对话交互组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Message List Component                             ║
 * ║                                                                            ║
 * ║  消息列表容器：滚动管理、空状态、开场白导航、加载指示器                       ║
 * ║  职责单一：只负责消息列表的布局和滚动行为                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { MemoizedMessageItem, type Message } from "./MessageItem";
import { Button } from "@/components/ui/button";
import type { TavernHelperScript } from "@/lib/models/character-model";
import type { ChatStreamingIntent } from "./streaming-types";
// ============================================================================
//                              类型定义
// ============================================================================

import type { ScriptMessageData } from "@/types/script-message";

interface Character {
  id: string;
  name: string;
  avatar_path?: string;
  extensions?: {
    TavernHelper_scripts?: TavernHelperScript[];
    [key: string]: unknown;
  };
}

interface OpeningMessage {
  id: string;
  content: string;
}

interface MessageListProps {
  messages: Message[];
  character: Character;
  openingMessages: OpeningMessage[];
  openingIndex: number;
  openingLocked: boolean;
  streamingIntent: ChatStreamingIntent;
  onTruncate: (id: string) => void;
  onRegenerate: (id: string) => void;
  onOpeningNavigate: (direction: "prev" | "next") => void;
  fontClass: string;
  serifFontClass: string;
  t: (key: string) => string;
  renderHeaderSlot?: (message: Message, index: number) => React.ReactNode;
  scriptVariables?: Record<string, unknown>;
  onScriptMessage?: (data: ScriptMessageData) => Promise<unknown> | unknown;
}

// ============================================================================
//                              主组件
// ============================================================================

export default function MessageList({
  messages,
  character,
  openingMessages,
  openingIndex,
  openingLocked,
  streamingIntent,
  onTruncate,
  onRegenerate,
  onOpeningNavigate,
  fontClass,
  serifFontClass,
  t,
  renderHeaderSlot,
  scriptVariables,
  onScriptMessage,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  // 条件滚动（仅当接近底部时）
  const maybeScrollToBottom = useCallback((threshold = 120) => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance < threshold) {
      scrollToBottom();
    }
  }, [scrollToBottom]);

  // 消息变化时滚动
  useEffect(() => {
    const id = setTimeout(scrollToBottom, 300);
    return () => clearTimeout(id);
  }, [messages, scrollToBottom]);

  const visibleMessages = messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => !message.hidden && message.role !== "sample");

  // 显示开场白导航条件（未锁定且仅有开场消息时）
  const showOpeningNav =
    !openingLocked &&
    openingMessages.length > 1 &&
    visibleMessages.length === 1 &&
    visibleMessages[0]?.message.role === "assistant";

  return (
    <div
      className="grow overflow-y-auto pt-6 px-6 pb-2 -mb-4"
      ref={scrollRef}
    >
      <div className="max-w-4xl mx-auto">
        {visibleMessages.length === 0 ? (
          <EmptyState serifFontClass={serifFontClass} t={t} />
        ) : (
          <div className="space-y-8">
            {/* 消息列表 - 使用 message.id 作为 key 实现增量更新 */}
            {visibleMessages.map(({ message, index: messageIndex }, visibleIndex) => {
              return (
                <MemoizedMessageItem
                  key={message.id}
                  message={message}
                  index={messageIndex}
                  character={character}
                  isLastMessage={visibleIndex === visibleMessages.length - 1}
                  streamingIntent={streamingIntent}
                  onTruncate={onTruncate}
                  onRegenerate={onRegenerate}
                  onContentChange={visibleIndex === visibleMessages.length - 1 ? maybeScrollToBottom : undefined}
                  fontClass={fontClass}
                  serifFontClass={serifFontClass}
                  t={t}
                  scriptVariables={scriptVariables}
                  onScriptMessage={onScriptMessage}
                  headerSlot={renderHeaderSlot?.(message, messageIndex)}
                />
              );
            })}

            {/* 开场白导航（展示在开场消息底部） */}
            {showOpeningNav && (
              <OpeningNavigator
                openingIndex={openingIndex}
                totalOpenings={openingMessages.length}
                onNavigate={onOpeningNavigate}
                isSending={streamingIntent.isSending}
                serifFontClass={serifFontClass}
                t={t}
              />
            )}

            {/* 加载指示器 */}
            {streamingIntent.isSending && (
              <TypingIndicator characterName={character.name} serifFontClass={serifFontClass} t={t} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
//                              子组件
// ============================================================================

interface EmptyStateProps {
  serifFontClass: string;
  t: (key: string) => string;
}

function EmptyState({ serifFontClass, t }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 opacity-60 text-primary-bright">
        <MessageCircle size={64} strokeWidth={1.5} />
      </div>
      <p className={"text-primary-soft "}>
        {t("characterChat.startConversation")}
      </p>
    </div>
  );
}

interface OpeningNavigatorProps {
  openingIndex: number;
  totalOpenings: number;
  onNavigate: (direction: "prev" | "next") => void;
  isSending: boolean;
  serifFontClass: string;
  t: (key: string) => string;
}

function OpeningNavigator({
  openingIndex,
  totalOpenings,
  onNavigate,
  isSending,
  serifFontClass,
  t,
}: OpeningNavigatorProps) {
  return (
    <div className="flex items-center justify-center gap-3 text-primary-soft">
      <NavButton direction="prev" onClick={() => onNavigate("prev")} disabled={isSending} />
      <span className={"text-sm "}>
        {t("firstMessage") || "开场白"} {openingIndex + 1}/{totalOpenings}
      </span>
      <NavButton direction="next" onClick={() => onNavigate("next")} disabled={isSending} />
    </div>
  );
}

interface NavButtonProps {
  direction: "prev" | "next";
  onClick: () => void;
  disabled: boolean;
}

function NavButton({ direction, onClick, disabled }: NavButtonProps) {
  const isPrev = direction === "prev";
  const Icon = isPrev ? ChevronLeft : ChevronRight;

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      className="h-8 w-8 border-border bg-surface hover:border-border hover:text-primary-bright"
      aria-label={isPrev ? "切换上一条开场" : "切换下一条开场"}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

interface TypingIndicatorProps {
  characterName: string;
  serifFontClass: string;
  t: (key: string) => string;
}

function TypingIndicator({ characterName, serifFontClass, t }: TypingIndicatorProps) {
  return (
    <div className="flex items-center space-x-2 text-primary-soft mb-8 pb-4 pt-2 min-h-[40px]">
      <div className="relative w-6 h-6 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-t-primary-bright border-r-primary-soft border-b-ink-soft border-l-transparent animate-spin" />
        <div className="absolute inset-1 rounded-full border-2 border-t-ink-soft border-r-primary-bright border-b-primary-soft border-l-transparent animate-spin-slow" />
      </div>
      <span className={"text-sm "}>
        {characterName} {t("characterChat.isTyping") || "is typing..."}
      </span>
    </div>
  );
}
