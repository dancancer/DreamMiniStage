/**
 * @input  react, next/navigation, app/session/*, hooks/*, lib/store/*, lib/data/roleplay/*, lib/model-runtime
 * @output useSessionPageActions
 * @pos    /session 页面动作编排
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      useSessionPageActions                               ║
 * ║                                                                           ║
 * ║  收口 `/session` 内容页的动作编排，避免内容组件继续堆积大量 handler。        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/store/toast-store";
import { useSessionStore } from "@/lib/store/session-store";
import { useGroupChatStore } from "@/lib/group-chat/store";
import { useCheckpointStore } from "@/lib/checkpoint/store";
import { useScriptVariables } from "@/lib/store/script-variables";
import { useModelStore } from "@/lib/store/model-store";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import { syncModelConfigToStorage } from "@/lib/model-runtime";
import { usePromptConfigCallbacks } from "@/hooks/prompt-config/use-prompt-config-callbacks";
import { buildSwitchedSessionName, buildTemporarySessionName } from "@/app/session/session-switch";
import { resolveSessionSlashHostBridge } from "@/app/session/session-host-bridge";
import { createSessionDefaultHostBridge } from "@/app/session/session-host-defaults";
import { listSessionGalleryItems } from "@/app/session/session-gallery";
import { createSessionStoreHostCallbacks } from "@/app/session/session-store-hosts";
import { createSessionNavigationActions } from "@/app/session/session-navigation-actions";
import { createSessionHostActions } from "@/app/session/session-host-actions";
import { createSessionChatActions } from "@/app/session/session-chat-actions";
import { createSessionHostCallbacks, resolveSessionHostBridgeState } from "@/app/session/session-host";
import { createSessionSlashExecutor } from "@/app/session/session-slash-executor";
import { getSessionWorldInfoTimedEffect, setSessionWorldInfoTimedEffect } from "@/app/session/session-timed-world-info";
import { createSessionDialogueActions } from "@/app/session/session-dialogue-actions";
import { createSessionQuickReplyExecutorStore } from "@/app/session/session-quick-reply-store";
import type { SessionGalleryItem } from "@/app/session/session-gallery";
import type { ScriptHostDebugState } from "@/hooks/script-bridge/host-debug-state";
import type { Character, DialogueMessage } from "@/types/character-dialogue";
import type {
  SendOptions,
} from "@/lib/slash-command/types";

function getSessionMessageSelector(index: number): string {
  return `[data-session-message-index="${index}"]`;
}

interface UseSessionPageActionsParams {
  sessionId: string | null;
  characterId: string | null;
  currentCharacter: Character | null;
  currentCharacterName: string;
  currentSessionName: string;
  language: "zh" | "en";
  dialogue: {
    messages: DialogueMessage[];
    openingMessages: { id: string; content: string }[];
    openingIndex: number;
    openingLocked: boolean;
    suggestedInputs: string[];
    isSending: boolean;
    addUserMessage: (message: string, options?: SendOptions) => void | Promise<void>;
    addRoleMessage: (role: string, message: string, options?: SendOptions) => void | Promise<void>;
    triggerGeneration: () => Promise<void>;
    truncateMessagesAfter: (nodeId: string) => Promise<void>;
    handleRegenerate: (nodeId: string) => Promise<void>;
    handleSwipe: (target?: string) => Promise<void>;
    handleOpeningNavigate: (direction: "prev" | "next") => Promise<void>;
    exportJsonl: () => Promise<void>;
    importJsonl: (file: File) => Promise<void>;
    fetchLatestDialogue: () => Promise<void>;
    handleSendMessage: (message: string) => Promise<void>;
    setMessages: (messages: DialogueMessage[]) => void;
  };
  setUserInput: (text: string) => void;
  activeModes: Record<string, unknown>;
  setCharacterNameOverride: (name: string | null) => void;
  setGalleryState: React.Dispatch<React.SetStateAction<{
    open: boolean;
    items: SessionGalleryItem[];
    target?: { character?: string; group?: string };
  }>>;
  t: (key: string) => string;
  hostDebugState: ScriptHostDebugState;
  syncHostDebug: () => void;
}

export function useSessionPageActions({
  sessionId,
  characterId,
  currentCharacter,
  currentCharacterName,
  currentSessionName,
  language,
  dialogue,
  setUserInput,
  activeModes,
  setCharacterNameOverride,
  setGalleryState,
  t,
  hostDebugState,
  syncHostDebug,
}: UseSessionPageActionsParams) {
  const router = useRouter();
  const createSession = useSessionStore((state) => state.createSession);
  const updateSessionName = useSessionStore((state) => state.updateSessionName);
  const setScriptVariable = useScriptVariables((state) => state.setVariable);
  const deleteScriptVariable = useScriptVariables((state) => state.deleteVariable);

  const defaultSessionHostBridge = useMemo(() => createSessionDefaultHostBridge({ language }), [language]);
  const resolveSessionHostBridge = useCallback(() => {
    const injectedBridge = typeof window === "undefined" ? null : resolveSessionSlashHostBridge(window);
    return resolveSessionHostBridgeState(defaultSessionHostBridge, injectedBridge);
  }, [defaultSessionHostBridge]);
  const sessionHostCallbacks = useMemo(
    () => createSessionHostCallbacks(resolveSessionHostBridge),
    [resolveSessionHostBridge],
  );
  const sessionStoreHostCallbacks = useMemo(() => createSessionStoreHostCallbacks({
    sessionId,
    dialogueMessages: dialogue.messages,
    deps: {
      createCheckpoint: (dialogueId, messageId, requestedName) =>
        useCheckpointStore.getState().createCheckpoint(dialogueId, messageId, requestedName),
      createBranch: (dialogueId, messageId, parentSessionId) =>
        useCheckpointStore.getState().createBranch(dialogueId, messageId, parentSessionId),
      getCheckpoint: (dialogueId, messageId) =>
        useCheckpointStore.getState().getCheckpoint(dialogueId, messageId),
      listCheckpoints: (dialogueId, messages, links) =>
        useCheckpointStore.getState().listCheckpoints(dialogueId, messages, links),
      goCheckpoint: (dialogueId, messageId, parentSessionId) =>
        useCheckpointStore.getState().goCheckpoint(dialogueId, messageId, parentSessionId),
      exitCheckpoint: (dialogueId) =>
        useCheckpointStore.getState().exitCheckpoint(dialogueId),
      getCheckpointParent: (dialogueId) =>
        useCheckpointStore.getState().getCheckpointParent(dialogueId),
      getWorldInfoTimedEffect: getSessionWorldInfoTimedEffect,
      setWorldInfoTimedEffect: setSessionWorldInfoTimedEffect,
      getGroupMember: (dialogueId, target, field) =>
        useGroupChatStore.getState().getGroupMember(dialogueId, target, field),
      getGroupMemberCount: (dialogueId) =>
        useGroupChatStore.getState().getGroupMemberCount(dialogueId),
      addGroupMember: (dialogueId, target) =>
        useGroupChatStore.getState().addGroupMember(dialogueId, target),
      removeGroupMember: (dialogueId, target) =>
        useGroupChatStore.getState().removeGroupMember(dialogueId, target),
      moveGroupMember: (dialogueId, target, direction) =>
        useGroupChatStore.getState().moveGroupMember(dialogueId, target, direction),
      peekGroupMember: (dialogueId, target) =>
        useGroupChatStore.getState().peekGroupMember(dialogueId, target),
      setGroupMemberEnabled: (dialogueId, target, enabled) =>
        useGroupChatStore.getState().setGroupMemberEnabled(dialogueId, target, enabled),
    },
  }), [dialogue.messages, sessionId]);

  const resolveCharacterSwitchTarget = useCallback(async (target: string): Promise<string> => {
    const normalized = target.trim();
    if (!normalized) {
      throw new Error("Character target is required");
    }

    const records = await LocalCharacterRecordOperations.getAllCharacters();
    const exactId = records.find((record) => record.id === normalized);
    if (exactId) {
      return exactId.id;
    }

    const lower = normalized.toLowerCase();
    const exactNameMatches = records.filter((record) =>
      (record.data?.name ?? "").trim().toLowerCase() === lower,
    );
    if (exactNameMatches.length === 1) {
      return exactNameMatches[0].id;
    }
    if (exactNameMatches.length > 1) {
      throw new Error(`Character name is ambiguous: ${normalized}`);
    }

    const fuzzyMatches = records.filter((record) =>
      (record.data?.name ?? "").toLowerCase().includes(lower),
    );
    if (fuzzyMatches.length === 1) {
      return fuzzyMatches[0].id;
    }
    if (fuzzyMatches.length > 1) {
      throw new Error(`Character target is ambiguous: ${normalized}`);
    }

    throw new Error(`Character not found: ${normalized}`);
  }, []);

  const navigationActions = useMemo(() => createSessionNavigationActions({
    sessionId,
    characterId,
    currentCharacterName,
    currentMessagesLength: dialogue.messages.length,
    createSession,
    updateSessionName,
    resolveCharacterSwitchTarget,
    getCharacterNameById: async (nextCharacterId: string) => {
      const nextCharacterRecord = await LocalCharacterRecordOperations.getCharacterById(nextCharacterId);
      return nextCharacterRecord?.data?.name?.trim() || nextCharacterId;
    },
    updateCharacterName: async (targetCharacterId: string, name: string) =>
      Boolean(await LocalCharacterRecordOperations.updateCharacter(targetCharacterId, { name })),
    pushRoute: (href: string) => router.push(href),
    queryMessageElement: (index: number) => document.querySelector<HTMLElement>(getSessionMessageSelector(index)),
    setCharacterNameOverride,
    buildTemporarySessionName,
    buildSwitchedSessionName,
  }), [
    sessionId,
    characterId,
    currentCharacterName,
    dialogue.messages.length,
    createSession,
    updateSessionName,
    resolveCharacterSwitchTarget,
    router,
    setCharacterNameOverride,
  ]);

  const hostActions = useMemo(() => createSessionHostActions({
    currentCharacter,
    openingMessages: dialogue.openingMessages,
    messages: dialogue.messages,
    setGalleryState,
    listSessionGalleryItems,
    getModelConfigs: () => useModelStore.getState(),
    syncModelConfigToStorage,
    hostCallbacks: sessionHostCallbacks,
    storeHostCallbacks: sessionStoreHostCallbacks,
  }), [
    currentCharacter,
    dialogue.openingMessages,
    dialogue.messages,
    setGalleryState,
    sessionHostCallbacks,
    sessionStoreHostCallbacks,
  ]);
  const dialogueActions = useMemo(() => createSessionDialogueActions({
    sessionId,
    characterId,
    messages: dialogue.messages,
    setMessages: dialogue.setMessages,
  }), [sessionId, characterId, dialogue.messages, dialogue.setMessages]);

  const promptCallbacks = usePromptConfigCallbacks();
  const quickReplyExecutorStore = useMemo(
    () => createSessionQuickReplyExecutorStore(sessionId),
    [sessionId],
  );

  const slashExecutor = useMemo(() => createSessionSlashExecutor({
    characterId,
    sessionId,
    currentSessionName,
    dialogue,
    promptCallbacks,
    quickReplyStore: quickReplyExecutorStore,
    variables: {
      global: useScriptVariables.getState().variables.global,
      character: characterId && useScriptVariables.getState().variables.character[characterId]
        ? { ...useScriptVariables.getState().variables.character[characterId] }
        : {},
    },
    setUserInput,
    setScriptVariable,
    deleteScriptVariable,
    hostDebugState,
    syncHostDebug,
    resolveHostCapabilitySources: () => resolveSessionHostBridge().capabilitySources,
    callbacks: {
      renameCurrentChat: navigationActions.handleRenameChat,
      createCheckpoint: sessionStoreHostCallbacks.createCheckpoint,
      createBranch: sessionStoreHostCallbacks.createBranch,
      getCheckpoint: sessionStoreHostCallbacks.getCheckpoint,
      listCheckpoints: sessionStoreHostCallbacks.listCheckpoints,
      goCheckpoint: sessionStoreHostCallbacks.goCheckpoint,
      exitCheckpoint: sessionStoreHostCallbacks.exitCheckpoint,
      getCheckpointParent: sessionStoreHostCallbacks.getCheckpointParent,
      openTemporaryChat: navigationActions.handleOpenTemporaryChat,
      forceSaveChat: dialogueActions.handleForceSaveChat,
      hideMessages: dialogueActions.handleHideMessages,
      unhideMessages: dialogueActions.handleUnhideMessages,
      translateText: hostActions.handleTranslateText,
      getYouTubeTranscript: hostActions.handleGetYouTubeTranscript,
      getClipboardText: hostActions.handleGetClipboardText,
      setClipboardText: hostActions.handleSetClipboardText,
      isExtensionInstalled: hostActions.handleIsExtensionInstalled,
      getExtensionEnabledState: hostActions.handleGetExtensionEnabledState,
      setExtensionEnabled: hostActions.handleSetExtensionEnabled,
      selectProxyPreset: hostActions.handleSelectProxyPreset,
      getWorldInfoTimedEffect: hostActions.handleGetWorldInfoTimedEffect,
      setWorldInfoTimedEffect: hostActions.handleSetWorldInfoTimedEffect,
      getGroupMember: hostActions.handleGetGroupMember,
      getGroupMemberCount: hostActions.handleGetGroupMemberCount,
      addGroupMember: hostActions.handleAddGroupMember,
      removeGroupMember: hostActions.handleRemoveGroupMember,
      moveGroupMember: hostActions.handleMoveGroupMember,
      peekGroupMember: hostActions.handlePeekGroupMember,
      setGroupMemberEnabled: hostActions.handleSetGroupMemberEnabled,
      listGallery: hostActions.handleListGallery,
      showGallery: hostActions.handleShowGallery,
      jumpToMessage: navigationActions.handleJumpToMessage,
      renameCurrentCharacter: navigationActions.handleRenameCurrentCharacter,
      switchCharacter: navigationActions.handleSwitchCharacter,
      getMessageReasoning: dialogueActions.handleGetMessageReasoning,
      setMessageReasoning: dialogueActions.handleSetMessageReasoning,
    },
  }), [
    characterId,
    sessionId,
    currentSessionName,
    dialogue,
    promptCallbacks,
    quickReplyExecutorStore,
    setUserInput,
    setScriptVariable,
    deleteScriptVariable,
    navigationActions,
    sessionStoreHostCallbacks,
    hostActions,
    dialogueActions,
    hostDebugState,
    resolveSessionHostBridge,
    syncHostDebug,
  ]);

  const executeSessionSlashInput = slashExecutor.executeSessionSlashInput;
  const chatActions = useMemo(() => createSessionChatActions({
    executeSessionSlashInput,
    handleSendMessage: dialogue.handleSendMessage,
    setUserInput,
    t,
    isSending: dialogue.isSending,
    activeModes,
    onError: (message) => toast.error(message),
  }), [executeSessionSlashInput, dialogue.handleSendMessage, setUserInput, t, dialogue.isSending, activeModes]);

  return {
    resolveSessionHostBridge,
    handleSwitchCharacter: navigationActions.handleSwitchCharacter,
    handleRenameChat: navigationActions.handleRenameChat,
    handleRenameCurrentCharacter: navigationActions.handleRenameCurrentCharacter,
    handleHideMessages: dialogueActions.handleHideMessages,
    handleUnhideMessages: dialogueActions.handleUnhideMessages,
    handleForceSaveChat: dialogueActions.handleForceSaveChat,
    handleCreateCheckpoint: sessionStoreHostCallbacks.createCheckpoint,
    handleCreateBranch: sessionStoreHostCallbacks.createBranch,
    handleGetCheckpoint: sessionStoreHostCallbacks.getCheckpoint,
    handleListCheckpoints: sessionStoreHostCallbacks.listCheckpoints,
    handleGoCheckpoint: sessionStoreHostCallbacks.goCheckpoint,
    handleExitCheckpoint: sessionStoreHostCallbacks.exitCheckpoint,
    handleGetCheckpointParent: sessionStoreHostCallbacks.getCheckpointParent,
    handleOpenTemporaryChat: navigationActions.handleOpenTemporaryChat,
    handleJumpToMessage: navigationActions.handleJumpToMessage,
    handleListGallery: hostActions.handleListGallery,
    handleShowGallery: hostActions.handleShowGallery,
    handleTranslateText: hostActions.handleTranslateText,
    handleGetYouTubeTranscript: hostActions.handleGetYouTubeTranscript,
    handleGetClipboardText: hostActions.handleGetClipboardText,
    handleSetClipboardText: hostActions.handleSetClipboardText,
    handleIsExtensionInstalled: hostActions.handleIsExtensionInstalled,
    handleGetExtensionEnabledState: hostActions.handleGetExtensionEnabledState,
    handleSetExtensionEnabled: hostActions.handleSetExtensionEnabled,
    handleSelectProxyPreset: hostActions.handleSelectProxyPreset,
    handleGetWorldInfoTimedEffect: hostActions.handleGetWorldInfoTimedEffect,
    handleGetGroupMember: hostActions.handleGetGroupMember,
    handleGetGroupMemberCount: hostActions.handleGetGroupMemberCount,
    handleAddGroupMember: hostActions.handleAddGroupMember,
    handleRemoveGroupMember: hostActions.handleRemoveGroupMember,
    handleMoveGroupMember: hostActions.handleMoveGroupMember,
    handlePeekGroupMember: hostActions.handlePeekGroupMember,
    handleSetGroupMemberEnabled: hostActions.handleSetGroupMemberEnabled,
    handleSetWorldInfoTimedEffect: hostActions.handleSetWorldInfoTimedEffect,
    handleExecuteQuickReplyPanel: chatActions.handleExecuteQuickReplyPanel,
    handleSubmit: chatActions.handleSubmit,
  };
}
