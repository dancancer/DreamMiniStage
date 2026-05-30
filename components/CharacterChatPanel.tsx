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
 * ║  设计原则：只做组合和状态协调，具体逻辑委托给子组件和 hooks                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { getDisplayUsername, setDisplayUsername } from "@/utils/username-helper";
import { useApiConfig } from "@/hooks/useApiConfig";
import { useScriptBridge } from "@/hooks/useScriptBridge";
import type {
  ScriptHostDebugSnapshot,
  ScriptHostDebugState,
} from "@/hooks/script-bridge/host-debug-state";
import type { SendOptions } from "@/lib/slash-command/types";
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
import type { TavernHelperScript } from "@/lib/models/character-model";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface Character {
  id: string;
  name: string;
  personality?: string;
  avatar_path?: string;
  extensions?: {
    TavernHelper_scripts?: TavernHelperScript[];
    [key: string]: unknown;
  };
}

interface Props {
  character: Character;
  messages: Message[];
  openingMessages: { id: string; content: string }[];
  openingIndex: number;
  openingLocked: boolean;
  userInput: string;
  setUserInput: (val: string) => void;
  isSending: boolean;
  suggestedInputs: string[];
  onSubmit: (e: React.FormEvent) => void;
  onSuggestedInput: (input: string) => void;
  onTruncate: (id: string) => void;
  onRegenerate: (id: string) => void;
  onOpeningNavigate: (direction: "prev" | "next") => void;
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
  openingMessages,
  openingIndex,
  openingLocked,
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
  language,
  dialogueKey,
  chatName,
  messageCallbacks,
  chatManagementCallbacks,
  checkpointCallbacks,
  groupMemberCallbacks,
  expressionCallbacks,
  hostCapabilityCallbacks,
  worldInfoCallbacks,
  navigationCallbacks,
  hostCapabilitySources,
  hasHostOverrides,
  hostDebug,
  hostDebugState,
  onHostDebugUpdate,
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
  // ─── Slash Command 回调适配，优先使用外部传入，否则回退到基础 onSend/onTrigger ───
  const onSendMessage = messageCallbacks?.onSend;
  const onTriggerGeneration = messageCallbacks?.onTrigger;

  const handleSendAs = useCallback(async (role: string, text: string) => {
    if (messageCallbacks?.onSendAs) return messageCallbacks.onSendAs(role, text);
    if (onSendMessage) return onSendMessage(`[${role}] ${text}`);
  }, [messageCallbacks, onSendMessage]);

  const handleSendSystem = useCallback(async (text: string, options?: SendOptions) => {
    if (messageCallbacks?.onSendSystem) return messageCallbacks.onSendSystem(text, options);
    if (onSendMessage) return onSendMessage(`[SYS] ${text}`, options);
  }, [messageCallbacks, onSendMessage]);

  const handleImpersonate = useCallback(async (text: string) => {
    if (messageCallbacks?.onImpersonate) return messageCallbacks.onImpersonate(text);
    if (onSendMessage) await onSendMessage(`[impersonate] ${text}`);
    if (onTriggerGeneration) await onTriggerGeneration();
  }, [messageCallbacks, onSendMessage, onTriggerGeneration]);

  const handleContinue = useCallback(async () => {
    if (messageCallbacks?.onContinue) return messageCallbacks.onContinue();
    if (onTriggerGeneration) return onTriggerGeneration();
  }, [messageCallbacks, onTriggerGeneration]);

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

  // ─── 组合消息回调：将本地适配层与外部回调合并 ───
  const bridgeMessageCallbacks = useMemo(() => ({
    ...messageCallbacks,
    onSendAs: handleSendAs,
    onSendSystem: handleSendSystem,
    onImpersonate: handleImpersonate,
    onContinue: handleContinue,
    onSwipe: handleSwipe,
  }), [messageCallbacks, handleSendAs, handleSendSystem, handleImpersonate, handleContinue, handleSwipe]);

  // ─── 组合会话管理回调：注入 getChatName 和 setInput，合并外部回调 ───
  const bridgeChatCallbacks = useMemo(() => ({
    ...chatManagementCallbacks,
    onGetChatName: () => chatName || dialogueKey || character.name || "",
    onSetInput: (text: string) => setUserInput(text),
  }), [chatManagementCallbacks, chatName, dialogueKey, character.name, setUserInput]);

  const scriptBridge = useScriptBridge({
    characterId: character.id,
    characterName: character.name,
    dialogueId: dialogueKey,
    messages,
    messageCallbacks: bridgeMessageCallbacks,
    chatManagementCallbacks: bridgeChatCallbacks,
    checkpointCallbacks,
    groupMemberCallbacks,
    expressionCallbacks,
    hostCapabilityCallbacks,
    worldInfoCallbacks,
    navigationCallbacks,
    hostCapabilitySources,
    hasHostOverrides,
    hostDebugState,
    onHostDebugUpdate,
  });

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

  // ═══════════════════════════════════════════════════════════════
  // 广播最新消息到脚本系统
  // 
  // 【优化】使用 ref 追踪已广播的消息 ID，避免重复广播
  // 只在新消息出现时广播，而不是每次 messages 引用变化都广播
  // ═══════════════════════════════════════════════════════════════
  const lastBroadcastedIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    // 只有当消息 ID 变化时才广播，避免重复触发
    if (lastMessage.id !== lastBroadcastedIdRef.current) {
      lastBroadcastedIdRef.current = lastMessage.id;
      scriptBridge.broadcastMessage(lastMessage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

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
        openingMessages={openingMessages}
        openingIndex={openingIndex}
        openingLocked={openingLocked}
        streamingIntent={streamingIntent}
        onTruncate={onTruncate}
        onRegenerate={onRegenerate}
        onOpeningNavigate={onOpeningNavigate}
        fontClass={fontClass}
        serifFontClass={serifFontClass}
        t={t}
        scriptVariables={scriptBridge.scriptVariables}
        onScriptMessage={scriptBridge.handleScriptMessage}
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
        scripts={scriptBridge.scriptStatuses}
        hostDebug={hostDebug}
      />
    </div>
  );
}
