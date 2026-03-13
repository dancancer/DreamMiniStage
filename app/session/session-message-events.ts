/**
 * @input  types/character-dialogue, utils/message-id
 * @output createSessionMessageEventHandlers, applySessionMessagePatches, appendSessionMessages, removeSessionMessages
 * @pos    /session 消息事件工具
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Session Message Event Helpers                        ║
 * ║                                                                           ║
 * ║  收口 /session 对 DreamMiniStage:*ChatMessages 事件的解析与补丁逻辑。       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { DialogueMessage } from "@/types/character-dialogue";
import { extractNodeIdFromMessageId } from "@/utils/message-id";

type SessionMutableMessage = DialogueMessage & {
  data?: Record<string, unknown>;
  extra?: Record<string, unknown>;
};

export interface SessionSetChatMessagesDetail {
  characterId?: string;
  messages?: Array<{
    message_id?: string | number;
    message?: string;
    name?: string;
    role?: string;
    data?: Record<string, unknown>;
    extra?: Record<string, unknown>;
  }>;
}

export interface SessionCreateChatMessagesDetail {
  characterId?: string;
  messages?: Array<{
    id?: string;
    role?: string;
    content?: string;
  }>;
}

export interface SessionDeleteChatMessagesDetail {
  characterId?: string;
  messageIds?: string[];
}

export interface SessionRefreshOneMessageDetail {
  characterId?: string;
  message_id?: string;
}

function shouldHandleSessionMessageEvent(
  detailCharacterId: string | undefined,
  currentCharacterId: string | null,
): boolean {
  if (!currentCharacterId) {
    return false;
  }
  if (!detailCharacterId) {
    return true;
  }
  return detailCharacterId === currentCharacterId;
}

function findSessionMessageIndex(
  messages: DialogueMessage[],
  rawMessageId: string | number | undefined,
): number {
  const messageId = String(rawMessageId || "").trim();
  if (!messageId) {
    throw new Error("message_id is required");
  }

  const index = messages.findIndex((message) => message.id === messageId);
  if (index < 0) {
    throw new Error(`Session message not found: ${messageId}`);
  }
  return index;
}

export function applySessionMessagePatches(
  messages: DialogueMessage[],
  patches: SessionSetChatMessagesDetail["messages"],
): DialogueMessage[] {
  if (!patches?.length) {
    return messages;
  }

  const nextMessages = messages.map((message) => ({ ...message })) as SessionMutableMessage[];
  for (const patch of patches) {
    const index = findSessionMessageIndex(nextMessages, patch?.message_id);
    const current = nextMessages[index];
    if (!current) {
      throw new Error(`Session message not found: ${patch?.message_id}`);
    }

    nextMessages[index] = {
      ...current,
      ...(patch?.message !== undefined ? { content: patch.message } : {}),
      ...(patch?.name !== undefined ? { name: patch.name } : {}),
      ...(patch?.role !== undefined ? { role: patch.role } : {}),
      ...(patch?.data !== undefined ? { data: patch.data } : {}),
      ...(patch?.extra !== undefined ? { extra: patch.extra } : {}),
    };
  }

  return nextMessages;
}

export function appendSessionMessages(
  messages: DialogueMessage[],
  created: SessionCreateChatMessagesDetail["messages"],
): DialogueMessage[] {
  if (!created?.length) {
    return messages;
  }

  const appended = created.map((message, index) => {
    const role = message?.role?.trim();
    const content = message?.content?.trim();
    if (!role || !content) {
      throw new Error(`createChatMessages requires role/content at index ${index}`);
    }

    return {
      id: String(message.id || `${Date.now()}-${index}-${role}`),
      role,
      content,
    } satisfies DialogueMessage;
  });

  return [...messages, ...appended];
}

export function removeSessionMessages(
  messages: DialogueMessage[],
  messageIds: string[] | undefined,
): DialogueMessage[] {
  if (!messageIds?.length) {
    return messages;
  }

  const missing = messageIds.find((messageId) => !messages.some((message) => message.id === messageId));
  if (missing) {
    throw new Error(`Session message not found: ${missing}`);
  }

  const deleted = new Set(messageIds);
  return messages.filter((message) => !deleted.has(message.id));
}

interface CreateSessionMessageEventHandlersOptions {
  characterId: string | null;
  dialogueMessages: DialogueMessage[];
  setDialogueMessages: (messages: DialogueMessage[]) => void;
  regenerateDialogueMessage: (nodeId: string) => void | Promise<void>;
  onError: (message: string) => void;
}

export function createSessionMessageEventHandlers(
  options: CreateSessionMessageEventHandlersOptions,
) {
  return {
    handleSetChatMessages: (event: Event) => {
      try {
        const detail = (event as CustomEvent<SessionSetChatMessagesDetail>).detail;
        if (!shouldHandleSessionMessageEvent(detail?.characterId, options.characterId)) {
          return;
        }
        options.setDialogueMessages(applySessionMessagePatches(options.dialogueMessages, detail?.messages));
      } catch (error) {
        options.onError(error instanceof Error ? error.message : "Failed to apply setChatMessages");
      }
    },
    handleCreateChatMessages: (event: Event) => {
      try {
        const detail = (event as CustomEvent<SessionCreateChatMessagesDetail>).detail;
        if (!shouldHandleSessionMessageEvent(detail?.characterId, options.characterId)) {
          return;
        }
        options.setDialogueMessages(appendSessionMessages(options.dialogueMessages, detail?.messages));
      } catch (error) {
        options.onError(error instanceof Error ? error.message : "Failed to apply createChatMessages");
      }
    },
    handleDeleteChatMessages: (event: Event) => {
      try {
        const detail = (event as CustomEvent<SessionDeleteChatMessagesDetail>).detail;
        if (!shouldHandleSessionMessageEvent(detail?.characterId, options.characterId)) {
          return;
        }
        options.setDialogueMessages(removeSessionMessages(options.dialogueMessages, detail?.messageIds));
      } catch (error) {
        options.onError(error instanceof Error ? error.message : "Failed to apply deleteChatMessages");
      }
    },
    handleRefreshOneMessage: (event: Event) => {
      try {
        const detail = (event as CustomEvent<SessionRefreshOneMessageDetail>).detail;
        if (!shouldHandleSessionMessageEvent(detail?.characterId, options.characterId)) {
          return;
        }

        const index = findSessionMessageIndex(options.dialogueMessages, detail?.message_id);
        const message = options.dialogueMessages[index];
        if (!message) {
          throw new Error(`Session message not found: ${detail?.message_id}`);
        }
        if (message.role !== "assistant") {
          throw new Error(`refreshOneMessage only supports assistant messages: ${message.id}`);
        }

        void options.regenerateDialogueMessage(extractNodeIdFromMessageId(message.id));
      } catch (error) {
        options.onError(error instanceof Error ? error.message : "Failed to refresh message");
      }
    },
  };
}
