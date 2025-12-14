/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Dialogue Lifecycle Actions                             ║
 * ║                                                                           ║
 * ║  对话生命周期管理 - 初始化和加载                                             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { getCharacterDialogue } from "@/function/dialogue/info";
import { initCharacterDialogue } from "@/function/dialogue/init";
import { getDisplayUsername } from "@/utils/username-helper";
import { extractOpeningMessages, formatMessages } from "@/hooks/character-dialogue/message-utils";
import type { InitDialogueParams } from "../types";
import { DEFAULT_DIALOGUE_DATA } from "../types";

/* ═══════════════════════════════════════════════════════════════════════════
   获取最新对话
   ═══════════════════════════════════════════════════════════════════════════ */

import type { DialogueState } from "../types";

export async function fetchLatestDialogue(
  dialogueKey: string,
  characterId: string,
  language: "zh" | "en",
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void,
) {
  if (!dialogueKey || !characterId) return;

  try {
    const username = getDisplayUsername() || undefined;
    const response = await getCharacterDialogue(dialogueKey, characterId, language, username);

    if (!response.success) {
      throw new Error(`Failed to load dialogue: ${response}`);
    }

    const dialogue = response.dialogue;
    if (dialogue && dialogue.messages) {
      const formattedMessages = formatMessages(dialogue.messages);
      const lastMessage = dialogue.messages[dialogue.messages.length - 1];
      const { openings, activeIndex, locked } = extractOpeningMessages(
        dialogue,
        formattedMessages,
      );

      setState((state: DialogueState) => ({
        dialogues: {
          ...state.dialogues,
          [dialogueKey]: {
            ...DEFAULT_DIALOGUE_DATA,
            ...state.dialogues[dialogueKey],
            messages: formattedMessages,
            openingMessages: openings,
            openingIndex: activeIndex,
            openingLocked: locked,
            suggestedInputs: lastMessage?.parsedContent?.nextPrompts || [],
            pendingOpening: undefined,
          },
        },
      }));
    }
  } catch (err) {
    console.error("Error refreshing dialogue:", err);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   初始化新对话
   ═══════════════════════════════════════════════════════════════════════════ */

export async function initializeNewDialogue(
  params: InitDialogueParams,
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void,
) {
  const { dialogueKey, characterId, language, modelName, baseUrl, apiKey, llmType } = params;

  try {
    const username = getDisplayUsername();
    const initData = await initCharacterDialogue({
      username,
      dialogueId: dialogueKey,
      characterId,
      modelName,
      baseUrl,
      apiKey,
      llmType,
      language,
    });

    if (!initData.success) {
      throw new Error(`Failed to initialize dialogue: ${initData}`);
    }

    const openings = initData.openingMessages || [];

    // 有多个开场白
    if (openings.length > 0) {
      setState((state: DialogueState) => ({
        dialogues: {
          ...state.dialogues,
          [dialogueKey]: {
            ...DEFAULT_DIALOGUE_DATA,
            openingMessages: openings,
            openingIndex: 0,
            openingLocked: false,
            pendingOpening: initData.openingMessage || openings[0],
            messages: [
              {
                id: openings[0].id,
                role: "assistant",
                content: openings[0].content,
              },
            ],
            suggestedInputs: [],
          },
        },
      }));
      return;
    }

    // 单个开场白
    if (initData.firstMessage) {
      setState((state: DialogueState) => ({
        dialogues: {
          ...state.dialogues,
          [dialogueKey]: {
            ...DEFAULT_DIALOGUE_DATA,
            pendingOpening: initData.openingMessage,
            messages: [
              {
                id: initData.openingMessage?.id || `${dialogueKey}-opening`,
                role: "assistant",
                content: initData.firstMessage,
              },
            ],
          },
        },
      }));
    }
  } catch (error) {
    console.error("Error initializing dialogue:", error);
    throw error;
  }
}
