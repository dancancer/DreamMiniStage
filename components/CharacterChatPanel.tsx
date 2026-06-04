/**
 * @input  @/utils, @/hooks, @/components
 * @output CharacterChatPanel
 * @pos    角色对话主面板
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Character Chat Panel Component                        ║
 * ║                                                                           ║
 * ║  角色聊天面板：编排层组件，组合子组件实现完整功能                                 ║
 * ║  设计原则：组合 Story runtime，开场选择以 OpeningSelection 透传                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { getDisplayUsername, setDisplayUsername } from "@/utils/username-helper";
import { useApiConfig } from "@/hooks/useApiConfig";
import type {
  ScriptHostDebugSnapshot,
  ScriptHostDebugState,
} from "@/hooks/script-bridge/host-debug-state";
import type {
  MessageCallbacks,
  ChatManagementCallbacks,
  CheckpointCallbacks,
  GroupMemberCallbacks,
  ExpressionCallbacks,
  HostCapabilityCallbacks,
  WorldInfoCallbacks,
  NavigationCallbacks,
} from "@/types/slash-callback-domains";
import { useLocalStorageBoolean } from "@/hooks/useLocalStorage";
import { resolveStreamingEnabled } from "@/lib/model-runtime";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  OpeningDirection,
  OpeningSelection,
} from "@/types/character-dialogue";
import {
  SESSION_EXPORT_JSONL_EVENT,
  SESSION_IMPORT_JSONL_EVENT,
  SESSION_OPEN_SCRIPT_DEBUG_EVENT,
  SESSION_OPEN_USER_NAME_MODAL_EVENT,
} from "@/app/session/session-ui-events";

import {
  ApiSelector,
  ChatInput,
  MessageHeaderControls,
  MessageList,
  type Message,
  type MessageCharacter,
} from "@/components/character-chat";
import type { ChatStreamingIntent } from "@/components/character-chat/streaming-types";

const LazyUserNameSettingModal = dynamic(
  () => import("@/components/UserNameSettingModal"),
  {
    ssr: false,
    loading: () => null,
  },
);

const LazyScriptDebugPanel = dynamic(
  () => import("@/components/ScriptDebugPanel"),
  {
    ssr: false,
    loading: () => null,
  },
);

// ============================================================================
//                              类型定义
// ============================================================================

type Character = MessageCharacter & {
  personality?: string;
};

interface Props {
  character: Character;
  messages: Message[];
  openingSelection: OpeningSelection;
  userInput: string;
  setUserInput: (val: string) => void;
  isSending: boolean;
  suggestedInputs: string[];
  onSubmit: (e: React.FormEvent) => void;
  onSuggestedInput: (input: string) => void;
  onTruncate: (id: string) => void;
  onRegenerate: (id: string) => void;
  onOpeningNavigate: (direction: OpeningDirection) => void;
  fontClass: string;
  serifFontClass: string;
  t: (key: string) => string;
  activeModes: Record<string, unknown>;
  setActiveModes: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  language: "zh" | "en";
  // ─── 提示词查看器参数 ───
  dialogueKey?: string;
  chatName?: string;
  // ─── 域回调分组 ───
  messageCallbacks?: MessageCallbacks;
  chatManagementCallbacks?: ChatManagementCallbacks;
  checkpointCallbacks?: CheckpointCallbacks;
  groupMemberCallbacks?: GroupMemberCallbacks;
  expressionCallbacks?: ExpressionCallbacks;
  hostCapabilityCallbacks?: HostCapabilityCallbacks;
  worldInfoCallbacks?: WorldInfoCallbacks;
  navigationCallbacks?: NavigationCallbacks;
  // ─── debug & 杂项 ───
  hostCapabilitySources?: Partial<Record<
    "translation" | "youtubeTranscript" | "clipboardRead" | "clipboardWrite" | "extensionRead" | "extensionWrite" | "galleryList" | "galleryShow",
    "session-default" | "api-context"
  >>;
  hasHostOverrides?: boolean;
  hostDebug: ScriptHostDebugSnapshot;
  hostDebugState: ScriptHostDebugState;
  onHostDebugUpdate: (snapshot: ScriptHostDebugSnapshot) => void;
  onExportJsonl?: () => void | Promise<void>;
  onImportJsonl?: (file: File) => void | Promise<void>;
}

// ============================================================================
//                              主组件
// ============================================================================

export default function CharacterChatPanel({
  character,
  messages,
  openingSelection,
  userInput,
  setUserInput,
  isSending,
  suggestedInputs,
  onSubmit,
  onSuggestedInput,
  onTruncate,
  onRegenerate,
  onOpeningNavigate,
  fontClass,
  serifFontClass,
  t,
  activeModes,
  setActiveModes,
  messageCallbacks,
  hostDebug,
  onExportJsonl,
  onImportJsonl,
}: Props) {
  // ========== 状态管理 ==========
  const [showUserNameModal, setShowUserNameModal] = useState(false);
  const [showScriptDebugPanel, setShowScriptDebugPanel] = useState(false);
  const [lastSwipeTarget, setLastSwipeTarget] = useState<string | null>(null);
  const [currentDisplayName, setCurrentDisplayName] = useState("");
  const { value: fastModelEnabled, setValue: setFastModelEnabled } = useLocalStorageBoolean("fastModelEnabled", true);
  const userInputRef = useRef(userInput);

  // ========== 自定义 Hooks ==========
  const apiConfig = useApiConfig();
  const currentConfig = apiConfig.getCurrentConfig();
  const streamingEnabled = resolveStreamingEnabled(currentConfig?.advanced);

  const handleSwipe = useCallback(async (target?: string) => {
    if (messageCallbacks?.onSwipe) return messageCallbacks.onSwipe(target);
    setLastSwipeTarget(target ?? "next");
    return undefined;
  }, [messageCallbacks]);

  const handleAppendInput = useCallback((value: string) => {
    const action = value.trim();
    if (!action) return;
    const current = userInputRef.current.trim();
    setUserInput(current ? `${current} ${action}` : action);
  }, [setUserInput]);

  // ═══════════════════════════════════════════════════════════════
  // 初始化流式传输状态
  // ───────────────────────────────────────────────────────────────
  // 【优化】拆分职责：流式传输、快速模型、用户名各自独立管理
  // ═══════════════════════════════════════════════════════════════
  
  // 同步流式传输状态
  useEffect(() => {
    setActiveModes((prev) => (prev.streaming === streamingEnabled ? prev : { ...prev, streaming: streamingEnabled }));
  }, [streamingEnabled, setActiveModes]);

  useEffect(() => {
    userInputRef.current = userInput;
  }, [userInput]);

  // 同步快速模型状态
  useEffect(() => {
    setActiveModes((prev) => (prev.fastModel === fastModelEnabled ? prev : { ...prev, fastModel: fastModelEnabled }));
  }, [fastModelEnabled, setActiveModes]);

  // 初始化用户名（仅首次）
  useEffect(() => {
    setCurrentDisplayName(getDisplayUsername());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOpenUserNameModal = () => setShowUserNameModal(true);
    const handleOpenScriptDebug = () => setShowScriptDebugPanel(true);
    const handleExportJsonl = () => {
      void onExportJsonl?.();
    };
    const handleImportJsonl = (event: Event) => {
      const file = (event as CustomEvent<File>).detail;
      if (!file) {
        return;
      }
      void onImportJsonl?.(file);
    };

    window.addEventListener(SESSION_OPEN_USER_NAME_MODAL_EVENT, handleOpenUserNameModal);
    window.addEventListener(SESSION_OPEN_SCRIPT_DEBUG_EVENT, handleOpenScriptDebug);
    window.addEventListener(SESSION_EXPORT_JSONL_EVENT, handleExportJsonl);
    window.addEventListener(SESSION_IMPORT_JSONL_EVENT, handleImportJsonl as EventListener);

    return () => {
      window.removeEventListener(SESSION_OPEN_USER_NAME_MODAL_EVENT, handleOpenUserNameModal);
      window.removeEventListener(SESSION_OPEN_SCRIPT_DEBUG_EVENT, handleOpenScriptDebug);
      window.removeEventListener(SESSION_EXPORT_JSONL_EVENT, handleExportJsonl);
      window.removeEventListener(SESSION_IMPORT_JSONL_EVENT, handleImportJsonl as EventListener);
    };
  }, [onExportJsonl, onImportJsonl]);

  // ========== 事件处理器 ==========
  const handleUserNameSave = useCallback((newDisplayName: string) => {
    setCurrentDisplayName(newDisplayName);
    setDisplayUsername(newDisplayName);
  }, []);

  const handleToggleStreaming = useCallback(() => {
    apiConfig.setActiveConfigStreaming(!streamingEnabled);
  }, [apiConfig, streamingEnabled]);

  const handleToggleFastModel = useCallback(() => {
    setFastModelEnabled((prev) => !prev);
  }, [setFastModelEnabled]);

  // ========== 渲染函数 ==========
  const renderMessageHeaderSlot = useCallback((message: Message, index: number) => {
    const isLastAssistant = !isSending && message.role === "assistant" && index === messages.length - 1;
    if (!isLastAssistant) return null;

    const swipe = message.swipe;
    const showSwipeControls = !!swipe && swipe.total > 1;

    return (
      <>
        <ApiSelector
          configs={apiConfig.configs}
          activeConfigId={apiConfig.activeConfigId}
          showApiDropdown={apiConfig.showApiDropdown}
          showModelDropdown={apiConfig.showModelDropdown}
          selectedConfigId={apiConfig.selectedConfigId}
          onToggleDropdown={() => {
            apiConfig.setShowApiDropdown(!apiConfig.showApiDropdown);
            apiConfig.setShowModelDropdown(false);
          }}
          onConfigSelect={apiConfig.handleConfigSelect}
          onModelSelect={apiConfig.handleModelSwitch}
          onBackToConfigs={() => {
            apiConfig.setShowModelDropdown(false);
            apiConfig.setShowApiDropdown(true);
          }}
          t={t}
        />
        <MessageHeaderControls
          streaming={!!activeModes.streaming}
          fastModel={!!activeModes.fastModel}
          onToggleStreaming={handleToggleStreaming}
          onToggleFastModel={handleToggleFastModel}
          t={t}
        />

        {showSwipeControls && (
          <div className="ml-2 flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 border-border bg-surface hover:border-border"
              onClick={() => handleSwipe("prev")}
              aria-label="Swipe previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs text-muted-foreground tabular-nums">
              {swipe.activeIndex + 1}/{swipe.total}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 border-border bg-surface hover:border-border"
              onClick={() => handleSwipe("next")}
              aria-label="Swipe next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </>
    );
  }, [apiConfig, activeModes, isSending, messages.length, handleToggleStreaming, handleToggleFastModel, handleSwipe, t]);

  const streamingTarget = useMemo(() => (
    streamingEnabled && messages.length > 0 ? messages.length - 1 : -1
  ), [messages.length, streamingEnabled]);

  const streamingIntent = useMemo<ChatStreamingIntent>(() => ({
    enabled: streamingEnabled,
    targetIndex: streamingTarget,
    isSending,
    activeMessageId: (
      streamingEnabled &&
      isSending &&
      messages.length > 0
    )
      ? messages[messages.length - 1]?.id ?? null
      : null,
  }), [isSending, messages, streamingEnabled, streamingTarget]);

  // ========== 渲染 ==========
  return (
    <div className="flex h-full min-h-0 max-h-screen flex-col">
      {/* 消息列表 */}
      <MessageList
        messages={messages}
        character={character}
        openingSelection={openingSelection}
        streamingIntent={streamingIntent}
        onTruncate={onTruncate}
        onRegenerate={onRegenerate}
        onOpeningNavigate={onOpeningNavigate}
        fontClass={fontClass}
        serifFontClass={serifFontClass}
        t={t}
        onAppendInput={handleAppendInput}
        renderHeaderSlot={renderMessageHeaderSlot}
      />

      {lastSwipeTarget && (
        <div className="mx-6 mt-2 text-xs text-muted-foreground">
          Swipe 目标已切换：{lastSwipeTarget}
        </div>
      )}

      {/* 输入区域 */}
      <ChatInput
        userInput={userInput}
        setUserInput={setUserInput}
        isSending={isSending}
        suggestedInputs={suggestedInputs}
        onSubmit={onSubmit}
        onSuggestedInput={onSuggestedInput}
        fontClass={fontClass}
        t={t}
      />

      {/* 模态框 */}
      <LazyUserNameSettingModal
        isOpen={showUserNameModal}
        onClose={() => setShowUserNameModal(false)}
        currentDisplayName={currentDisplayName}
        onSave={handleUserNameSave}
      />

      <LazyScriptDebugPanel
        isOpen={showScriptDebugPanel}
        onClose={() => setShowScriptDebugPanel(false)}
        scripts={[]}
        hostDebug={hostDebug}
      />
    </div>
  );
}
