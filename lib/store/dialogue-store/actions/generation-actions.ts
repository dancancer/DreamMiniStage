/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Generation Actions                                     ║
 * ║                                                                           ║
 * ║  AI 生成逻辑 - 好品味：消除 sendMessage 和 triggerGeneration 的重复      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { v4 as uuidv4 } from "uuid";
import { handleCharacterChatRequest } from "@/function/dialogue/chat";
import { deleteDialogueNode } from "@/function/dialogue/delete";
import { getDisplayUsername } from "@/utils/username-helper";
import { formatMessages } from "@/hooks/character-dialogue/message-utils";
import { emit } from "@/lib/events";
import { EVENT_TYPES } from "@/lib/events/types";
import type {
  DialogueMessage,
  SendMessageParams,
  TriggerGenerationParams,
  RegenerateParams,
  DialogueState,
} from "../types";
import type { OpeningPayload } from "@/types/character-dialogue";

/* ═══════════════════════════════════════════════════════════════════════════
   核心生成逻辑 - 好品味：统一抽象，消除特殊情况
   ═══════════════════════════════════════════════════════════════════════════ */

interface GenerateOptions {
  dialogueKey: string;
  characterId: string;
  userMessage: string;
  language: "zh" | "en";
  modelName: string;
  baseUrl: string;
  apiKey: string;
  llmType: "openai" | "ollama" | "gemini";
  responseLength: number;
  fastModel: boolean;
  pendingOpening: OpeningPayload | undefined;
  generationType: "normal" | "continue";
  onError?: (message: string) => void;
}

async function generateResponse(
  options: GenerateOptions,
  getState: () => DialogueState,
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void,
): Promise<boolean> {
  const {
    dialogueKey,
    characterId,
    userMessage,
    generationType,
    onError,
    pendingOpening,
    ...llmParams
  } = options;

  const startTime = Date.now();

  // 触发生成开始事件
  emit(EVENT_TYPES.GENERATION_STARTED, {
    type: EVENT_TYPES.GENERATION_STARTED,
    generationType,
    characterId,
    userInput: userMessage,
    timestamp: startTime,
  });

  // 设置发送状态
  setState((state: DialogueState) => ({
    dialogues: {
      ...state.dialogues,
      [dialogueKey]: {
        ...state.dialogues[dialogueKey],
        isSending: true,
        suggestedInputs: [],
      },
    },
  }));

  try {
    const username = getDisplayUsername();
    const nodeId = uuidv4();

    const response = await handleCharacterChatRequest({
      username,
      dialogueId: dialogueKey,
      characterId,
      message: userMessage,
      ...llmParams,
      streaming: true,
      number: llmParams.responseLength,
      nodeId,
      openingMessage: pendingOpening,
    });

    if (!response.ok) {
      onError?.("请检查网络连接或 API 配置");
      emitGenerationEnded(false, "请检查网络连接或 API 配置", startTime);
      return false;
    }

    const result = await response.json();

    if (result.success) {
      const assistantMessage: DialogueMessage = {
        id: nodeId,
        role: "assistant",
        thinkingContent: result.thinkingContent ?? "",
        content: result.content || "",
      };

      setState((state: DialogueState) => ({
        dialogues: {
          ...state.dialogues,
          [dialogueKey]: {
            ...state.dialogues[dialogueKey],
            messages: [...state.dialogues[dialogueKey].messages, assistantMessage],
            suggestedInputs: result.parsedContent?.nextPrompts || [],
            pendingOpening: undefined,
          },
        },
      }));

      // 触发消息接收事件
      emit(EVENT_TYPES.MESSAGE_RECEIVED, {
        type: EVENT_TYPES.MESSAGE_RECEIVED,
        messageId: nodeId,
        content: result.content || "",
        sender: "assistant",
        characterName: characterId,
        timestamp: Date.now(),
      });

      // 触发生成结束事件
      emitGenerationEnded(true, result.content || "", startTime);
      return true;
    } else {
      emitGenerationEnded(false, result.message || "请检查网络连接或 API 配置", startTime);
      onError?.(result.message || "请检查网络连接或 API 配置");
      return false;
    }
  } catch (err) {
    console.error("Error generating response:", err);
    // 触发错误事件
    emit(EVENT_TYPES.ERROR_OCCURRED, {
      type: EVENT_TYPES.ERROR_OCCURRED,
      message: err instanceof Error ? err.message : "Unknown error",
      source: "generateResponse",
      timestamp: Date.now(),
    });
    onError?.("请检查网络连接或 API 配置");
    return false;
  } finally {
    setState((state: DialogueState) => ({
      dialogues: {
        ...state.dialogues,
        [dialogueKey]: {
          ...state.dialogues[dialogueKey],
          isSending: false,
        },
      },
    }));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   辅助函数 - 事件发射
   ═══════════════════════════════════════════════════════════════════════════ */

function emitGenerationEnded(success: boolean, contentOrError: string, startTime: number) {
  emit(EVENT_TYPES.GENERATION_ENDED, {
    type: EVENT_TYPES.GENERATION_ENDED,
    success,
    ...(success ? { content: contentOrError } : { error: contentOrError }),
    duration: Date.now() - startTime,
    timestamp: Date.now(),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   发送消息（添加用户消息 + 触发生成）
   ═══════════════════════════════════════════════════════════════════════════ */

export async function sendMessage(
  params: SendMessageParams,
  getState: () => DialogueState,
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void,
) {
  const { dialogueKey, message, ...restParams } = params;

  const state = getState();
  const dialogue = state.dialogues[dialogueKey];
  if (!dialogue || dialogue.isSending) return;

  const pendingOpening = dialogue.pendingOpening;

  // 锁定开场白并添加用户消息
  setState((state: DialogueState) => ({
    dialogues: {
      ...state.dialogues,
      [dialogueKey]: {
        ...state.dialogues[dialogueKey],
        openingLocked: true,
        messages: [
          ...state.dialogues[dialogueKey].messages,
          {
            id: new Date().toISOString() + "-user",
            role: "user",
            thinkingContent: "",
            content: message,
          },
        ],
      },
    },
  }));

  // 触发消息发送事件
  emit(EVENT_TYPES.MESSAGE_SENT, {
    type: EVENT_TYPES.MESSAGE_SENT,
    messageId: new Date().toISOString() + "-user",
    content: message,
    timestamp: Date.now(),
  });

  // 调用统一的生成逻辑
  await generateResponse(
    {
      dialogueKey,
      userMessage: message,
      generationType: "normal",
      pendingOpening,
      ...restParams,
    },
    getState,
    setState,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   触发生成（不添加用户消息，直接生成）
   ═══════════════════════════════════════════════════════════════════════════ */

export async function triggerGeneration(
  params: TriggerGenerationParams,
  getState: () => DialogueState,
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void,
) {
  const { dialogueKey, ...restParams } = params;

  const state = getState();
  const dialogue = state.dialogues[dialogueKey];
  if (!dialogue || dialogue.isSending) return;

  const pendingOpening = dialogue.pendingOpening;

  // 找到最后一条用户消息
  const messages = dialogue.messages;
  let lastUserMessage: DialogueMessage | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserMessage = messages[i];
      break;
    }
  }

  if (!lastUserMessage) {
    console.warn("[triggerGeneration] 没有找到用户消息");
    return;
  }

  // 调用统一的生成逻辑
  await generateResponse(
    {
      dialogueKey,
      userMessage: lastUserMessage.content,
      generationType: "continue",
      pendingOpening,
      ...restParams,
    },
    getState,
    setState,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   重新生成消息
   ═══════════════════════════════════════════════════════════════════════════ */

export async function regenerateMessage(
  dialogueKey: string,
  characterId: string,
  nodeId: string,
  params: RegenerateParams,
  getState: () => DialogueState,
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void,
) {
  if (!dialogueKey) return;

  const state = getState();
  const dialogue = state.dialogues[dialogueKey];
  if (!dialogue) return;

  try {
    const messageIndex = dialogue.messages.findIndex(
      (msg: DialogueMessage) => msg.id === nodeId && msg.role === "assistant",
    );

    if (messageIndex === -1) {
      console.warn(`Message not found: ${nodeId}`);
      return;
    }

    const messageToRegenerate = dialogue.messages[messageIndex];
    if (messageToRegenerate.role !== "assistant") {
      console.warn("Can only regenerate assistant messages");
      return;
    }

    // 找到前一条用户消息
    let userMessage: DialogueMessage | null = null;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (dialogue.messages[i].role === "user") {
        userMessage = dialogue.messages[i];
        break;
      }
    }

    if (!userMessage) {
      console.warn("No previous user message found for regeneration");
      return;
    }

    // 删除旧消息
    const response = await deleteDialogueNode({ dialogueId: dialogueKey, nodeId });
    if (!response.success) {
      console.error("Failed to delete message", response);
      return;
    }

    // 触发消息删除事件
    emit(EVENT_TYPES.MESSAGE_DELETED, {
      type: EVENT_TYPES.MESSAGE_DELETED,
      messageId: nodeId,
      timestamp: Date.now(),
    });

    const dialogueData = response.dialogue;
    if (dialogueData) {
      setTimeout(() => {
        const formattedMessages = formatMessages(dialogueData.messages);
        const lastMessage = dialogueData.messages[dialogueData.messages.length - 1];

        setState((state: DialogueState) => ({
          dialogues: {
            ...state.dialogues,
            [dialogueKey]: {
              ...state.dialogues[dialogueKey],
              messages: formattedMessages,
              suggestedInputs: lastMessage?.parsedContent?.nextPrompts || [],
            },
          },
        }));
      }, 100);
    }

    // 重新发送用户消息
    setTimeout(async () => {
      await sendMessage(
        {
          dialogueKey,
          characterId,
          message: userMessage!.content,
          ...params,
        },
        getState,
        setState,
      );
    }, 300);
  } catch (error) {
    console.error("Error regenerating message:", error);
  }
}
