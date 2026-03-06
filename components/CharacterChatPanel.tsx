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

import { useEffect, useState, useCallback, useRef } from "react";
import { getDisplayUsername, setDisplayUsername } from "@/utils/username-helper";
import { useApiConfig } from "@/hooks/useApiConfig";
import { useScriptBridge } from "@/hooks/useScriptBridge";
import type {
  CharacterSwitchResult,
  ExpressionClassifyOptions,
  ExpressionFolderOverrideOptions,
  ExpressionListOptions,
  ExpressionSetOptions,
  ExpressionUploadOptions,
  GroupMemberField,
  SendOptions,
  TranslateTextOptions,
  WorldInfoTimedEffectFormat,
  WorldInfoTimedEffectName,
  WorldInfoTimedEffectState,
  YouTubeTranscriptOptions,
} from "@/lib/slash-command/types";
import { useLocalStorageBoolean } from "@/hooks/useLocalStorage";
import UserNameSettingModal from "@/components/UserNameSettingModal";
import ScriptDebugPanel from "@/components/ScriptDebugPanel";
import type { TavernHelperScript } from "@/lib/models/character-model";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  ApiSelector,
  ChatInput,
  ControlPanel,
  MessageHeaderControls,
  MessageList,
  type Message,
} from "@/components/character-chat";

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
  // ─── Slash Command 回调 ───
  onSendMessage?: (text: string, options?: SendOptions) => void | Promise<void>;
  onTriggerGeneration?: () => void | Promise<void>;
  onSendAs?: (role: string, text: string) => void | Promise<void>;
  onSendSystem?: (text: string, options?: SendOptions) => void | Promise<void>;
  onImpersonate?: (text: string) => void | Promise<void>;
  onContinue?: () => void | Promise<void>;
  onSwipe?: (target?: string) => void | Promise<void>;
  onRenameChat?: (name: string) => string | Promise<string>;
  onForceSaveChat?: () => void | Promise<void>;
  onHideMessages?: (startIndex: number) => void | Promise<void>;
  onUnhideMessages?: () => void | Promise<void>;
  onOpenTemporaryChat?: () => void | Promise<void>;
  onJumpToMessage?: (index: number) => void | Promise<void>;
  onTranslateText?: (
    text: string,
    options?: TranslateTextOptions,
  ) => string | Promise<string>;
  onGetYouTubeTranscript?: (
    urlOrId: string,
    options?: YouTubeTranscriptOptions,
  ) => string | Promise<string>;
  onSelectProxyPreset?: (name?: string) => string | Promise<string>;
  onGetWorldInfoTimedEffect?: (
    file: string,
    uid: string,
    effect: WorldInfoTimedEffectName,
    options?: { format?: WorldInfoTimedEffectFormat },
  ) => boolean | number | Promise<boolean | number>;
  onSetWorldInfoTimedEffect?: (
    file: string,
    uid: string,
    effect: WorldInfoTimedEffectName,
    state: WorldInfoTimedEffectState,
  ) => void | Promise<void>;
  onGetGroupMember?: (
    target: string,
    field: GroupMemberField,
  ) => string | number | undefined | Promise<string | number | undefined>;
  onAddGroupMember?: (
    target: string,
  ) => string | number | void | Promise<string | number | void>;
  onSetGroupMemberEnabled?: (
    target: string,
    enabled: boolean,
  ) => string | number | void | Promise<string | number | void>;
  onAddSwipe?: (
    text: string,
    options?: { switch?: boolean },
  ) => string | number | void | Promise<string | number | void>;
  onSetExpression?: (
    label: string,
    options?: ExpressionSetOptions,
  ) => string | Promise<string>;
  onSetExpressionFolderOverride?: (
    folder: string,
    options?: ExpressionFolderOverrideOptions,
  ) => string | void | Promise<string | void>;
  onGetLastExpression?: (name?: string) => string | Promise<string>;
  onListExpressions?: (
    options?: ExpressionListOptions,
  ) => string[] | Promise<string[]>;
  onClassifyExpression?: (
    text: string,
    options?: ExpressionClassifyOptions,
  ) => string | Promise<string>;
  onShowGallery?: (
    options?: { character?: string; group?: string },
  ) => void | Promise<void>;
  onUploadExpressionAsset?: (
    imageUrl: string,
    options: ExpressionUploadOptions,
  ) => string | Promise<string>;
  onSwitchCharacter?: (
    target: string
  ) => CharacterSwitchResult | void | Promise<CharacterSwitchResult | void>;
  onRenameCurrentCharacter?: (
    name: string,
    options?: { silent?: boolean; chats?: boolean },
  ) => string | Promise<string>;
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
  onSendMessage,
  onTriggerGeneration,
  onSendAs,
  onSendSystem,
  onImpersonate,
  onContinue,
  onSwipe,
  onRenameChat,
  onForceSaveChat,
  onHideMessages,
  onUnhideMessages,
  onOpenTemporaryChat,
  onJumpToMessage,
  onTranslateText,
  onGetYouTubeTranscript,
  onSelectProxyPreset,
  onGetWorldInfoTimedEffect,
  onSetWorldInfoTimedEffect,
  onGetGroupMember,
  onAddGroupMember,
  onSetGroupMemberEnabled,
  onAddSwipe,
  onSetExpression,
  onSetExpressionFolderOverride,
  onGetLastExpression,
  onListExpressions,
  onClassifyExpression,
  onShowGallery,
  onUploadExpressionAsset,
  onSwitchCharacter,
  onRenameCurrentCharacter,
  onExportJsonl,
  onImportJsonl,
}: Props) {
  // ========== 状态管理 ==========
  const [streamingTarget, setStreamingTarget] = useState(-1);
  const [showUserNameModal, setShowUserNameModal] = useState(false);
  const [showScriptDebugPanel, setShowScriptDebugPanel] = useState(false);
  const [lastSwipeTarget, setLastSwipeTarget] = useState<string | null>(null);
  const [currentDisplayName, setCurrentDisplayName] = useState("");
  const { value: streamingEnabled, setValue: setStreamingEnabled } = useLocalStorageBoolean("streamingEnabled", true);
  const { value: fastModelEnabled, setValue: setFastModelEnabled } = useLocalStorageBoolean("fastModelEnabled", true);

  // ========== 自定义 Hooks ==========
  const apiConfig = useApiConfig();
  // ─── Slash Command 回调适配，优先使用外部传入，否则回退到基础 onSend/onTrigger ───
  const handleSendAs = useCallback(async (role: string, text: string) => {
    if (onSendAs) return onSendAs(role, text);
    if (onSendMessage) return onSendMessage(`[${role}] ${text}`);
  }, [onSendAs, onSendMessage]);

  const handleSendSystem = useCallback(async (text: string, options?: SendOptions) => {
    if (onSendSystem) return onSendSystem(text, options);
    if (onSendMessage) return onSendMessage(`[SYS] ${text}`, options);
  }, [onSendSystem, onSendMessage]);

  const handleImpersonate = useCallback(async (text: string) => {
    if (onImpersonate) return onImpersonate(text);
    if (onSendMessage) await onSendMessage(`[impersonate] ${text}`);
    if (onTriggerGeneration) await onTriggerGeneration();
  }, [onImpersonate, onSendMessage, onTriggerGeneration]);

  const handleContinue = useCallback(async () => {
    if (onContinue) return onContinue();
    if (onTriggerGeneration) return onTriggerGeneration();
  }, [onContinue, onTriggerGeneration]);

  const handleSwipe = useCallback(async (target?: string) => {
    if (onSwipe) return onSwipe(target);
    setLastSwipeTarget(target ?? "next");
    return undefined;
  }, [onSwipe]);

  const scriptBridge = useScriptBridge({
    characterId: character.id,
    characterName: character.name,
    dialogueId: dialogueKey,
    messages,
    onSend: onSendMessage,
    onTrigger: onTriggerGeneration,
    onSendAs: handleSendAs,
    onSendSystem: handleSendSystem,
    onImpersonate: handleImpersonate,
    onContinue: handleContinue,
    onSwipe: handleSwipe,
    onGetChatName: () => chatName || dialogueKey || character.name || "",
    onRenameChat,
    onSetInput: (text) => setUserInput(text),
    onOpenTemporaryChat,
    onJumpToMessage,
    onForceSaveChat,
    onHideMessages,
    onUnhideMessages,
    onTranslateText,
    onGetYouTubeTranscript,
    onSelectProxyPreset,
    onGetWorldInfoTimedEffect,
    onSetWorldInfoTimedEffect,
    onGetGroupMember,
    onAddGroupMember,
    onSetGroupMemberEnabled,
    onAddSwipe,
    onSetExpression,
    onSetExpressionFolderOverride,
    onGetLastExpression,
    onListExpressions,
    onClassifyExpression,
    onShowGallery,
    onUploadExpressionAsset,
    onSwitchCharacter,
    onRenameCurrentCharacter,
  });

  // ═══════════════════════════════════════════════════════════════
  // 初始化流式传输状态
  // ───────────────────────────────────────────────────────────────
  // 【优化】拆分职责：流式传输、快速模型、用户名各自独立管理
  // ═══════════════════════════════════════════════════════════════
  
  // 同步流式传输状态
  useEffect(() => {
    setActiveModes((prev) => (prev.streaming === streamingEnabled ? prev : { ...prev, streaming: streamingEnabled }));
    setStreamingTarget(streamingEnabled && messages.length > 0 ? messages.length : -1);
  }, [messages.length, streamingEnabled, setActiveModes]);

  // 同步快速模型状态
  useEffect(() => {
    setActiveModes((prev) => (prev.fastModel === fastModelEnabled ? prev : { ...prev, fastModel: fastModelEnabled }));
  }, [fastModelEnabled, setActiveModes]);

  // 初始化用户名（仅首次）
  useEffect(() => {
    setCurrentDisplayName(getDisplayUsername());
  }, []);

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
    setStreamingEnabled((prev) => !prev);
  }, [setStreamingEnabled]);

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

  // ========== 渲染 ==========
  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* 消息列表 */}
      <MessageList
        messages={messages}
        character={character}
        openingMessages={openingMessages}
        openingIndex={openingIndex}
        openingLocked={openingLocked}
        isSending={isSending}
        enableStreaming={!!activeModes.streaming}
        streamingTarget={streamingTarget}
        onTruncate={onTruncate}
        onRegenerate={onRegenerate}
        onOpeningNavigate={onOpeningNavigate}
        fontClass={fontClass}
        serifFontClass={serifFontClass}
        t={t}
        scriptVariables={scriptBridge.scriptVariables}
        onScriptMessage={scriptBridge.handleScriptMessage}
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
      >
        <ControlPanel
          activeModes={activeModes as { "story-progress": boolean; perspective: { active: boolean; mode: "novel" | "protagonist" }; "scene-setting": boolean }}
          setActiveModes={setActiveModes}
          onOpenUserNameModal={() => setShowUserNameModal(true)}
          onOpenScriptDebug={() => setShowScriptDebugPanel(true)}
          t={t}
          dialogueKey={dialogueKey}
          characterId={character?.id}
          onExportJsonl={onExportJsonl}
          onImportJsonl={onImportJsonl}
        />
      </ChatInput>

      {/* 模态框 */}
      <UserNameSettingModal
        isOpen={showUserNameModal}
        onClose={() => setShowUserNameModal(false)}
        currentDisplayName={currentDisplayName}
        onSave={handleUserNameSave}
      />

      <ScriptDebugPanel
        isOpen={showScriptDebugPanel}
        onClose={() => setShowScriptDebugPanel(false)}
        scripts={scriptBridge.scriptStatuses}
      />
    </div>
  );
}
