/**
 * @input  react, next/navigation, next/link, app/i18n, components/*, hooks/*, lib/store/*, lib/slash-command, contexts/*
 * @output SessionPage (default export)
 * @pos    页面组件 - 会话交互页面，聊天/世界书/正则/预设管理
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          Session Page Component                            ║
 * ║                                                                            ║
 * ║  会话交互页面：聊天、世界书、正则脚本、预设管理                               ║
 * ║  路由参数：id (sessionId) - 会话的唯一标识符                                ║
 * ║  状态管理：Zustand Store 统一管理视图切换（单一数据源）                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/app/i18n";
import CharacterChatPanel from "@/components/CharacterChatPanel";
import QuickReplyPanel from "@/components/quick-reply/QuickReplyPanel";
import GroupMemberPanel from "@/components/group-chat/GroupMemberPanel";
import CheckpointPanel from "@/components/checkpoint/CheckpointPanel";
import WorldBookEditor from "@/components/WorldBookEditor";
import RegexScriptEditor from "@/components/RegexScriptEditor";
import PresetEditor from "@/components/PresetEditor";
import { toast } from "@/lib/store/toast-store";
import LoginModal from "@/components/LoginModal";
import { useHeaderContent } from "@/contexts/header-content";
import { ChatTopBarContent } from "@/components/chat/ChatTopBarContent";

import { useCharacterDialogue } from "@/hooks/useCharacterDialogue";
import { useCharacterLoader } from "@/hooks/useCharacterLoader";
import { useUIStore } from "@/lib/store/ui-store";
import { useUserStore } from "@/lib/store/user-store";
import { useSessionStore } from "@/lib/store/session-store";
import { useQuickReplyStore } from "@/lib/quick-reply/store";
import { useGroupChatStore } from "@/lib/group-chat/store";
import { useCheckpointStore } from "@/lib/checkpoint/store";
import { useScriptVariables } from "@/lib/store/script-variables";
import { useModelStore } from "@/lib/store/model-store";
import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import { syncModelConfigToStorage } from "@/lib/model-runtime";
import { usePromptConfigCallbacks } from "@/hooks/prompt-config/use-prompt-config-callbacks";
import { DialogueNode, DialogueTree } from "@/lib/models/node-model";
import { buildSwitchedSessionName, buildTemporarySessionName } from "@/app/session/session-switch";
import {
  buildSessionSlashHostBridgeDetail,
  resolveSessionSlashHostBridge,
} from "@/app/session/session-host-bridge";
import { createSessionDefaultHostBridge } from "@/app/session/session-host-defaults";
import {
  getSessionWorldInfoTimedEffect,
  setSessionWorldInfoTimedEffect,
} from "@/app/session/session-timed-world-info";
import { executeSlashCommandScript } from "@/lib/slash-command";
import type { DialogueMessage } from "@/types/character-dialogue";
import type {
  CharacterSwitchResult,
  ExecutionContext,
  TranslateTextOptions,
  WorldInfoTimedEffectFormat,
  WorldInfoTimedEffectName,
  WorldInfoTimedEffectState,
  YouTubeTranscriptOptions,
} from "@/lib/slash-command/types";
import { extractNodeIdFromMessageId } from "@/utils/message-id";
import {
  upsertPromptInjection,
  listPromptInjections,
} from "@/lib/slash-command/prompt-injection-store";
import DialogueTreeModal from "@/components/DialogueTreeModal";

// ============================================================================
//                              主组件
// ============================================================================

function buildDialogueTreeSnapshot(
  dialogueId: string,
  characterId: string,
  messages: DialogueMessage[],
  existingTree: DialogueTree | null,
): DialogueTree {
  if (messages.length === 0) {
    return existingTree || new DialogueTree(dialogueId, characterId, [], "root");
  }

  const existingById = new Map((existingTree?.nodes || []).map((node) => [node.nodeId, node]));
  const orderedNodeIds: string[] = [];
  const grouped = new Map<string, {
    userInput: string;
    assistantResponse: string;
    thinkingContent: string;
    hidden: boolean;
  }>();

  for (const message of messages) {
    const nodeId = extractNodeIdFromMessageId(message.id);
    if (!grouped.has(nodeId)) {
      grouped.set(nodeId, {
        userInput: "",
        assistantResponse: "",
        thinkingContent: "",
        hidden: false,
      });
      orderedNodeIds.push(nodeId);
    }

    const entry = grouped.get(nodeId)!;
    if (message.role === "user") {
      entry.userInput = message.content;
    }
    if (message.role === "assistant") {
      entry.assistantResponse = message.content;
      entry.thinkingContent = message.thinkingContent || entry.thinkingContent;
    }
    entry.hidden = entry.hidden || Boolean(message.hidden);
  }

  const pathNodes = orderedNodeIds.map((nodeId, index) => {
    const snapshot = grouped.get(nodeId)!;
    const existingNode = existingById.get(nodeId);
    const extra = { ...(existingNode?.extra || {}) };

    if (snapshot.hidden) {
      extra.hidden = true;
    } else {
      delete extra.hidden;
    }

    return new DialogueNode(
      nodeId,
      index === 0 ? "root" : orderedNodeIds[index - 1],
      snapshot.userInput || existingNode?.userInput || "",
      snapshot.assistantResponse || existingNode?.assistantResponse || "",
      snapshot.assistantResponse || existingNode?.fullResponse || "",
      snapshot.thinkingContent || existingNode?.thinkingContent,
      existingNode?.parsedContent,
      Object.keys(extra).length > 0 ? extra : undefined,
    );
  });

  const pathSet = new Set(orderedNodeIds);
  const otherNodes = (existingTree?.nodes || []).filter((node) => !pathSet.has(node.nodeId));

  return new DialogueTree(
    dialogueId,
    characterId,
    [...otherNodes, ...pathNodes],
    orderedNodeIds[orderedNodeIds.length - 1] || "root",
  );
}

function buildSessionSlashHostError(commandName: string, detail: string): Error {
  return new Error(`${commandName} is not wired in /session host yet: ${detail}`);
}

function getSessionMessageSelector(index: number): string {
  return `[data-session-message-index="${index}"]`;
}

function SessionPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("id");
  const { t, fontClass, serifFontClass, language } = useLanguage();

  // ========== Session Store - 获取 characterId ==========
  const getSessionById = useSessionStore((state) => state.getSessionById);
  const fetchAllSessions = useSessionStore((state) => state.fetchAllSessions);
  const createSession = useSessionStore((state) => state.createSession);
  const updateSessionName = useSessionStore((state) => state.updateSessionName);
  const sessions = useSessionStore((state) => state.sessions);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // ========== 参数校验：缺少 id 时重定向到首页 ==========
  useEffect(() => {
    if (!sessionId) {
      router.replace("/");
    }
  }, [sessionId, router]);

  // ========== 从 Session 获取 characterId ==========
  const isSessionsLoading = useSessionStore((state) => state.isLoading);
  const [hasTriedFetch, setHasTriedFetch] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) return;

      // 首次加载时获取所有 sessions
      if (!hasTriedFetch && sessions.length === 0) {
        setHasTriedFetch(true);
        await fetchAllSessions();
        return; // fetchAllSessions 完成后会触发 sessions 变化，重新执行此 effect
      }

      // 等待加载完成
      if (isSessionsLoading) return;

      const session = getSessionById(sessionId);
      if (session) {
        setCharacterId(session.characterId);
        setSessionError(null);
      } else if (hasTriedFetch) {
        // 只有在已尝试加载后才显示错误
        setSessionError(t("characterChat.sessionNotFound") || "Session not found");
      }
    };

    loadSession();
  }, [sessionId, sessions, isSessionsLoading, hasTriedFetch, getSessionById, fetchAllSessions, t]);

  // ========== Zustand Store - 单一数据源 ==========
  const characterView = useUIStore((state) => state.characterView);
  const setCharacterView = useUIStore((state) => state.setCharacterView);
  const presetViewPayload = useUIStore((state) => state.presetViewPayload);
  const resetPresetViewPayload = useUIStore((state) => state.resetPresetViewPayload);
  const displayUsername = useUserStore((state) => state.displayUsername);

  // ========== 对话 Hook ==========
  const dialogue = useCharacterDialogue({
    characterId,
    sessionId,
    dialogueKey: sessionId,
    onError: toast.error,
    t,
  });
  const setScriptVariable = useScriptVariables((state) => state.setVariable);
  const deleteScriptVariable = useScriptVariables((state) => state.deleteVariable);

  // ========== 加载 Hook ==========
  const loader = useCharacterLoader({
    characterId,
    sessionId,
    dialogueKey: sessionId,
    initializeNewDialogue: dialogue.initializeNewDialogue,
    t,
  });

  // ========== 业务状态 ==========
  const [userInput, setUserInput] = useState("");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  /**
   * 活动模式配置
   * 使用明确的类型定义，避免 any
   */
  type PerspectiveMode = { active: boolean; mode: "novel" | "screenplay" | "chat" };
  type ActiveModesConfig = {
    "story-progress": boolean;
    perspective: PerspectiveMode;
    "scene-setting": boolean;
  };

  const [activeModes, setActiveModes] = useState<ActiveModesConfig>({
    "story-progress": false,
    perspective: { active: false, mode: "novel" },
    "scene-setting": false,
  });
  const [isBranchOpen, setIsBranchOpen] = useState(false);
  const [characterNameOverride, setCharacterNameOverride] = useState<string | null>(null);
  const { setHeaderContent } = useHeaderContent();
  const currentCharacterName = characterNameOverride || loader.character?.name || "";
  const currentSessionName = sessionId ? getSessionById(sessionId)?.name || "" : "";
  const currentCharacter = useMemo(() => {
    if (!loader.character) return null;
    return { ...loader.character, name: currentCharacterName };
  }, [loader.character, currentCharacterName]);
  const defaultSessionHostBridge = useMemo(() => createSessionDefaultHostBridge({
    language,
  }), [language]);
  const resolveSessionHostBridge = useCallback(() => {
    if (typeof window === "undefined") {
      return defaultSessionHostBridge;
    }

    const injectedBridge = resolveSessionSlashHostBridge(window);
    if (!injectedBridge) {
      return defaultSessionHostBridge;
    }

    return {
      ...defaultSessionHostBridge,
      ...injectedBridge,
    };
  }, [defaultSessionHostBridge]);

  useEffect(() => {
    setCharacterNameOverride(null);
  }, [characterId]);

  useEffect(() => {
    if (!currentCharacter) {
      setHeaderContent(null);
      return;
    }
    setHeaderContent(
      <ChatTopBarContent
        character={currentCharacter}
        activeView={characterView}
        onOpenBranches={() => setIsBranchOpen(true)}
      />,
    );
    return () => setHeaderContent(null);
  }, [currentCharacter, characterView, setHeaderContent]);

  // ═══════════════════════════════════════════════════════════════
  // 同步加载数据到对话状态
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (loader.dialogueData) {
      dialogue.setMessages(loader.dialogueData.messages);
      dialogue.setSuggestedInputs(loader.dialogueData.suggestedInputs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loader.dialogueData]);

  // ========== 监听 Store 变化 ==========
  useEffect(() => {
    if (presetViewPayload && characterView === "preset") {
      if (presetViewPayload.presetId) {
        sessionStorage.setItem("activate_preset_id", presetViewPayload.presetId);
      } else if (presetViewPayload.presetName) {
        sessionStorage.setItem("activate_preset_name", presetViewPayload.presetName);
      }
      resetPresetViewPayload();
    }
  }, [presetViewPayload, characterView, resetPresetViewPayload]);

  // ═══════════════════════════════════════════════════════════════
  // 响应用户名变化，重新加载对话
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (sessionId) {
      dialogue.fetchLatestDialogue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayUsername, sessionId]);

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

  const handleSwitchCharacter = useCallback(async (target: string): Promise<CharacterSwitchResult> => {
    const nextCharacterId = await resolveCharacterSwitchTarget(target);
    const nextCharacterRecord = await LocalCharacterRecordOperations.getCharacterById(nextCharacterId);
    const nextCharacterName = nextCharacterRecord?.data?.name?.trim() || nextCharacterId;
    const switchedSessionName = buildSwitchedSessionName(nextCharacterName, currentCharacterName);
    const nextSessionId = await createSession(nextCharacterId, { name: switchedSessionName });
    if (!nextSessionId) {
      throw new Error(`Failed to create session for character: ${nextCharacterId}`);
    }
    router.push(`/session?id=${encodeURIComponent(nextSessionId)}`);
    return {
      target,
      characterId: nextCharacterId,
      characterName: nextCharacterName,
      sessionId: nextSessionId,
      sessionName: switchedSessionName,
    };
  }, [createSession, currentCharacterName, resolveCharacterSwitchTarget, router]);

  const handleRenameChat = useCallback(async (nextName: string): Promise<string> => {
    const normalized = nextName.trim();
    if (!sessionId) {
      throw new Error("Session ID is required to rename chat");
    }
    if (!normalized) {
      throw new Error("Chat name is required");
    }

    const updated = await updateSessionName(sessionId, normalized);
    if (!updated) {
      throw new Error(`Failed to rename chat: ${sessionId}`);
    }
    return normalized;
  }, [sessionId, updateSessionName]);

  const handleRenameCurrentCharacter = useCallback(async (nextName: string): Promise<string> => {
    const normalized = nextName.trim();
    if (!characterId) {
      throw new Error("Character ID is required to rename character");
    }
    if (!normalized) {
      throw new Error("Character name is required");
    }

    const updated = await LocalCharacterRecordOperations.updateCharacter(characterId, { name: normalized });
    if (!updated) {
      throw new Error(`Failed to rename character: ${characterId}`);
    }

    setCharacterNameOverride(normalized);
    return normalized;
  }, [characterId]);

  const handleHideMessages = useCallback(async (startIndex: number): Promise<void> => {
    if (startIndex < 0 || startIndex >= dialogue.messages.length) {
      throw new Error(`/hide message index out of range: ${startIndex}`);
    }

    const nextMessages = dialogue.messages.map((message, index) => index >= startIndex
      ? { ...message, hidden: true }
      : message);
    dialogue.setMessages(nextMessages);
  }, [dialogue]);

  const handleUnhideMessages = useCallback(async (): Promise<void> => {
    const nextMessages = dialogue.messages.map((message) => message.hidden
      ? { ...message, hidden: false }
      : message);
    dialogue.setMessages(nextMessages);
  }, [dialogue]);

  const handleForceSaveChat = useCallback(async (): Promise<void> => {
    if (!sessionId || !characterId) {
      throw new Error("Session and character are required to save chat");
    }

    const existingTree = await LocalCharacterDialogueOperations.getDialogueTreeById(sessionId);
    const nextTree = buildDialogueTreeSnapshot(sessionId, characterId, dialogue.messages, existingTree);
    await LocalCharacterDialogueOperations.updateDialogueTree(sessionId, nextTree);
  }, [sessionId, characterId, dialogue.messages]);

  const handleCreateCheckpoint = useCallback(async (
    messageId: string,
    requestedName?: string,
  ): Promise<string> => {
    if (!sessionId) {
      throw buildSessionSlashHostError("/checkpoint-create", "active dialogue session");
    }
    return useCheckpointStore.getState().createCheckpoint(sessionId, messageId, requestedName);
  }, [sessionId]);

  const handleCreateBranch = useCallback(async (messageId: string): Promise<string> => {
    if (!sessionId) {
      throw buildSessionSlashHostError("/branch-create", "active dialogue session");
    }
    return useCheckpointStore.getState().createBranch(sessionId, messageId, sessionId);
  }, [sessionId]);

  const handleGetCheckpoint = useCallback(async (messageId: string): Promise<string> => {
    if (!sessionId) {
      throw buildSessionSlashHostError("/checkpoint-get", "active dialogue session");
    }
    return useCheckpointStore.getState().getCheckpoint(sessionId, messageId);
  }, [sessionId]);

  const handleListCheckpoints = useCallback(async (
    options?: { links?: boolean },
  ): Promise<Array<number | string>> => {
    if (!sessionId) {
      throw buildSessionSlashHostError("/checkpoint-list", "active dialogue session");
    }
    return useCheckpointStore.getState().listCheckpoints(sessionId, dialogue.messages, options?.links ?? false);
  }, [sessionId, dialogue.messages]);

  const handleGoCheckpoint = useCallback(async (messageId: string): Promise<string> => {
    if (!sessionId) {
      throw buildSessionSlashHostError("/checkpoint-go", "active dialogue session");
    }
    return useCheckpointStore.getState().goCheckpoint(sessionId, messageId, sessionId);
  }, [sessionId]);

  const handleExitCheckpoint = useCallback(async (): Promise<string> => {
    if (!sessionId) {
      throw buildSessionSlashHostError("/checkpoint-exit", "active dialogue session");
    }
    return useCheckpointStore.getState().exitCheckpoint(sessionId);
  }, [sessionId]);

  const handleGetCheckpointParent = useCallback(async (): Promise<string> => {
    if (!sessionId) {
      throw buildSessionSlashHostError("/checkpoint-parent", "active dialogue session");
    }
    return useCheckpointStore.getState().getCheckpointParent(sessionId);
  }, [sessionId]);

  const handleOpenTemporaryChat = useCallback(async (): Promise<void> => {
    if (!characterId) {
      throw new Error("Character ID is required to open temporary chat");
    }

    const nextSessionName = buildTemporarySessionName(currentCharacterName);
    const nextSessionId = await createSession(characterId, { name: nextSessionName });
    if (!nextSessionId) {
      throw new Error(`Failed to create temporary chat for character: ${characterId}`);
    }

    router.push(`/session?id=${encodeURIComponent(nextSessionId)}`);
  }, [characterId, createSession, currentCharacterName, router]);

  const handleJumpToMessage = useCallback(async (index: number): Promise<void> => {
    if (index < 0 || index >= dialogue.messages.length) {
      throw new Error(`/chat-jump message index out of range: ${index}`);
    }
    if (typeof document === "undefined") {
      throw new Error("/chat-jump requires browser document");
    }

    const target = document.querySelector<HTMLElement>(getSessionMessageSelector(index));
    if (!target) {
      throw new Error(`/chat-jump message element not found: ${index}`);
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [dialogue.messages.length]);

  const handleTranslateText = useCallback(async (
    text: string,
    options?: TranslateTextOptions,
  ): Promise<string> => {
    const hostBridge = resolveSessionHostBridge();
    if (!hostBridge?.translateText) {
      throw buildSessionSlashHostError("/translate", buildSessionSlashHostBridgeDetail("translateText"));
    }

    const translated = await Promise.resolve(hostBridge.translateText(text, options));
    if (typeof translated !== "string") {
      throw new Error("/translate host returned non-string result");
    }
    return translated;
  }, [resolveSessionHostBridge]);

  const handleGetYouTubeTranscript = useCallback(async (
    urlOrId: string,
    options?: YouTubeTranscriptOptions,
  ): Promise<string> => {
    const hostBridge = resolveSessionHostBridge();
    if (!hostBridge?.getYouTubeTranscript) {
      throw buildSessionSlashHostError("/yt-script", buildSessionSlashHostBridgeDetail("getYouTubeTranscript"));
    }

    const transcript = await Promise.resolve(hostBridge.getYouTubeTranscript(urlOrId, options));
    if (typeof transcript !== "string") {
      throw new Error("/yt-script host returned non-string result");
    }
    return transcript;
  }, [resolveSessionHostBridge]);

  const handleSelectProxyPreset = useCallback(async (name?: string): Promise<string> => {
    const { configs, activeConfigId, setActiveConfig } = useModelStore.getState();
    if (configs.length === 0) {
      throw buildSessionSlashHostError("/proxy", "model-store config presets");
    }

    const normalized = (name || "").trim();
    if (normalized.length === 0) {
      const active = configs.find((config) => config.id === activeConfigId) || configs[0];
      if (!active) {
        throw buildSessionSlashHostError("/proxy", "active proxy preset");
      }
      return active.name;
    }

    const target = configs.find((config) => config.name === normalized || config.id === normalized);
    if (!target) {
      throw new Error(`/proxy preset not found: ${normalized}`);
    }

    setActiveConfig(target.id);
    syncModelConfigToStorage(target);
    return target.name;
  }, []);

  const handleGetWorldInfoTimedEffect = useCallback(async (
    file: string,
    uid: string,
    effect: WorldInfoTimedEffectName,
    options?: { format?: WorldInfoTimedEffectFormat },
  ): Promise<boolean | number> => {
    if (!sessionId) {
      throw buildSessionSlashHostError("/wi-get-timed-effect", "active dialogue session");
    }

    return getSessionWorldInfoTimedEffect({
      dialogueId: sessionId,
      file,
      uid,
      effect,
      format: options?.format,
    });
  }, [sessionId]);

  const handleGetGroupMember = useCallback(async (
    target: string,
    field: "name" | "index" | "id" | "avatar",
  ): Promise<string | number> => {
    if (!sessionId) {
      throw buildSessionSlashHostError("/getmember", "active dialogue session");
    }
    return useGroupChatStore.getState().getGroupMember(sessionId, target, field);
  }, [sessionId]);

  const handleGetGroupMemberCount = useCallback(async (): Promise<number> => {
    if (!sessionId) {
      throw buildSessionSlashHostError("/countmember", "active dialogue session");
    }
    return useGroupChatStore.getState().getGroupMemberCount(sessionId);
  }, [sessionId]);

  const handleAddGroupMember = useCallback(async (target: string): Promise<string> => {
    if (!sessionId) {
      throw buildSessionSlashHostError("/addmember", "active dialogue session");
    }
    return useGroupChatStore.getState().addGroupMember(sessionId, target);
  }, [sessionId]);

  const handleRemoveGroupMember = useCallback(async (target: string): Promise<string> => {
    if (!sessionId) {
      throw buildSessionSlashHostError("/member-remove", "active dialogue session");
    }
    return useGroupChatStore.getState().removeGroupMember(sessionId, target);
  }, [sessionId]);

  const handleMoveGroupMember = useCallback(async (
    target: string,
    direction: "up" | "down",
  ): Promise<number> => {
    if (!sessionId) {
      throw buildSessionSlashHostError("/member-up", "active dialogue session");
    }
    return useGroupChatStore.getState().moveGroupMember(sessionId, target, direction);
  }, [sessionId]);

  const handlePeekGroupMember = useCallback(async (target: string): Promise<string> => {
    if (!sessionId) {
      throw buildSessionSlashHostError("/member-peek", "active dialogue session");
    }
    return useGroupChatStore.getState().peekGroupMember(sessionId, target);
  }, [sessionId]);

  const handleSetGroupMemberEnabled = useCallback(async (
    target: string,
    enabled: boolean,
  ): Promise<string> => {
    if (!sessionId) {
      throw buildSessionSlashHostError(enabled ? "/enable" : "/disable", "active dialogue session");
    }
    return useGroupChatStore.getState().setGroupMemberEnabled(sessionId, target, enabled);
  }, [sessionId]);

  const promptCallbacks = usePromptConfigCallbacks();

  const handleSetWorldInfoTimedEffect = useCallback(async (
    file: string,
    uid: string,
    effect: WorldInfoTimedEffectName,
    state: WorldInfoTimedEffectState,
  ): Promise<void> => {
    if (!sessionId) {
      throw buildSessionSlashHostError("/wi-set-timed-effect", "active dialogue session");
    }

    await setSessionWorldInfoTimedEffect({
      dialogueId: sessionId,
      file,
      uid,
      effect,
      state,
    });
  }, [sessionId]);

  const executeSessionSlashInput = useCallback(async (script: string) => {
    const snapshot = useScriptVariables.getState().variables;
    const globalVariables: Record<string, unknown> = { ...snapshot.global };
    const characterVariables: Record<string, unknown> = characterId && snapshot.character[characterId]
      ? { ...snapshot.character[characterId] }
      : {};

    const hasCharacterVariable = (key: string): boolean =>
      Object.prototype.hasOwnProperty.call(characterVariables, key);

    const getVariable = (key: string): unknown => {
      if (hasCharacterVariable(key)) {
        return characterVariables[key];
      }
      return globalVariables[key];
    };

    const setVariable = (key: string, value: unknown): void => {
      if (characterId) {
        characterVariables[key] = value;
        setScriptVariable(key, value, "character", characterId);
        return;
      }

      globalVariables[key] = value;
      setScriptVariable(key, value, "global");
    };

    const deleteVariable = (key: string): void => {
      if (characterId) {
        delete characterVariables[key];
        deleteScriptVariable(key, "character", characterId);
        return;
      }

      delete globalVariables[key];
      deleteScriptVariable(key, "global");
    };

    const quickReplyStore = useQuickReplyStore.getState();
    let executionContext: ExecutionContext;

    const executeVisibleQuickReply = async (index: number): Promise<string> => {
      const entry = quickReplyStore.resolveVisibleQuickReply(sessionId || undefined, index);
      if (sessionId) {
        quickReplyStore.activateContextSets(sessionId, entry.reply);
      }

      const payload = entry.reply.message.trim();
      if (!payload) {
        return "";
      }
      if (entry.set.nosend) {
        setUserInput(payload);
        return payload;
      }
      if (payload.startsWith("/")) {
        return executionContext.runSlashCommand
          ? executionContext.runSlashCommand(payload)
          : "";
      }
      await dialogue.addUserMessage(payload, undefined);
      return payload;
    };

    executionContext = {
      characterId: characterId || undefined,
      dialogueId: sessionId || undefined,
      messages: dialogue.messages,
      onSend: async (text, options) => dialogue.addUserMessage(text, options),
      onTrigger: async () => dialogue.triggerGeneration(),
      onSendAs: async (role, text) => dialogue.addRoleMessage(role, text),
      onSendSystem: async (text, options) => dialogue.addRoleMessage("system", text, options),
      onImpersonate: async (text) => dialogue.addRoleMessage("assistant", text),
      onContinue: async () => dialogue.triggerGeneration(),
      onSwipe: dialogue.handleSwipe,
      getCurrentChatName: () => currentSessionName || sessionId || "",
      renameCurrentChat: handleRenameChat,
      setInputText: async (text) => setUserInput(text),
      createCheckpoint: handleCreateCheckpoint,
      createBranch: handleCreateBranch,
      getCheckpoint: handleGetCheckpoint,
      listCheckpoints: handleListCheckpoints,
      goCheckpoint: handleGoCheckpoint,
      exitCheckpoint: handleExitCheckpoint,
      getCheckpointParent: handleGetCheckpointParent,
      openTemporaryChat: handleOpenTemporaryChat,
      forceSaveChat: handleForceSaveChat,
      hideMessages: handleHideMessages,
      unhideMessages: handleUnhideMessages,
      translateText: handleTranslateText,
      getYouTubeTranscript: handleGetYouTubeTranscript,
      ...promptCallbacks,
      selectProxyPreset: handleSelectProxyPreset,
      getWorldInfoTimedEffect: handleGetWorldInfoTimedEffect,
      setWorldInfoTimedEffect: handleSetWorldInfoTimedEffect,
      getGroupMember: handleGetGroupMember,
      getGroupMemberCount: handleGetGroupMemberCount,
      addGroupMember: handleAddGroupMember,
      removeGroupMember: handleRemoveGroupMember,
      moveGroupMember: handleMoveGroupMember,
      peekGroupMember: handlePeekGroupMember,
      setGroupMemberEnabled: handleSetGroupMemberEnabled,
      jumpToMessage: handleJumpToMessage,
      renameCurrentCharacter: handleRenameCurrentCharacter,
      getMessageReasoning: async (index) => {
        const message = dialogue.messages[index];
        if (!message) {
          throw new Error(`/get-reasoning message index out of range: ${index}`);
        }
        return message.thinkingContent || "";
      },
      setMessageReasoning: async (index, reasoning) => {
        if (!dialogue.messages[index]) {
          throw new Error(`/set-reasoning message index out of range: ${index}`);
        }
        const nextMessages = dialogue.messages.map((message, currentIndex) => currentIndex === index
          ? { ...message, thinkingContent: reasoning }
          : message);
        dialogue.setMessages(nextMessages);
      },
      injectPrompt: async (prompt, options) => {
        upsertPromptInjection(
          {
            content: prompt,
            role: options?.role,
            position: options?.position || "in_chat",
            depth: options?.depth,
          },
          {
            characterId: characterId || undefined,
            dialogueId: sessionId || undefined,
          },
        );
      },
      listPromptInjections: async () => {
        return listPromptInjections({
          characterId: characterId || undefined,
          dialogueId: sessionId || undefined,
        });
      },
      executeQuickReplyByIndex: executeVisibleQuickReply,
      toggleGlobalQuickReplySet: async (name, options) => quickReplyStore.toggleGlobalQuickReplySet(name, options),
      addGlobalQuickReplySet: async (name, options) => quickReplyStore.addGlobalQuickReplySet(name, options),
      removeGlobalQuickReplySet: async (name) => quickReplyStore.removeGlobalQuickReplySet(name),
      toggleChatQuickReplySet: async (name, options) => quickReplyStore.toggleChatQuickReplySet(sessionId || "", name, options),
      addChatQuickReplySet: async (name, options) => quickReplyStore.addChatQuickReplySet(sessionId || "", name, options),
      removeChatQuickReplySet: async (name) => quickReplyStore.removeChatQuickReplySet(sessionId || "", name),
      listQuickReplySets: async (scope) => quickReplyStore.listQuickReplySets(scope, sessionId || undefined),
      listQuickReplies: async (setName) => quickReplyStore.listQuickReplies(setName),
      getQuickReply: async (setName, target) => quickReplyStore.getQuickReply(setName, target),
      createQuickReply: async (setName, label, message, options) => {
        quickReplyStore.createQuickReply(setName, label, message, options);
      },
      updateQuickReply: async (setName, target, options) => {
        quickReplyStore.updateQuickReply(setName, target, options);
      },
      deleteQuickReply: async (setName, target) => quickReplyStore.deleteQuickReply(setName, target),
      addQuickReplyContextSet: async (setName, target, contextSetName, options) => {
        quickReplyStore.addQuickReplyContextSet(setName, target, contextSetName, options);
      },
      removeQuickReplyContextSet: async (setName, target, contextSetName) => {
        quickReplyStore.removeQuickReplyContextSet(setName, target, contextSetName);
      },
      clearQuickReplyContextSets: async (setName, target) => {
        quickReplyStore.clearQuickReplyContextSets(setName, target);
      },
      createQuickReplySet: async (name, options) => {
        quickReplyStore.createQuickReplySet(name, options);
      },
      updateQuickReplySet: async (name, options) => {
        quickReplyStore.updateQuickReplySet(name, options);
      },
      deleteQuickReplySet: async (name) => quickReplyStore.deleteQuickReplySet(name, sessionId || undefined),
      switchCharacter: handleSwitchCharacter,
      getVariable,
      setVariable,
      deleteVariable,
      listVariables: () => {
        const keys = new Set<string>(Object.keys(globalVariables));
        for (const key of Object.keys(characterVariables)) {
          keys.add(key);
        }
        return Array.from(keys);
      },
      dumpVariables: () => ({
        ...globalVariables,
        ...characterVariables,
      }),
      getScopedVariable: (scope, key) => {
        if (scope === "global") {
          return globalVariables[key];
        }
        return getVariable(key);
      },
      setScopedVariable: (scope, key, value) => {
        if (scope === "global") {
          globalVariables[key] = value;
          setScriptVariable(key, value, "global");
          return;
        }
        setVariable(key, value);
      },
      deleteScopedVariable: (scope, key) => {
        if (scope === "global") {
          delete globalVariables[key];
          deleteScriptVariable(key, "global");
          return;
        }
        deleteVariable(key);
      },
      listScopedVariables: (scope) => {
        if (scope === "global") {
          return Object.keys(globalVariables);
        }
        const keys = new Set<string>(Object.keys(globalVariables));
        for (const key of Object.keys(characterVariables)) {
          keys.add(key);
        }
        return Array.from(keys);
      },
      dumpScopedVariables: (scope) => {
        if (scope === "global") {
          return { ...globalVariables };
        }
        return {
          ...globalVariables,
          ...characterVariables,
        };
      },
    };

    executionContext.runSlashCommand = async (nestedScript: string) => {
      const nestedResult = await executeSlashCommandScript(nestedScript, executionContext);
      if (nestedResult.isError) {
        throw new Error(nestedResult.errorMessage || "runSlashCommand failed");
      }
      return nestedResult.pipe;
    };

    const result = await executeSlashCommandScript(script, executionContext);
    if (result.isError) {
      throw new Error(result.errorMessage || "Slash command execution failed");
    }
  }, [
    dialogue,
    characterId,
    currentSessionName,
    sessionId,
    handleSwitchCharacter,
    handleRenameChat,
    handleCreateCheckpoint,
    handleCreateBranch,
    handleGetCheckpoint,
    handleListCheckpoints,
    handleGoCheckpoint,
    handleExitCheckpoint,
    handleGetCheckpointParent,
    handleOpenTemporaryChat,
    handleForceSaveChat,
    handleHideMessages,
    handleUnhideMessages,
    handleTranslateText,
    handleGetYouTubeTranscript,
    promptCallbacks,
    handleSelectProxyPreset,
    handleGetWorldInfoTimedEffect,
    handleSetWorldInfoTimedEffect,
    handleGetGroupMember,
    handleGetGroupMemberCount,
    handleAddGroupMember,
    handleRemoveGroupMember,
    handleMoveGroupMember,
    handlePeekGroupMember,
    handleSetGroupMemberEnabled,
    handleJumpToMessage,
    handleRenameCurrentCharacter,
    setScriptVariable,
    deleteScriptVariable,
  ]);

  const handleExecuteQuickReplyPanel = useCallback(async (index: number): Promise<void> => {
    try {
      await executeSessionSlashInput(`/qr ${index}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(errorMessage);
    }
  }, [executeSessionSlashInput]);

  // ========== 提交消息 ==========
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const inputText = userInput;
      const trimmedInput = inputText.trim();
      if (!trimmedInput || dialogue.isSending) return;
      setUserInput("");

      if (trimmedInput.startsWith("/")) {
        try {
          await executeSessionSlashInput(trimmedInput);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          toast.error(errorMessage);
        }
        return;
      }

      const hints: string[] = [];

      if (activeModes["story-progress"]) {
        hints.push(t("characterChat.storyProgressHint"));
      }
      if (activeModes["perspective"].active) {
        const hintKey =
          activeModes["perspective"].mode === "novel"
            ? "characterChat.novelPerspectiveHint"
            : "characterChat.protagonistPerspectiveHint";
        hints.push(t(hintKey));
      }
      if (activeModes["scene-setting"]) {
        hints.push(t("characterChat.sceneTransitionHint"));
      }

      let message: string;
      if (hints.length > 0) {
        message = `
      <input_message>
      ${t("characterChat.playerInput")}：${inputText}
      </input_message>
      <response_instructions>
      ${t("characterChat.responseInstructions")}：${hints.join(" ")}
      </response_instructions>
        `.trim();
      } else {
        message = `
      <input_message>
      ${t("characterChat.playerInput")}：${inputText}
      </input_message>
        `.trim();
      }

      await dialogue.handleSendMessage(message);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userInput, dialogue.isSending, dialogue.handleSendMessage, activeModes, t, executeSessionSlashInput],
  );

  // ========== 渲染：缺少 sessionId ==========
  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <p className="text-sm text-foreground">{t("characterChat.redirecting") || "Redirecting..."}</p>
      </div>
    );
  }

  // ========== 渲染：Session 不存在 ==========
  if (sessionError) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-2xl text-cream mb-4">{t("characterChat.error")}</h1>
        <p className="text-primary-soft mb-6">{sessionError}</p>
        <Link
          href="/"
          className="bg-muted-surface hover:bg-muted-surface text-cream font-medium py-2 px-4 rounded border border-border"
        >
          {t("characterChat.backToHome") || t("characterChat.backToCharacters")}
        </Link>
      </div>
    );
  }

  // ========== 渲染：等待 characterId 加载 ==========
  if (!characterId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <p className="text-sm text-foreground">{t("characterChat.loading") || "Loading..."}</p>
      </div>
    );
  }

  // ========== 渲染：加载状态 ==========
  if (loader.isLoading || loader.isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <p className="text-sm text-foreground">{loader.loadingPhase}</p>
        {loader.isInitializing && (
          <p className={`text-ink-soft text-xs max-w-xs text-center ${fontClass}`}>
            {t("characterChat.loadingTimeHint")}
          </p>
        )}
      </div>
    );
  }

  // ========== 渲染：错误状态（包括 sessionId 无效） ==========
  if (loader.error || !loader.character) {
    return (
      <div className="flex flex-col items-center justify-center h-full ">
        <h1 className="text-2xl text-cream mb-4">{t("characterChat.error")}</h1>
        <p className="text-primary-soft mb-6">
          {loader.error || t("characterChat.sessionNotFound") || t("characterChat.characterNotFound")}
        </p>
        <Link
          href="/"
          className="bg-muted-surface hover:bg-muted-surface text-cream font-medium py-2 px-4 rounded border border-border"
        >
          {t("characterChat.backToHome") || t("characterChat.backToCharacters")}
        </Link>
      </div>
    );
  }

  // ========== 渲染：主界面 ==========
  return (
    <div className="flex h-full relative overflow-hidden">
      <div className="flex-1 h-full flex flex-col min-w-0">
        {characterView === "chat" ? (
          <CharacterChatPanel
            character={currentCharacter!}
            messages={dialogue.messages}
            openingMessages={dialogue.openingMessages}
            openingIndex={dialogue.openingIndex}
            openingLocked={dialogue.openingLocked}
            userInput={userInput}
            setUserInput={setUserInput}
            isSending={dialogue.isSending}
            suggestedInputs={dialogue.suggestedInputs}
            onSubmit={handleSubmit}
            onSuggestedInput={setUserInput}
            onTruncate={dialogue.truncateMessagesAfter}
            onRegenerate={dialogue.handleRegenerate}
            onOpeningNavigate={dialogue.handleOpeningNavigate}
            fontClass={fontClass}
            serifFontClass={serifFontClass}
            t={t}
            activeModes={activeModes as Record<string, unknown>}
            setActiveModes={setActiveModes as React.Dispatch<React.SetStateAction<Record<string, unknown>>>}
            language={language as "zh" | "en"}
            dialogueKey={sessionId}
            chatName={currentSessionName}
            onSendMessage={dialogue.addUserMessage}
            onTriggerGeneration={dialogue.triggerGeneration}
            onSendAs={(role, text) => dialogue.addRoleMessage(role, text)}
            onSendSystem={(text, options) => dialogue.addRoleMessage("system", text, options)}
            onImpersonate={(text) => dialogue.addRoleMessage("assistant", text)}
            onContinue={dialogue.triggerGeneration}
            onSwipe={dialogue.handleSwipe}
            onRenameChat={handleRenameChat}
            onCreateCheckpoint={handleCreateCheckpoint}
            onCreateBranch={handleCreateBranch}
            onGetCheckpoint={handleGetCheckpoint}
            onListCheckpoints={handleListCheckpoints}
            onGoCheckpoint={handleGoCheckpoint}
            onExitCheckpoint={handleExitCheckpoint}
            onGetCheckpointParent={handleGetCheckpointParent}
            onOpenTemporaryChat={handleOpenTemporaryChat}
            onForceSaveChat={handleForceSaveChat}
            onHideMessages={handleHideMessages}
            onUnhideMessages={handleUnhideMessages}
            onTranslateText={handleTranslateText}
            onGetYouTubeTranscript={handleGetYouTubeTranscript}
            onSelectProxyPreset={handleSelectProxyPreset}
            onGetWorldInfoTimedEffect={handleGetWorldInfoTimedEffect}
            onSetWorldInfoTimedEffect={handleSetWorldInfoTimedEffect}
            onGetGroupMember={handleGetGroupMember}
            onAddGroupMember={handleAddGroupMember}
            onRemoveGroupMember={handleRemoveGroupMember}
            onMoveGroupMember={handleMoveGroupMember}
            onPeekGroupMember={handlePeekGroupMember}
            onGetGroupMemberCount={handleGetGroupMemberCount}
            onSetGroupMemberEnabled={handleSetGroupMemberEnabled}
            onJumpToMessage={handleJumpToMessage}
            onSwitchCharacter={handleSwitchCharacter}
            onRenameCurrentCharacter={handleRenameCurrentCharacter}
            onExportJsonl={dialogue.exportJsonl}
            onImportJsonl={dialogue.importJsonl}
            footerSlot={(
              <>
                <QuickReplyPanel
                  dialogueId={sessionId || undefined}
                  onExecuteQuickReply={handleExecuteQuickReplyPanel}
                />
                <GroupMemberPanel dialogueId={sessionId || undefined} />
                <CheckpointPanel
                  dialogueId={sessionId || undefined}
                  messages={dialogue.messages}
                />
              </>
            )}
          />
        ) : characterView === "worldbook" ? (
          <WorldBookEditor
            onClose={() => setCharacterView("chat")}
            characterName={currentCharacterName}
            characterId={characterId || ""}
          />
        ) : characterView === "preset" ? (
          <PresetEditor
            onClose={() => setCharacterView("chat")}
            characterName={currentCharacterName}
            characterId={characterId || ""}
          />
        ) : (
          <RegexScriptEditor
            onClose={() => setCharacterView("chat")}
            characterName={currentCharacterName}
            characterId={characterId || ""}
          />
        )}
      </div>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      <DialogueTreeModal
        isOpen={isBranchOpen}
        onClose={() => setIsBranchOpen(false)}
        characterId={characterId || undefined}
        sessionId={sessionId || undefined}
        onDialogueEdit={() => dialogue.fetchLatestDialogue()}
      />
    </div>
  );
}

// ============================================================================
//                              Suspense 包装
// ============================================================================

export default function SessionPage() {
  const { t } = useLanguage();

  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <p className="text-sm text-foreground">{t("characterChat.loading") || "Loading..."}</p>
        </div>
      }
    >
      <SessionPageContent />
    </Suspense>
  );
}
