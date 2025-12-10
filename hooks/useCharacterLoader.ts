/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       useCharacterLoader Hook                              ║
 * ║                                                                            ║
 * ║  角色加载状态管理：加载角色、初始化对话、错误处理                             ║
 * ║  从 character/page.tsx 提取的加载逻辑                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getCharacterDialogue } from "@/function/dialogue/info";
import { getDisplayUsername } from "@/utils/username-helper";
import { useDialoguePreferences } from "@/hooks/character-dialogue/useDialoguePreferences";
import type { Character, DialogueMessage, OpeningMessage } from "@/types/character-dialogue";

// ============================================================================
//                              类型定义
// ============================================================================

interface DialogueData {
  messages: DialogueMessage[];
  openingMessages: OpeningMessage[];
  openingIndex: number;
  openingLocked: boolean;
  suggestedInputs: string[];
}

interface UseCharacterLoaderOptions {
  characterId: string | null;
  sessionId?: string | null;
  dialogueKey?: string | null;  // sessionId 或 characterId，用于对话索引
  initializeNewDialogue: (charId: string, sessId?: string) => Promise<void>;
  t: (key: string) => string;
}

interface UseCharacterLoaderReturn {
  character: Character | null;
  isLoading: boolean;
  isInitializing: boolean;
  error: string;
  loadingPhase: string;
  dialogueData: DialogueData | null;
}

// ============================================================================
//                              辅助函数
// ============================================================================

const formatMessages = (rawMessages: any[]): DialogueMessage[] => {
  return rawMessages.map((msg: any) => ({
    id: msg.id,
    role: msg.role,
    thinkingContent: msg.thinkingContent ?? "",
    content: msg.content,
  }));
};

const extractOpeningMessages = (
  dialogue: any,
  formattedMessages: DialogueMessage[]
): { openings: OpeningMessage[]; activeIndex: number; locked: boolean } => {
  const hasUserMessage = formattedMessages.some((msg) => msg.role === "user");
  const rootOpenings =
    dialogue.tree?.nodes?.filter(
      (node: any) => node.parentNodeId === "root" && !node.userInput
    ) || [];

  const processedOpenings = rootOpenings
    .map((node: any) => {
      const content = node.parsedContent?.regexResult || node.assistantResponse;
      if (!content) return null;
      return { id: node.nodeId, content };
    })
    .filter(Boolean) as OpeningMessage[];

  if (!hasUserMessage && processedOpenings.length > 0) {
    const activeIndex = processedOpenings.findIndex(
      (item) => item.id === dialogue.current_nodeId
    );
    return {
      openings: processedOpenings,
      activeIndex: activeIndex >= 0 ? activeIndex : 0,
      locked: false,
    };
  }

  return { openings: [], activeIndex: 0, locked: hasUserMessage };
};

// ============================================================================
//                              主 Hook
// ============================================================================

export function useCharacterLoader({
  characterId,
  sessionId,
  dialogueKey,
  initializeNewDialogue,
  t,
}: UseCharacterLoaderOptions): UseCharacterLoaderReturn {
  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState("");
  const [loadingPhase, setLoadingPhase] = useState("");
  const [dialogueData, setDialogueData] = useState<DialogueData | null>(null);
  const initializationRef = useRef(false);
  const { language } = useDialoguePreferences();

  // 计算实际的对话索引 Key（优先 sessionId）
  const storeKey = dialogueKey || sessionId || characterId;

  useEffect(() => {
    const loadCharacterAndDialogue = async () => {
      if (!characterId) {
        setError("Character ID is missing from URL");
        setIsLoading(false);
        return;
      }

      // 重置状态
      setIsLoading(true);
      setIsInitializing(false);
      setError("");
      setLoadingPhase(t("characterChat.loading"));
      initializationRef.current = false;

      // 最小加载时间，确保用户看到加载动画
      const startTime = Date.now();
      const minLoadingTime = 500;

      try {
        const username = getDisplayUsername() || undefined;

        setLoadingPhase(t("characterChat.loading"));
        // 使用 storeKey（sessionId 或 characterId）加载对话
        const response = await getCharacterDialogue(storeKey!, characterId, language, username);

        if (!response.success) {
          throw new Error(`Failed to load character: ${response}`);
        }

        const dialogue = response.dialogue;
        const characterData = response.character;

        const characterInfo: Character = {
          id: characterData.id,
          name: characterData.data.name,
          personality: characterData.data.personality,
          avatar_path: characterData.imagePath,
          extensions: characterData.data.extensions,
        };

        setCharacter(characterInfo);

        if (dialogue && dialogue.messages) {
          setLoadingPhase(t("characterChat.loadingDialogue"));
          const formattedMessages = formatMessages(dialogue.messages);
          const lastMessage = dialogue.messages[dialogue.messages.length - 1];
          const { openings, activeIndex, locked } = extractOpeningMessages(
            dialogue,
            formattedMessages
          );

          setDialogueData({
            messages: formattedMessages,
            openingMessages: openings,
            openingIndex: activeIndex,
            openingLocked: locked,
            suggestedInputs: lastMessage?.parsedContent?.nextPrompts || [],
          });

          // 确保最小加载时间
          const elapsedTime = Date.now() - startTime;
          const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
          if (remainingTime > 0) {
            await new Promise((resolve) => setTimeout(resolve, remainingTime));
          }

          setIsLoading(false);
        } else if (!initializationRef.current) {
          // 需要初始化新对话
          setLoadingPhase(t("characterChat.initializing"));
          setIsInitializing(true);
          initializationRef.current = true;
          // 传递 sessionId 用于创建对话树
          await initializeNewDialogue(characterId, sessionId || undefined);
          setIsInitializing(false);
          setIsLoading(false);
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error loading character or dialogue:", err);
        const errorMessage =
          typeof err === "object" && err !== null && "message" in err
            ? (err as Error).message
            : "Failed to load character";

        // 检查是否是角色不存在的错误
        if (
          errorMessage.includes("Character not found") ||
          errorMessage.includes("Character record is required")
        ) {
          setError("角色不存在或已被删除");
          setTimeout(() => {
            window.location.href = "/character-cards";
          }, 2000);
        } else {
          setError(errorMessage);
        }

        setIsLoading(false);
        setIsInitializing(false);
      }
    };

    loadCharacterAndDialogue();
  }, [characterId, sessionId, storeKey, initializeNewDialogue, language, t]);

  return {
    character,
    isLoading,
    isInitializing,
    error,
    loadingPhase,
    dialogueData,
  };
}
