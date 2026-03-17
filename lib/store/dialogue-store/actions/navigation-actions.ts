/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Navigation Actions                                     ║
 * ║                                                                           ║
 * ║  对话导航和截断 - 开场白切换、分支截断                                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { switchDialogueBranch } from "@/function/dialogue/truncate";
import { switchSwipe as switchSwipeVariant } from "@/function/dialogue/swipe";
import { extractNodeIdFromMessageId } from "@/utils/message-id";
import { formatMessages } from "@/hooks/character-dialogue/message-utils";
import { mergeDialogueData } from "./generation-event-state";
import { replaceDialogueSnapshot } from "./dialogue-snapshot-state";
import type { DialogueState, DialogueMessage } from "../types";
import type { OpeningMessage, OpeningPayload } from "@/types/character-dialogue";

/**
 * 将 OpeningMessage 转换为 OpeningPayload
 * OpeningPayload 要求 fullContent 是必需的，而 OpeningMessage 的 fullContent 是可选的
 */
function openingToPayload(opening: OpeningMessage): OpeningPayload {
  return {
    id: opening.id,
    content: opening.content,
    fullContent: opening.fullContent || opening.content, // 如果没有 fullContent，使用 content
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   截断消息（切换分支）
   ═══════════════════════════════════════════════════════════════════════════ */

export async function truncateMessagesAfter(
  dialogueKey: string,
  nodeId: string,
  getState: () => DialogueState,
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void,
) {
  if (!dialogueKey) return;

  const state = getState();
  const dialogue = state.dialogues[dialogueKey];
  if (!dialogue) return;

  try {
    const messageIndex = dialogue.messages.findIndex((msg: DialogueMessage) => msg.id === nodeId);
    if (messageIndex === -1) {
      console.warn(`Dialogue branch not found: ${nodeId}`);
      return;
    }

    const actualNodeId = extractNodeIdFromMessageId(nodeId);
    const response = await switchDialogueBranch({ dialogueId: dialogueKey, nodeId: actualNodeId });
    if (!response.success) {
      console.error("Failed to truncate messages", response);
      return;
    }

    const dialogueData = response.dialogue;
    if (dialogueData) {
      setTimeout(() => {
        const formattedMessages = formatMessages(dialogueData.messages);
        const lastMessage = dialogueData.messages[dialogueData.messages.length - 1];

        setState((state: DialogueState) => ({
          dialogues: {
            ...state.dialogues,
            [dialogueKey]: mergeDialogueData(
              state.dialogues[dialogueKey],
              replaceDialogueSnapshot({
                dialogue: state.dialogues[dialogueKey],
                messages: formattedMessages,
                suggestedInputs: lastMessage?.parsedContent?.nextPrompts || [],
              }),
            ),
          },
        }));
      }, 100);
    }
  } catch (error) {
    console.error("Error truncating messages:", error);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Swipe 切换（仅最后一条 assistant）
   ═══════════════════════════════════════════════════════════════════════════ */

export async function switchSwipe(
  dialogueKey: string,
  messageId: string,
  target: "prev" | "next" | number,
  _getState: () => DialogueState,
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void,
) {
  if (!dialogueKey) return;

  try {
    const actualNodeId = extractNodeIdFromMessageId(messageId);
    const response = await switchSwipeVariant({ dialogueId: dialogueKey, nodeId: actualNodeId, target });
    if (!response.success || !response.dialogue) {
      console.warn("[switchSwipe] Failed to switch swipe:", response.message);
      return;
    }

    const formattedMessages = formatMessages(response.dialogue.messages);
    const lastMessage = response.dialogue.messages[response.dialogue.messages.length - 1];

    setState((state: DialogueState) => ({
      dialogues: {
        ...state.dialogues,
        [dialogueKey]: mergeDialogueData(
          state.dialogues[dialogueKey],
          replaceDialogueSnapshot({
            dialogue: state.dialogues[dialogueKey],
            messages: formattedMessages,
            suggestedInputs: lastMessage?.parsedContent?.nextPrompts || [],
          }),
        ),
      },
    }));
  } catch (error) {
    console.error("Error switching swipe:", error);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   开场白导航
   ═══════════════════════════════════════════════════════════════════════════ */

export async function navigateOpening(
  dialogueKey: string,
  direction: "prev" | "next",
  getState: () => DialogueState,
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void,
) {
  if (!dialogueKey) return;

  const state = getState();
  const dialogue = state.dialogues[dialogueKey];
  if (!dialogue || dialogue.openingLocked || dialogue.openingMessages.length <= 1) return;

  const total = dialogue.openingMessages.length;
  const nextIndex =
    direction === "prev"
      ? (dialogue.openingIndex - 1 + total) % total
      : (dialogue.openingIndex + 1) % total;
  const target = dialogue.openingMessages[nextIndex];

  const hasUserMessage = dialogue.messages.some((msg: DialogueMessage) => msg.role === "user");
  const preSession = !hasUserMessage;

  // 会话前状态：直接切换预览
  if (preSession) {
    setState((state: DialogueState) => ({
      dialogues: {
        ...state.dialogues,
        [dialogueKey]: {
          ...state.dialogues[dialogueKey],
          messages: [
            {
              id: target.id,
              role: "assistant",
              content: target.content,
            },
          ],
          openingIndex: nextIndex,
          suggestedInputs: [],
          pendingOpening: openingToPayload(target),
        },
      },
    }));
    return;
  }

  // 会话后状态：需要调用后端切换分支
  try {
    const response = await switchDialogueBranch({
      dialogueId: dialogueKey,
      nodeId: target.id,
    });

    if (response.success && response.dialogue) {
      const formattedMessages = formatMessages(response.dialogue.messages);

      setState((state: DialogueState) => ({
        dialogues: {
          ...state.dialogues,
          [dialogueKey]: replaceDialogueSnapshot({
            dialogue: state.dialogues[dialogueKey],
            messages: formattedMessages,
            suggestedInputs: [],
            patch: {
              openingIndex: nextIndex,
              pendingOpening: openingToPayload(target),
            },
          }),
        },
      }));
    } else {
      // 后端失败时回退到预览模式
      setState((state: DialogueState) => ({
        dialogues: {
          ...state.dialogues,
          [dialogueKey]: {
            ...state.dialogues[dialogueKey],
            messages: [
              {
                id: target.id,
                role: "assistant",
                content: target.content,
              },
            ],
            openingIndex: nextIndex,
            suggestedInputs: [],
            pendingOpening: openingToPayload(target),
          },
        },
      }));
    }
  } catch (error) {
    console.error("Error switching opening message:", error);
  }
}
