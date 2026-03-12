/**
 * @input  lib/store/script-variables, hooks/script-bridge, types/character-dialogue, types/script-message, lib/slash-command/types
 * @output useScriptBridge, ScriptStatus
 * @pos    脚本桥接 Hook - 脚本系统与 React 组件之间的通信层
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         useScriptBridge Hook                               ║
 * ║                                                                            ║
 * ║  处理脚本事件桥接：变量管理、世界书访问、消息广播                            ║
 * ║  单一职责：脚本系统与 React 组件之间的通信层                                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useScriptVariables } from "@/lib/store/script-variables";
import { handleApiCall } from "./script-bridge";
import type { DialogueMessage } from "@/types/character-dialogue";
import type {
  CharacterSwitchResult,
  ExpressionClassifyOptions,
  ExpressionFolderOverrideOptions,
  ExpressionListOptions,
  ExpressionSetOptions,
  ExpressionUploadOptions,
  GroupMemberField,
  ImportVariableMapping,
  PopupCommandOptions,
  QuickReplyContextOptions,
  QuickReplyCreateOptions,
  QuickReplyLookup,
  QuickReplySetOptions,
  QuickReplySetScope,
  QuickReplySetSnapshot,
  QuickReplySetVisibilityOptions,
  QuickReplySnapshot,
  QuickReplyUpdateOptions,
  ReasoningParseOptions,
  ReasoningParseResult,
  SendOptions,
  TranslateTextOptions,
  WorldInfoTimedEffectFormat,
  WorldInfoTimedEffectName,
  WorldInfoTimedEffectState,
  YouTubeTranscriptOptions,
} from "@/lib/slash-command/types";
import type { ScriptMessageData } from "@/types/script-message";

// ============================================================================
//                              类型定义
// ============================================================================

export interface ScriptStatus {
  scriptName?: string;
  status: "running" | "completed" | "error";
  message?: string;
  timestamp: number;
}

interface UseScriptBridgeOptions {
  characterId?: string;
  characterName?: string;
  dialogueId?: string;
  messages?: DialogueMessage[];
  maxStatusHistory?: number;
  // ─── Slash Command 回调 ───
  onSend?: (text: string, options?: SendOptions) => void | Promise<void>;
  onTrigger?: (member?: string) => void | Promise<void>;
  onSendAs?: (role: string, text: string) => void | Promise<void>;
  onSendSystem?: (text: string, options?: SendOptions) => void | Promise<void>;
  onImpersonate?: (text: string) => void | Promise<void>;
  onContinue?: () => void | Promise<void>;
  onSwipe?: (target?: string) => void | Promise<void>;
  onGetChatName?: () => string | Promise<string>;
  onRenameChat?: (name: string) => string | Promise<string>;
  onSetInput?: (text: string) => void | Promise<void>;
  onOpenTemporaryChat?: () => void | Promise<void>;
  onForceSaveChat?: () => void | Promise<void>;
  onHideMessages?: (startIndex: number) => void | Promise<void>;
  onUnhideMessages?: () => void | Promise<void>;
  onCreateCheckpoint?: (messageId: string, requestedName?: string) => string | Promise<string>;
  onCreateBranch?: (messageId: string) => string | Promise<string>;
  onGetCheckpoint?: (messageId: string) => string | Promise<string>;
  onListCheckpoints?: (options?: { links?: boolean }) => Array<number | string> | Promise<Array<number | string>>;
  onGoCheckpoint?: (messageId: string) => string | Promise<string>;
  onExitCheckpoint?: () => string | Promise<string>;
  onGetCheckpointParent?: () => string | Promise<string>;
  onDuplicateCharacter?: () => string | void | Promise<string | void>;
  onNewChat?: (options?: { deleteCurrentChat?: boolean }) => void | Promise<void>;
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
  onRemoveGroupMember?: (
    target: string,
  ) => string | number | void | Promise<string | number | void>;
  onMoveGroupMember?: (
    target: string,
    direction: "up" | "down",
  ) => string | number | void | Promise<string | number | void>;
  onPeekGroupMember?: (
    target: string,
  ) => string | number | void | Promise<string | number | void>;
  onGetGroupMemberCount?: () => number | Promise<number>;
  onSetGroupMemberEnabled?: (
    target: string,
    enabled: boolean,
  ) => string | number | void | Promise<string | number | void>;
  onAddSwipe?: (
    text: string,
    options?: { switch?: boolean },
  ) => string | number | void | Promise<string | number | void>;
  onExecuteQuickReplyByIndex?: (
    index: number,
  ) => string | number | void | Promise<string | number | void>;
  onToggleGlobalQuickReplySet?: (
    setName: string,
    options?: QuickReplySetVisibilityOptions,
  ) => void | Promise<void>;
  onAddGlobalQuickReplySet?: (
    setName: string,
    options?: QuickReplySetVisibilityOptions,
  ) => void | Promise<void>;
  onRemoveGlobalQuickReplySet?: (setName: string) => void | Promise<void>;
  onToggleChatQuickReplySet?: (
    setName: string,
    options?: QuickReplySetVisibilityOptions,
  ) => void | Promise<void>;
  onAddChatQuickReplySet?: (
    setName: string,
    options?: QuickReplySetVisibilityOptions,
  ) => void | Promise<void>;
  onRemoveChatQuickReplySet?: (setName: string) => void | Promise<void>;
  onListQuickReplySets?: (
    scope?: QuickReplySetScope,
  ) => string[] | QuickReplySetSnapshot[] | Promise<string[] | QuickReplySetSnapshot[]>;
  onListQuickReplies?: (
    setName: string,
  ) => string[] | QuickReplySnapshot[] | Promise<string[] | QuickReplySnapshot[]>;
  onGetQuickReply?: (
    setName: string,
    target: QuickReplyLookup,
  ) => Record<string, unknown> | null | undefined | Promise<Record<string, unknown> | null | undefined>;
  onCreateQuickReply?: (
    setName: string,
    label: string,
    message: string,
    options?: QuickReplyCreateOptions,
  ) => void | Promise<void>;
  onUpdateQuickReply?: (
    setName: string,
    target: QuickReplyLookup,
    options?: QuickReplyUpdateOptions,
  ) => void | Promise<void>;
  onDeleteQuickReply?: (
    setName: string,
    target: QuickReplyLookup,
  ) => void | Promise<void>;
  onAddQuickReplyContextSet?: (
    setName: string,
    target: QuickReplyLookup,
    contextSetName: string,
    options?: QuickReplyContextOptions,
  ) => void | Promise<void>;
  onRemoveQuickReplyContextSet?: (
    setName: string,
    target: QuickReplyLookup,
    contextSetName: string,
  ) => void | Promise<void>;
  onClearQuickReplyContextSets?: (
    setName: string,
    target: QuickReplyLookup,
  ) => void | Promise<void>;
  onCreateQuickReplySet?: (
    name: string,
    options?: QuickReplySetOptions,
  ) => void | Promise<void>;
  onUpdateQuickReplySet?: (
    name: string,
    options?: QuickReplySetOptions,
  ) => void | Promise<void>;
  onDeleteQuickReplySet?: (name: string) => void | Promise<void>;
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
  onImportVariables?: (
    from: string,
    mappings: ImportVariableMapping[],
  ) => number | void | Promise<number | void>;
  onShowGallery?: (
    options?: { character?: string; group?: string },
  ) => void | Promise<void>;
  onUploadExpressionAsset?: (
    imageUrl: string,
    options: ExpressionUploadOptions,
  ) => string | Promise<string>;
  onShowPopup?: (
    text: string,
    options?: PopupCommandOptions,
  ) => string | number | null | undefined | Promise<string | number | null | undefined>;
  onPickIcon?: () => string | false | Promise<string | false>;
  onIsMobile?: () => boolean | Promise<boolean>;
  onJumpToMessage?: (index: number) => void | Promise<void>;
  onRenderChatMessages?: (
    count: number,
    options?: { scroll?: boolean },
  ) => void | Promise<void>;
  onSwitchCharacter?: (
    target: string
  ) => CharacterSwitchResult | void | Promise<CharacterSwitchResult | void>;
  onRenameCurrentCharacter?: (
    name: string,
    options?: { silent?: boolean; chats?: boolean },
  ) => string | Promise<string>;
  onParseReasoningBlock?: (
    input: string,
    options?: ReasoningParseOptions,
  ) => ReasoningParseResult | null | undefined | Promise<ReasoningParseResult | null | undefined>;
  onApplyReasoningRegex?: (reasoning: string) => string | Promise<string>;
}

interface UseScriptBridgeReturn {
  scriptVariables: Record<string, unknown>;
  scriptStatuses: ScriptStatus[];
  handleScriptMessage: (data: ScriptMessageData) => Promise<unknown>;
  broadcastCharacterChange: () => void;
  broadcastMessage: (message: DialogueMessage) => void;
}

function isCharacterSwitchResult(value: unknown): value is CharacterSwitchResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CharacterSwitchResult>;
  return (
    typeof candidate.target === "string" &&
    typeof candidate.characterId === "string" &&
    typeof candidate.characterName === "string" &&
    typeof candidate.sessionId === "string" &&
    typeof candidate.sessionName === "string"
  );
}

// ============================================================================
//                              主 Hook
// ============================================================================

export function useScriptBridge(options: UseScriptBridgeOptions): UseScriptBridgeReturn {
  const {
    characterId,
    characterName,
    dialogueId,
    messages = [],
    maxStatusHistory = 50,
    onSend,
    onTrigger,
    onSendAs,
    onSendSystem,
    onImpersonate,
    onContinue,
    onSwipe,
    onGetChatName,
    onRenameChat,
    onSetInput,
    onOpenTemporaryChat,
    onForceSaveChat,
    onHideMessages,
    onUnhideMessages,
    onCreateCheckpoint,
    onCreateBranch,
    onGetCheckpoint,
    onListCheckpoints,
    onGoCheckpoint,
    onExitCheckpoint,
    onGetCheckpointParent,
    onDuplicateCharacter,
    onNewChat,
    onTranslateText,
    onGetYouTubeTranscript,
    onSelectProxyPreset,
    onGetWorldInfoTimedEffect,
    onSetWorldInfoTimedEffect,
    onGetGroupMember,
    onAddGroupMember,
    onRemoveGroupMember,
    onMoveGroupMember,
    onPeekGroupMember,
    onGetGroupMemberCount,
    onSetGroupMemberEnabled,
    onAddSwipe,
    onExecuteQuickReplyByIndex,
    onToggleGlobalQuickReplySet,
    onAddGlobalQuickReplySet,
    onRemoveGlobalQuickReplySet,
    onToggleChatQuickReplySet,
    onAddChatQuickReplySet,
    onRemoveChatQuickReplySet,
    onListQuickReplySets,
    onListQuickReplies,
    onGetQuickReply,
    onCreateQuickReply,
    onUpdateQuickReply,
    onDeleteQuickReply,
    onAddQuickReplyContextSet,
    onRemoveQuickReplyContextSet,
    onClearQuickReplyContextSets,
    onCreateQuickReplySet,
    onUpdateQuickReplySet,
    onDeleteQuickReplySet,
    onSetExpression,
    onSetExpressionFolderOverride,
    onGetLastExpression,
    onListExpressions,
    onClassifyExpression,
    onImportVariables,
    onShowGallery,
    onUploadExpressionAsset,
    onShowPopup,
    onPickIcon,
    onIsMobile,
    onJumpToMessage,
    onRenderChatMessages,
    onSwitchCharacter,
    onRenameCurrentCharacter,
    onParseReasoningBlock,
    onApplyReasoningRegex,
  } = options;
  const [scriptStatuses, setScriptStatuses] = useState<ScriptStatus[]>([]);

  const {
    variables: scriptVariablesStore,
    setVariable: setScriptVariable,
    deleteVariable: deleteScriptVariable,
  } = useScriptVariables();

  // 合并全局和角色变量 - 使用 useMemo 避免每次渲染创建新对象
  const scriptVariables = useMemo<Record<string, unknown>>(() => ({
    ...scriptVariablesStore.global,
    ...(characterId ? scriptVariablesStore.character[characterId] : {}),
  }), [scriptVariablesStore.global, scriptVariablesStore.character, characterId]);

  // ─── 使用 ref 存储 messages，避免 callback 依赖数组变化 ───
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const broadcastEvent = useCallback((eventName: string, data: unknown) => {
    window.dispatchEvent(
      new CustomEvent("DreamMiniStage:broadcast", {
        detail: { eventName, data },
      }),
    );
  }, []);

  const handleCharacterSwitch = useCallback(
    async (target: string): Promise<CharacterSwitchResult | void> => {
      if (!onSwitchCharacter) {
        return undefined;
      }

      const sourceCharacter = {
        id: characterId ?? "",
        name: characterName ?? "",
      };
      broadcastEvent("character:switch_requested", {
        target,
        from: sourceCharacter,
      });

      try {
        const result = await onSwitchCharacter(target);
        if (isCharacterSwitchResult(result)) {
          broadcastEvent("character:switch_completed", {
            from: sourceCharacter,
            to: {
              id: result.characterId,
              name: result.characterName,
            },
            sessionId: result.sessionId,
            sessionName: result.sessionName,
            target: result.target,
          });
          return result;
        }

        broadcastEvent("character:switch_completed", {
          from: sourceCharacter,
          target,
        });
        return result;
      } catch (error) {
        broadcastEvent("character:switch_failed", {
          from: sourceCharacter,
          target,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [broadcastEvent, characterId, characterName, onSwitchCharacter],
  );

  // ─── 处理脚本消息 ───
  // 【性能优化】不依赖 messages，通过 ref 获取最新值
  const handleScriptMessage = useCallback(
    async (data: ScriptMessageData): Promise<unknown> => {
      const { type, payload = {} } = data;
      const getVariablesSnapshot = () => useScriptVariables.getState().variables;

      // 控制台日志
      if (type === "CONSOLE_LOG") {
        console.log("[Script]", ...((payload.args as unknown[]) || []));
        return undefined;
      }

      // API 调用 - 委托给 handler registry
      if (type === "API_CALL") {
        const { method = "", args = [] } = payload;
        console.log("[useScriptBridge] 处理 API_CALL:", method, "args:", args);
        const result = await handleApiCall(method, args, {
          characterId,
          dialogueId,
          chatId: dialogueId,
          messageId: messagesRef.current[messagesRef.current.length - 1]?.id,
          messages: messagesRef.current,  // 通过 ref 获取最新 messages
          setScriptVariable,
          deleteScriptVariable,
          getVariablesSnapshot,
          onSend,
          onTrigger,
          onSendAs,
          onSendSystem,
          onImpersonate,
          onContinue,
          onSwipe,
          onGetChatName,
          onRenameChat,
          onSetInput,
          onOpenTemporaryChat,
          onForceSaveChat,
          onHideMessages,
          onUnhideMessages,
          onCreateCheckpoint,
          onCreateBranch,
          onGetCheckpoint,
          onListCheckpoints,
          onGoCheckpoint,
          onExitCheckpoint,
          onGetCheckpointParent,
          onDuplicateCharacter,
          onNewChat,
          onTranslateText,
          onGetYouTubeTranscript,
          onSelectProxyPreset,
          onGetWorldInfoTimedEffect,
          onSetWorldInfoTimedEffect,
          onGetGroupMember,
          onAddGroupMember,
          onRemoveGroupMember,
          onMoveGroupMember,
          onPeekGroupMember,
          onGetGroupMemberCount,
          onSetGroupMemberEnabled,
          onAddSwipe,
          onExecuteQuickReplyByIndex,
          onToggleGlobalQuickReplySet,
          onAddGlobalQuickReplySet,
          onRemoveGlobalQuickReplySet,
          onToggleChatQuickReplySet,
          onAddChatQuickReplySet,
          onRemoveChatQuickReplySet,
          onListQuickReplySets,
          onListQuickReplies,
          onGetQuickReply,
          onCreateQuickReply,
          onUpdateQuickReply,
          onDeleteQuickReply,
          onAddQuickReplyContextSet,
          onRemoveQuickReplyContextSet,
          onClearQuickReplyContextSets,
          onCreateQuickReplySet,
          onUpdateQuickReplySet,
          onDeleteQuickReplySet,
          onSetExpression,
          onSetExpressionFolderOverride,
          onGetLastExpression,
          onListExpressions,
          onClassifyExpression,
          onImportVariables,
          onShowGallery,
          onUploadExpressionAsset,
          onShowPopup,
          onPickIcon,
          onIsMobile,
          onJumpToMessage,
          onRenderChatMessages,
          onSwitchCharacter: onSwitchCharacter ? handleCharacterSwitch : undefined,
          onRenameCurrentCharacter,
          onParseReasoningBlock,
          onApplyReasoningRegex,
        });
        console.log("[useScriptBridge] API_CALL 返回:", method, "result:", result);
        return result;
      }

      // 事件透传
      if (type === "EVENT_EMIT") {
        const eventName = (payload as Record<string, unknown>).eventName as string;
        const eventData = (payload as Record<string, unknown>).data;
        window.dispatchEvent(
          new CustomEvent(`DreamMiniStage:${eventName}`, { detail: eventData }),
        );
        return eventName;
      }

      // 脚本状态更新
      if (type === "SCRIPT_STATUS") {
        setScriptStatuses((prev) => {
          const newStatus: ScriptStatus = {
            ...payload,
            timestamp: Date.now(),
          } as ScriptStatus;
          return [newStatus, ...prev].slice(0, maxStatusHistory);
        });
        return undefined;
      }

      return undefined;
    },
    [
      characterId,
      dialogueId,
      setScriptVariable,
      deleteScriptVariable,
      maxStatusHistory,
      onSend,
      onTrigger,
      onSendAs,
      onSendSystem,
      onImpersonate,
      onContinue,
      onSwipe,
      onGetChatName,
      onRenameChat,
      onSetInput,
      onOpenTemporaryChat,
      onForceSaveChat,
      onHideMessages,
      onUnhideMessages,
      onCreateCheckpoint,
      onCreateBranch,
      onGetCheckpoint,
      onListCheckpoints,
      onGoCheckpoint,
      onExitCheckpoint,
      onGetCheckpointParent,
      onDuplicateCharacter,
      onNewChat,
      onTranslateText,
      onGetYouTubeTranscript,
      onSelectProxyPreset,
      onGetWorldInfoTimedEffect,
      onSetWorldInfoTimedEffect,
      onGetGroupMember,
      onAddGroupMember,
      onRemoveGroupMember,
      onMoveGroupMember,
      onPeekGroupMember,
      onGetGroupMemberCount,
      onSetGroupMemberEnabled,
      onAddSwipe,
      onExecuteQuickReplyByIndex,
      onToggleGlobalQuickReplySet,
      onAddGlobalQuickReplySet,
      onRemoveGlobalQuickReplySet,
      onToggleChatQuickReplySet,
      onAddChatQuickReplySet,
      onRemoveChatQuickReplySet,
      onListQuickReplySets,
      onListQuickReplies,
      onGetQuickReply,
      onCreateQuickReply,
      onUpdateQuickReply,
      onDeleteQuickReply,
      onAddQuickReplyContextSet,
      onRemoveQuickReplyContextSet,
      onClearQuickReplyContextSets,
      onCreateQuickReplySet,
      onUpdateQuickReplySet,
      onDeleteQuickReplySet,
      onSetExpression,
      onSetExpressionFolderOverride,
      onGetLastExpression,
      onListExpressions,
      onClassifyExpression,
      onImportVariables,
      onShowGallery,
      onUploadExpressionAsset,
      onShowPopup,
      onPickIcon,
      onIsMobile,
      onJumpToMessage,
      onRenderChatMessages,
      onSwitchCharacter,
      onRenameCurrentCharacter,
      onParseReasoningBlock,
      onApplyReasoningRegex,
      handleCharacterSwitch,
    ],
  );

  // ─── 广播角色变更 ───
  const broadcastCharacterChange = useCallback(() => {
    if (!characterId) return;
    window.dispatchEvent(
      new CustomEvent("DreamMiniStage:broadcast", {
        detail: {
          eventName: "character:changed",
          data: { id: characterId, name: characterName },
        },
      }),
    );
  }, [characterId, characterName]);

  // ─── 广播消息 ───
  const broadcastMessage = useCallback((message: DialogueMessage) => {
    const eventName = message.role === "user" ? "message:sent" : "message:received";
    window.dispatchEvent(
      new CustomEvent("DreamMiniStage:broadcast", {
        detail: { eventName, data: message },
      }),
    );
  }, []);

  // ─── 角色变更时广播 ───
  useEffect(() => {
    if (!characterId) return;
    window.dispatchEvent(
      new CustomEvent("DreamMiniStage:broadcast", {
        detail: {
          eventName: "character:changed",
          data: { id: characterId, name: characterName },
        },
      }),
    );
  }, [characterId, characterName]);

  return {
    scriptVariables,
    scriptStatuses,
    handleScriptMessage,
    broadcastCharacterChange,
    broadcastMessage,
  };
}
