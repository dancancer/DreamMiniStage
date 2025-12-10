/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Message Item Component                             ║
 * ║                                                                            ║
 * ║  单条消息渲染：用户消息 vs 助手消息                                         ║
 * ║  设计原则：用条件渲染替代重复代码，组合优于继承                              ║
 * ║  【性能优化】使用 React.memo 避免不必要的重渲染                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useCallback } from "react";
import { ArrowUp, RefreshCw, User } from "lucide-react";
import MessageBubble from "@/components/MessageBubble";
import ThinkBubble from "@/components/ThinkBubble";
import { CharacterAvatarBackground } from "@/components/CharacterAvatarBackground";
import { trackButtonClick } from "@/utils/google-analytics";
import { Button } from "@/components/ui/button";
import type { TavernHelperScript } from "@/lib/models/character-model";
import type { ScriptMessageData } from "@/types/script-message";

// ============================================================================
//                              类型定义
// ============================================================================

export interface Message {
  id: string;
  role: string;
  thinkingContent?: string;
  content: string;
  timestamp?: string;
  isUser?: boolean;
}

interface Character {
  id: string;
  name: string;
  avatar_path?: string;
  extensions?: {
    TavernHelper_scripts?: TavernHelperScript[];
    [key: string]: unknown;
  };
}

interface MessageItemProps {
  message: Message;
  index: number;
  character: Character;
  isLastMessage: boolean;
  isSending: boolean;
  enableStreaming: boolean;
  streamingTarget: number;
  onTruncate: (id: string) => void;
  onRegenerate: (id: string) => void;
  onContentChange?: () => void;
  fontClass: string;
  serifFontClass: string;
  t: (key: string) => string;
  headerSlot?: React.ReactNode;
  scriptVariables?: Record<string, unknown>;
  onScriptMessage?: (data: ScriptMessageData) => Promise<unknown> | unknown;
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  系统/旁白/自定义角色消息渲染                                      ║
// ╚══════════════════════════════════════════════════════════════════╝

interface RoleMessageProps {
  message: Message;
  roleKind: "system" | "narrator" | "custom";
  scriptVariables?: Record<string, unknown>;
  onScriptMessage?: (data: ScriptMessageData) => Promise<unknown> | unknown;
}

function RoleMessage({
  message,
  roleKind,
  scriptVariables,
  onScriptMessage,
}: RoleMessageProps) {
  const tone = pickRoleTone(roleKind);
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-3xl w-full space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`px-2 py-0.5 rounded-full border ${tone.badgeBg} ${tone.badgeText} ${tone.badgeBorder}`}>
            {renderRoleLabel(message.role)}
          </span>
          <span className="text-[11px] uppercase tracking-wide">{tone.caption}</span>
        </div>
        <div className={`rounded-lg border px-4 py-3 shadow-sm ${tone.bodyBg} ${tone.bodyBorder}`}>
          <MessageBubble
            html={message.content}
            characterId={message.role}
            onScriptMessage={onScriptMessage}
            scriptVariables={scriptVariables}
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
  isSending,
  enableStreaming,
  streamingTarget,
  onTruncate,
  onRegenerate,
  onContentChange,
  fontClass,
  serifFontClass,
  t,
  headerSlot,
  scriptVariables,
  onScriptMessage,
}: MessageItemProps) {
  // 用户消息直接返回简化版
  if (message.role === "user") {
    return <UserMessage message={message} serifFontClass={serifFontClass} />;
  }

  // 系统 / 旁白 / 自定义角色消息
  const roleKind = normalizeRole(message.role);
  if (roleKind !== "assistant") {
    return (
      <RoleMessage
        message={message}
        roleKind={roleKind}
        scriptVariables={scriptVariables}
        onScriptMessage={onScriptMessage}
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
      isSending={isSending}
      enableStreaming={enableStreaming}
      streamingTarget={streamingTarget}
      onTruncate={onTruncate}
      onRegenerate={onRegenerate}
      onContentChange={onContentChange}
      fontClass={fontClass}
      serifFontClass={serifFontClass}
      t={t}
      headerSlot={headerSlot}
      scriptVariables={scriptVariables}
      onScriptMessage={onScriptMessage}
    />
  );
}

// ============================================================================
//                              用户消息
// ============================================================================

interface UserMessageProps {
  message: Message;
  serifFontClass: string;
}

function UserMessage({ message, serifFontClass }: UserMessageProps) {
  const extractedContent = extractUserContent(message.content);

  return (
    <div className="flex justify-end mb-4">
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
  character: Character;
  isLastMessage: boolean;
  isSending: boolean;
  enableStreaming: boolean;
  streamingTarget: number;
  onTruncate: (id: string) => void;
  onRegenerate: (id: string) => void;
  onContentChange?: () => void;
  fontClass: string;
  serifFontClass: string;
  t: (key: string) => string;
  headerSlot?: React.ReactNode;
  scriptVariables?: Record<string, unknown>;
  onScriptMessage?: (data: ScriptMessageData) => Promise<unknown> | unknown;
}

function AssistantMessage({
  message,
  index,
  character,
  isLastMessage,
  isSending,
  enableStreaming,
  streamingTarget,
  onTruncate,
  onRegenerate,
  onContentChange,
  fontClass,
  serifFontClass,
  t,
  headerSlot,
  scriptVariables,
  onScriptMessage,
}: AssistantMessageProps) {
  const showRegenerateButton = !isSending && isLastMessage;

  const handleTruncate = useCallback(() => {
    trackButtonClick("page", "跳转到此消息");
    onTruncate(message.id);
  }, [message.id, onTruncate]);

  const handleRegenerate = useCallback(() => {
    trackButtonClick("page", "重新生成消息");
    onRegenerate(message.id);
  }, [message.id, onRegenerate]);

  return (
    <div className="mb-6">
      {/* 消息头部 */}
      <MessageHeader
        character={character}
        serifFontClass={serifFontClass}
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
        scripts={character.extensions?.TavernHelper_scripts || []}
        scriptVariables={scriptVariables}
        isLoading={isSending && isLastMessage && message.content.trim() === ""}
        enableStreaming={enableStreaming && index >= streamingTarget}
        onContentChange={isLastMessage ? onContentChange : undefined}
        enableScript={true}
        onScriptMessage={onScriptMessage}
      />
    </div>
  );
}

// ============================================================================
//                              消息头部
// ============================================================================

interface MessageHeaderProps {
  character: Character;
  serifFontClass: string;
  showRegenerateButton: boolean;
  onTruncate: () => void;
  onRegenerate: () => void;
  t: (key: string) => string;
  headerSlot?: React.ReactNode;
}

function MessageHeader({
  character,
  serifFontClass,
  showRegenerateButton,
  onTruncate,
  onRegenerate,
  t,
  headerSlot,
}: MessageHeaderProps) {
  return (
    <div className="flex items-center mb-2">
      {/* 头像 */}
      <div className="w-8 h-8 rounded-full overflow-hidden mr-2">
        {character.avatar_path ? (
          <CharacterAvatarBackground avatarPath={character.avatar_path} />
        ) : (
          <DefaultAvatar />
        )}
      </div>

      {/* 名称和控制按钮 */}
      <div className="flex items-center">
        <span className={"text-sm font-medium text-cream "}>
          {character.name}
        </span>
        {showRegenerateButton && headerSlot}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center">
        <ActionButton
          onClick={onTruncate}
          tooltip={t("characterChat.jumpToMessage")}
          icon={<TruncateIcon />}
          hoverColor="green"
        />
        {showRegenerateButton && (
          <ActionButton
            onClick={onRegenerate}
            tooltip={t("characterChat.regenerateMessage")}
            icon={<RegenerateIcon />}
            hoverColor="orange"
          />
        )}
      </div>
    </div>
  );
}

function DefaultAvatar() {
  return (
    <div className="w-full h-full flex items-center justify-center ">
      <User className="h-4 w-4 text-ink" />
    </div>
  );
}

// ============================================================================
//                              操作按钮
// ============================================================================

interface ActionButtonProps {
  onClick: () => void;
  tooltip: string;
  icon: React.ReactNode;
  hoverColor: "green" | "orange";
}

function ActionButton({ onClick, tooltip, icon, hoverColor }: ActionButtonProps) {
  const colorClass = hoverColor === "green"
    ? "hover:text-green-400 hover:shadow-[0_0_8px_rgba(34,197,94,0.4)]"
    : "hover:text-orange-400 hover:shadow-[0_0_8px_rgba(249,115,22,0.4)]";

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      className={`ml-1 h-6 w-6 text-ink-soft bg-surface border-stroke hover:border-stroke-strong group relative ${colorClass}`}
      data-tooltip={tooltip}
    >
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-overlay text-cream text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap border border-border">
        {tooltip}
      </div>
      {icon}
    </Button>
  );
}

function TruncateIcon() {
  return <ArrowUp className="w-3 h-3" />;
}

function RegenerateIcon() {
  return <RefreshCw className="w-3 h-3" />;
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  角色辅助函数                                                     ║
// ╚══════════════════════════════════════════════════════════════════╝

function normalizeRole(role: string): "assistant" | "system" | "narrator" | "custom" {
  const key = (role || "").toLowerCase();
  if (key === "user") return "assistant"; // 已在上层过滤，这里兜底
  if (key === "assistant" || key === "impersonate") return "assistant";
  if (key === "system" || key === "sys") return "system";
  if (key === "narrator" || key === "comment") return "narrator";
  return "custom";
}

function pickRoleTone(role: "system" | "narrator" | "custom") {
  if (role === "system") {
    return {
      badgeBg: "bg-muted",
      badgeText: "text-muted-foreground",
      badgeBorder: "border-border",
      bodyBg: "bg-muted/60",
      bodyBorder: "border-border",
      caption: "SYSTEM MESSAGE",
    };
  }
  if (role === "narrator") {
    return {
      badgeBg: "bg-sidebar",
      badgeText: "text-foreground",
      badgeBorder: "border-border/60",
      bodyBg: "bg-sidebar",
      bodyBorder: "border-border/60",
      caption: "NARRATOR",
    };
  }
  return {
    badgeBg: "bg-card",
    badgeText: "text-foreground",
    badgeBorder: "border-border",
    bodyBg: "bg-card",
    bodyBorder: "border-border",
    caption: "CUSTOM ROLE",
  };
}

function renderRoleLabel(role: string): string {
  if (!role) return "role";
  return role.length > 16 ? `${role.slice(0, 15)}…` : role;
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
    // 发送状态变化 → 最后一条消息需要重渲染（显示加载指示器）
    if (prev.isSending !== next.isSending) return false;
    
    // 流式传输状态变化 → 最后一条消息需要重渲染
    if (prev.enableStreaming !== next.enableStreaming) return false;
    if (prev.streamingTarget !== next.streamingTarget) return false;
  }
  
  // 其他情况 → 跳过重渲染
  return true;
});
