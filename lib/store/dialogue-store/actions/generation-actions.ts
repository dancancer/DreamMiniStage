/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Generation Actions                                     ║
 * ║                                                                           ║
 * ║  AI 生成逻辑 - 好品味：消除 sendMessage 和 triggerGeneration 的重复      ║
 * ║  支持流式和非流式两种响应模式                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { v4 as uuidv4 } from "uuid";
import { extractNodeIdFromMessageId } from "@/utils/message-id";
import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { type ModelAdvancedSettings } from "@/lib/model-runtime";
import { emitAssistantMessageReceived, emitGenerationEnded, emitUserMessageSent } from "./dialogue-event-emitter";
import {
  finalizeBufferedAssistantMessage,
  handleDialogueTransport,
  refreshDialogueFromTree,
  requestCharacterChatResponse,
  runGenerationLifecycle,
} from "./generation-request-runtime";
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
  advanced?: ModelAdvancedSettings;
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

  void getState;

  return runGenerationLifecycle({
    dialogueKey,
    characterId,
    userInput: userMessage,
    generationType,
    errorSource: "generateResponse",
    onError,
    setState,
    run: async (startTime) => {
      const nodeId = uuidv4();
      const response = await requestCharacterChatResponse({
        dialogueKey,
        characterId,
        userInput: userMessage,
        nodeId,
        pendingOpening,
        ...llmParams,
      });

      return handleDialogueTransport({
        response,
        dialogueKey,
        nodeId,
        characterId,
        startTime,
        onError,
        setState,
        onBufferedComplete: async (event) => {
          finalizeBufferedAssistantMessage({
            dialogueKey,
            nodeId,
            characterId,
            startTime,
            result: event.result,
            setState,
          });
        },
      });
    },
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
  emitUserMessageSent(new Date().toISOString() + "-user", message);

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
  messageId: string,
  params: RegenerateParams,
  getState: () => DialogueState,
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void,
) {
  if (!dialogueKey) return;

  const state = getState();
  const dialogue = state.dialogues[dialogueKey];
  if (!dialogue) return;

  const nodeId = extractNodeIdFromMessageId(messageId);
  const tree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueKey);
  if (!tree) {
    console.warn(`[regenerateMessage] Dialogue not found: ${dialogueKey}`);
    return;
  }

  if (tree.current_nodeId !== nodeId) {
    console.warn("[regenerateMessage] Only the last assistant message supports regenerate");
    return;
  }

  const node = tree.nodes.find((item) => item.nodeId === nodeId);
  if (!node || !node.userInput) {
    console.warn("[regenerateMessage] Missing turn node or userInput");
    return;
  }

  const { onError, ...llmParams } = params;
  const newNodeId = uuidv4();

  await runGenerationLifecycle({
    dialogueKey,
    characterId,
    userInput: node.userInput,
    generationType: "regenerate",
    errorSource: "regenerateMessage",
    onError,
    setState,
    run: async (startTime) => {
      const response = await requestCharacterChatResponse({
        dialogueKey,
        characterId,
        userInput: node.userInput,
        nodeId: newNodeId,
        parentNodeId: node.parentNodeId,
        ...llmParams,
      });

      return handleDialogueTransport({
        response,
        dialogueKey,
        nodeId: newNodeId,
        characterId,
        startTime,
        onError,
        setState,
        onStreamingSuccess: async () => {
          const refreshed = await refreshDialogueFromTree(dialogueKey, setState);
          if (!refreshed) {
            console.warn("[regenerateMessage] Failed to retrieve updated dialogue");
          }
        },
        onBufferedComplete: async (event) => {
          const refreshed = await refreshDialogueFromTree(dialogueKey, setState);
          if (!refreshed) {
            console.warn("[regenerateMessage] Failed to retrieve updated dialogue");
            return;
          }

          emitAssistantMessageReceived(newNodeId, event.result.screenContent, characterId);
          emitGenerationEnded(true, event.result.screenContent, startTime);
        },
      });
    },
  });
}
