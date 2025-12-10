/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    useCharacterDialogue Hook                               ║
 * ║                                                                            ║
 * ║  基于 Zustand Store 的对话管理 - 消除不稳定依赖                              ║
 * ║  设计原则：数据驱动、引用稳定、性能优化                                        ║
 * ║  【重构】从 useState 迁移到 Zustand Store                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback } from "react";
import { useDialogueStore } from "@/lib/store/dialogue-store";
import { useDialoguePreferences } from "@/hooks/character-dialogue/useDialoguePreferences";
import type { SendOptions } from "@/lib/slash-command/types";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

export interface UseCharacterDialogueOptions {
  characterId: string | null;
  sessionId?: string | null;
  dialogueKey?: string | null;  // sessionId 或 characterId，用于 Store 索引
  onError?: (message: string) => void;
  t: (key: string) => string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   稳定的空值常量 - 避免 selector 返回新引用导致无限循环
   ═══════════════════════════════════════════════════════════════════════════ */

const EMPTY_MESSAGES: never[] = [];
const EMPTY_OPENING_MESSAGES: never[] = [];
const EMPTY_SUGGESTED_INPUTS: never[] = [];

/* ═══════════════════════════════════════════════════════════════════════════
   主 Hook
   ═══════════════════════════════════════════════════════════════════════════ */

export function useCharacterDialogue({
  characterId,
  sessionId,
  dialogueKey,
  onError,
  t,
}: UseCharacterDialogueOptions) {
  const { language, readLlmConfig, responseLength, fastModelEnabled } = useDialoguePreferences();

  // ═══════════════════════════════════════════════════════════════
  // 计算实际的对话索引 Key
  // 
  // 【设计】优先使用 sessionId，回退到 characterId（兼容旧链接）
  // ═══════════════════════════════════════════════════════════════
  const storeKey = dialogueKey || sessionId || characterId;

  // ═══════════════════════════════════════════════════════════════
  // 从 Store 订阅状态
  // 
  // 【性能优化】细粒度 selector - 每个字段独立订阅
  // 只有对应字段变化时才触发组件重渲染
  // 避免整个 dialogue 对象变化导致的级联更新
  // ═══════════════════════════════════════════════════════════════
  
  // 展示数据 - 独立订阅，使用稳定常量避免引用变化
  const messages = useDialogueStore(
    useCallback(
      (state) => state.dialogues[storeKey ?? ""]?.messages ?? EMPTY_MESSAGES,
      [storeKey],
    ),
  );
  
  const openingMessages = useDialogueStore(
    useCallback(
      (state) => state.dialogues[storeKey ?? ""]?.openingMessages ?? EMPTY_OPENING_MESSAGES,
      [storeKey],
    ),
  );
  
  const suggestedInputs = useDialogueStore(
    useCallback(
      (state) => state.dialogues[storeKey ?? ""]?.suggestedInputs ?? EMPTY_SUGGESTED_INPUTS,
      [storeKey],
    ),
  );
  
  // 控制状态 - 独立订阅（原始值不需要稳定常量）
  const isSending = useDialogueStore(
    useCallback(
      (state) => state.dialogues[storeKey ?? ""]?.isSending ?? false,
      [storeKey],
    ),
  );
  
  const openingLocked = useDialogueStore(
    useCallback(
      (state) => state.dialogues[storeKey ?? ""]?.openingLocked ?? false,
      [storeKey],
    ),
  );
  
  const openingIndex = useDialogueStore(
    useCallback(
      (state) => state.dialogues[storeKey ?? ""]?.openingIndex ?? 0,
      [storeKey],
    ),
  );

  // ═══════════════════════════════════════════════════════════════
  // Store 操作
  // 
  // 【优化】这些函数引用永久稳定，不会导致依赖问题
  // ═══════════════════════════════════════════════════════════════
  const fetchLatestDialogue = useDialogueStore((state) => state.fetchLatestDialogue);
  const initializeNewDialogue = useDialogueStore((state) => state.initializeNewDialogue);
  const sendMessage = useDialogueStore((state) => state.sendMessage);
  const addUserMessageStore = useDialogueStore((state) => state.addUserMessage);
  const addRoleMessageStore = useDialogueStore((state) => state.addRoleMessage);
  const triggerGenerationStore = useDialogueStore((state) => state.triggerGeneration);
  const truncateMessagesAfter = useDialogueStore((state) => state.truncateMessagesAfter);
  const regenerateMessage = useDialogueStore((state) => state.regenerateMessage);
  const navigateOpening = useDialogueStore((state) => state.navigateOpening);
  const setMessages = useDialogueStore((state) => state.setMessages);
  const setSuggestedInputs = useDialogueStore((state) => state.setSuggestedInputs);

  // ═══════════════════════════════════════════════════════════════
  // 包装操作函数
  // 
  // 【优化】使用 useCallback 确保引用稳定
  // 【优化】依赖数组只包含原始值，不包含函数
  // ═══════════════════════════════════════════════════════════════

  const handleFetchLatestDialogue = useCallback(async () => {
    if (!storeKey || !characterId) return;
    await fetchLatestDialogue(storeKey, characterId, language);
  }, [storeKey, characterId, language, fetchLatestDialogue]);

  const handleInitializeNewDialogue = useCallback(
    async (charId: string, sessId?: string) => {
      const { llmType, modelName, baseUrl, apiKey } = readLlmConfig();
      const key = sessId || charId;
      await initializeNewDialogue({
        dialogueKey: key,
        characterId: charId,
        language,
        modelName,
        baseUrl,
        apiKey,
        llmType,
      });
    },
    [language, readLlmConfig, initializeNewDialogue]
  );

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!storeKey || !characterId) return;

      const { llmType, modelName, baseUrl, apiKey } = readLlmConfig();
      await sendMessage({
        dialogueKey: storeKey,
        characterId,
        message,
        language,
        modelName,
        baseUrl,
        apiKey,
        llmType,
        responseLength,
        fastModel: fastModelEnabled,
        onError,
      });
    },
    [
      storeKey,
      characterId,
      language,
      responseLength,
      fastModelEnabled,
      readLlmConfig,
      sendMessage,
      onError,
    ]
  );

  const handleTruncateMessagesAfter = useCallback(
    async (nodeId: string) => {
      if (!storeKey) return;
      await truncateMessagesAfter(storeKey, nodeId);
    },
    [storeKey, truncateMessagesAfter]
  );

  const handleRegenerate = useCallback(
    async (nodeId: string) => {
      if (!storeKey || !characterId) return;

      const { llmType, modelName, baseUrl, apiKey } = readLlmConfig();
      await regenerateMessage(storeKey, characterId, nodeId, {
        language,
        modelName,
        baseUrl,
        apiKey,
        llmType,
        responseLength,
        fastModel: fastModelEnabled,
        onError,
      });
    },
    [
      storeKey,
      characterId,
      language,
      responseLength,
      fastModelEnabled,
      readLlmConfig,
      regenerateMessage,
      onError,
    ]
  );

  const handleOpeningNavigate = useCallback(
    async (direction: "prev" | "next") => {
      if (!storeKey) return;
      await navigateOpening(storeKey, direction);
    },
    [storeKey, navigateOpening]
  );

  const handleSetMessages = useCallback(
    (messages: any[]) => {
      if (!storeKey) return;
      setMessages(storeKey, messages);
    },
    [storeKey, setMessages]
  );

  const handleSetSuggestedInputs = useCallback(
    (inputs: string[]) => {
      if (!storeKey) return;
      setSuggestedInputs(storeKey, inputs);
    },
    [storeKey, setSuggestedInputs]
  );

  // ─── 只添加用户消息（兼容 SillyTavern /send） ───
  const addUserMessage = useCallback(
    (message: string, options?: SendOptions) => {
      if (!storeKey) return;
      addUserMessageStore(storeKey, message, options);
    },
    [storeKey, addUserMessageStore]
  );

  const addRoleMessage = useCallback(
    (role: string, message: string) => {
      if (!storeKey) return;
      addRoleMessageStore(storeKey, role, message);
    },
    [storeKey, addRoleMessageStore]
  );

  // ─── 只触发 AI 生成（兼容 SillyTavern /trigger） ───
  const triggerGeneration = useCallback(async () => {
    if (!storeKey || !characterId) return;

    const { llmType, modelName, baseUrl, apiKey } = readLlmConfig();
    await triggerGenerationStore({
      dialogueKey: storeKey,
      characterId,
      language,
      modelName,
      baseUrl,
      apiKey,
      llmType,
      responseLength,
      fastModel: fastModelEnabled,
      onError,
    });
  }, [
    storeKey,
    characterId,
    language,
    responseLength,
    fastModelEnabled,
    readLlmConfig,
    triggerGenerationStore,
    onError,
  ]);

  return {
    // 展示数据（细粒度订阅）
    messages,
    openingMessages,
    suggestedInputs,
    
    // 控制状态（细粒度订阅）
    isSending,
    openingLocked,
    openingIndex,

    // 操作
    fetchLatestDialogue: handleFetchLatestDialogue,
    initializeNewDialogue: handleInitializeNewDialogue,
    handleSendMessage,
    addUserMessage,
    addRoleMessage,
    triggerGeneration,
    truncateMessagesAfter: handleTruncateMessagesAfter,
    handleRegenerate,
    handleOpeningNavigate,
    setMessages: handleSetMessages,
    setSuggestedInputs: handleSetSuggestedInputs,

    // 工具
    readLlmConfig,
  };
}
