/**
 * @input  lib/data/roleplay/character-dialogue-operation, app/session/session-dialogue-tree, types/character-dialogue
 * @output createSessionDialogueActions
 * @pos    /session 对话消息变更动作
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Session Dialogue Actions                             ║
 * ║                                                                           ║
 * ║  收口消息隐藏、推理编辑、强制保存这些对话级动作，消除重复实现。              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { buildDialogueTreeSnapshot } from "@/app/session/session-dialogue-tree";
import type { DialogueMessage } from "@/types/character-dialogue";

interface Params {
  sessionId: string | null;
  characterId: string | null;
  messages: DialogueMessage[];
  setMessages: (messages: DialogueMessage[]) => void;
}

export function createSessionDialogueActions({
  sessionId,
  characterId,
  messages,
  setMessages,
}: Params) {
  const assertValidMessageIndex = (index: number, command: string) => {
    if (index < 0 || index >= messages.length) {
      throw new Error(`${command} message index out of range: ${index}`);
    }
  };

  return {
    handleHideMessages: async (startIndex: number) => {
      assertValidMessageIndex(startIndex, "/hide");
      setMessages(messages.map((message, index) => index >= startIndex ? { ...message, hidden: true } : message));
    },
    handleUnhideMessages: async () => {
      setMessages(messages.map((message) => message.hidden ? { ...message, hidden: false } : message));
    },
    handleForceSaveChat: async () => {
      if (!sessionId || !characterId) {
        throw new Error("Session and character are required to save chat");
      }

      const existingTree = await LocalCharacterDialogueOperations.getDialogueTreeById(sessionId);
      const nextTree = buildDialogueTreeSnapshot(sessionId, characterId, messages, existingTree);
      await LocalCharacterDialogueOperations.updateDialogueTree(sessionId, nextTree);
    },
    handleGetMessageReasoning: async (index: number) => {
      assertValidMessageIndex(index, "/get-reasoning");
      return messages[index].thinkingContent || "";
    },
    handleSetMessageReasoning: async (index: number, reasoning: string) => {
      assertValidMessageIndex(index, "/set-reasoning");
      setMessages(messages.map((message, currentIndex) => currentIndex === index
        ? { ...message, thinkingContent: reasoning }
        : message));
    },
  };
}
