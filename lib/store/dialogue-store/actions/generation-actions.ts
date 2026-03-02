/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Generation Actions                                     ║
 * ║                                                                           ║
 * ║  AI 生成逻辑 - 好品味：消除 sendMessage 和 triggerGeneration 的重复      ║
 * ║  支持流式和非流式两种响应模式                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { v4 as uuidv4 } from "uuid";
import { handleCharacterChatRequest } from "@/function/dialogue/chat";
import { getDisplayUsername } from "@/utils/username-helper";
import { formatMessages } from "@/hooks/character-dialogue/message-utils";
import { emit } from "@/lib/events";
import { EVENT_TYPES } from "@/lib/events/types";
import { extractNodeIdFromMessageId } from "@/utils/message-id";
import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { buildProcessedDialogue } from "@/function/dialogue/processed-dialogue";
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

/** 从 localStorage 读取流式开关状态 */
function isStreamingEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem("streamingEnabled");
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

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
      streaming: isStreamingEnabled(),
      number: llmParams.responseLength,
      nodeId,
      openingMessage: pendingOpening,
    });

    if (!response.ok) {
      onError?.("请检查网络连接或 API 配置");
      emitGenerationEnded(false, "请检查网络连接或 API 配置", startTime);
      return false;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 检测响应类型：SSE 流式 vs JSON
    // ═══════════════════════════════════════════════════════════════════════════
    const contentType = response.headers.get("content-type") || "";
    const isStreaming = contentType.includes("text/event-stream");

    if (isStreaming) {
      // ─────────────────────────────────────────────────────────────────────────
      // 流式响应处理
      // ─────────────────────────────────────────────────────────────────────────
      return await handleStreamingResponse({
        response,
        dialogueKey,
        nodeId,
        characterId,
        startTime,
        onError,
        setState,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 非流式响应处理（保持原有逻辑）
    // ─────────────────────────────────────────────────────────────────────────
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
   流式响应处理

   好品味：将流式逻辑独立封装，保持主函数清晰
   ═══════════════════════════════════════════════════════════════════════════ */

interface StreamingHandlerParams {
  response: Response;
  dialogueKey: string;
  nodeId: string;
  characterId: string;
  startTime: number;
  onError?: (message: string) => void;
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void;
}

async function handleStreamingResponse(params: StreamingHandlerParams): Promise<boolean> {
  const { response, dialogueKey, nodeId, characterId, startTime, onError, setState } = params;

  const reader = response.body?.getReader();
  if (!reader) {
    onError?.("无法读取流式响应");
    emitGenerationEnded(false, "无法读取流式响应", startTime);
    return false;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let accumulatedContent = "";
  let thinkingContent = "";
  let finalResult: {
    content: string;
    thinkingContent: string;
    parsedContent?: { nextPrompts?: string[] };
  } | null = null;

  // 先创建一个空的助手消息
  setState((state: DialogueState) => ({
    dialogues: {
      ...state.dialogues,
      [dialogueKey]: {
        ...state.dialogues[dialogueKey],
        messages: [
          ...state.dialogues[dialogueKey].messages,
          {
            id: nodeId,
            role: "assistant",
            thinkingContent: "",
            content: "",
          },
        ],
      },
    },
  }));

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;

        if (trimmed.startsWith("data:")) {
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);

            // 处理不同类型的事件
            if (event.type === "content") {
              accumulatedContent = event.accumulated || (accumulatedContent + (event.content || ""));

              // 增量更新消息内容
              setState((state: DialogueState) => {
                const dialogue = state.dialogues[dialogueKey];
                if (!dialogue) return state;

                const messages = [...dialogue.messages];
                const lastIndex = messages.length - 1;
                if (lastIndex >= 0 && messages[lastIndex].id === nodeId) {
                  messages[lastIndex] = {
                    ...messages[lastIndex],
                    content: accumulatedContent,
                  };
                }

                return {
                  dialogues: {
                    ...state.dialogues,
                    [dialogueKey]: {
                      ...dialogue,
                      messages,
                    },
                  },
                };
              });
            }

            if (event.type === "reasoning") {
              thinkingContent = event.thinkingContent || "";

              // 更新思考内容
              setState((state: DialogueState) => {
                const dialogue = state.dialogues[dialogueKey];
                if (!dialogue) return state;

                const messages = [...dialogue.messages];
                const lastIndex = messages.length - 1;
                if (lastIndex >= 0 && messages[lastIndex].id === nodeId) {
                  messages[lastIndex] = {
                    ...messages[lastIndex],
                    thinkingContent,
                  };
                }

                return {
                  dialogues: {
                    ...state.dialogues,
                    [dialogueKey]: {
                      ...dialogue,
                      messages,
                    },
                  },
                };
              });
            }

            if (event.type === "complete") {
              finalResult = {
                content: event.content || accumulatedContent,
                thinkingContent: event.thinkingContent || thinkingContent,
                parsedContent: event.parsedContent,
              };
            }

            if (event.type === "error") {
              onError?.(event.message || "流式响应错误");
              emitGenerationEnded(false, event.message || "流式响应错误", startTime);
              return false;
            }
          } catch {
            // 忽略 JSON 解析错误
          }
        }
      }
    }

    // 最终更新
    if (finalResult) {
      setState((state: DialogueState) => {
        const dialogue = state.dialogues[dialogueKey];
        if (!dialogue) return state;

        const messages = [...dialogue.messages];
        const lastIndex = messages.length - 1;
        if (lastIndex >= 0 && messages[lastIndex].id === nodeId) {
          messages[lastIndex] = {
            ...messages[lastIndex],
            content: finalResult!.content,
            thinkingContent: finalResult!.thinkingContent,
          };
        }

        return {
          dialogues: {
            ...state.dialogues,
            [dialogueKey]: {
              ...dialogue,
              messages,
              suggestedInputs: finalResult!.parsedContent?.nextPrompts || [],
              pendingOpening: undefined,
            },
          },
        };
      });

      // 触发消息接收事件
      emit(EVENT_TYPES.MESSAGE_RECEIVED, {
        type: EVENT_TYPES.MESSAGE_RECEIVED,
        messageId: nodeId,
        content: finalResult.content,
        sender: "assistant",
        characterName: characterId,
        timestamp: Date.now(),
      });

      emitGenerationEnded(true, finalResult.content, startTime);
      return true;
    }

    return false;

  } catch (error) {
    console.error("Stream processing error:", error);
    onError?.("流式处理错误");
    emitGenerationEnded(false, "流式处理错误", startTime);
    return false;
  } finally {
    reader.releaseLock();
  }
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
  messageId: string,
  params: RegenerateParams,
  getState: () => DialogueState,
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void,
) {
  if (!dialogueKey) return;

  const state = getState();
  const dialogue = state.dialogues[dialogueKey];
  if (!dialogue) return;

  try {
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

    const { llmType, modelName, baseUrl, apiKey, responseLength, fastModel, language, onError } = params;
    const username = getDisplayUsername();
    const newNodeId = uuidv4();

    const startTime = Date.now();

    emit(EVENT_TYPES.GENERATION_STARTED, {
      type: EVENT_TYPES.GENERATION_STARTED,
      generationType: "regenerate",
      characterId,
      userInput: node.userInput,
      timestamp: startTime,
    });

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

    const response = await handleCharacterChatRequest({
      username,
      dialogueId: dialogueKey,
      characterId,
      message: node.userInput,
      modelName,
      baseUrl,
      apiKey,
      llmType,
      language,
      streaming: isStreamingEnabled(),
      number: responseLength,
      nodeId: newNodeId,
      fastModel,
      parentNodeId: node.parentNodeId,
    });

    if (!response.ok) {
      onError?.("请检查网络连接或 API 配置");
      emitGenerationEnded(false, "请检查网络连接或 API 配置", startTime);
      return;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 检测响应类型：SSE 流式 vs JSON
    // ─────────────────────────────────────────────────────────────────────────
    const contentType = response.headers.get("content-type") || "";
    const isStreaming = contentType.includes("text/event-stream");

    if (isStreaming) {
      // 流式响应：等待流完成后刷新对话
      const success = await handleStreamingResponse({
        response,
        dialogueKey,
        nodeId: newNodeId,
        characterId,
        startTime,
        onError,
        setState,
      });

      if (success) {
        // 流式完成后从数据库刷新以获取完整状态
        const updatedTree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueKey);
        if (updatedTree) {
          const processed = buildProcessedDialogue(updatedTree);
          const formattedMessages = formatMessages(processed.messages);
          const lastMessage = processed.messages[processed.messages.length - 1];

          setState((state: DialogueState) => ({
            dialogues: {
              ...state.dialogues,
              [dialogueKey]: {
                ...state.dialogues[dialogueKey],
                messages: formattedMessages,
                suggestedInputs: lastMessage?.parsedContent?.nextPrompts || [],
                pendingOpening: undefined,
              },
            },
          }));
        }
      }
      return;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 非流式响应处理
    // ─────────────────────────────────────────────────────────────────────────
    const result = await response.json();
    if (!result.success) {
      emitGenerationEnded(false, result.message || "请检查网络连接或 API 配置", startTime);
      onError?.(result.message || "请检查网络连接或 API 配置");
      return;
    }

    const updatedTree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueKey);
    if (!updatedTree) {
      console.warn("[regenerateMessage] Failed to retrieve updated dialogue");
      return;
    }

    const processed = buildProcessedDialogue(updatedTree);
    const formattedMessages = formatMessages(processed.messages);
    const lastMessage = processed.messages[processed.messages.length - 1];

    setState((state: DialogueState) => ({
      dialogues: {
        ...state.dialogues,
        [dialogueKey]: {
          ...state.dialogues[dialogueKey],
          messages: formattedMessages,
          suggestedInputs: lastMessage?.parsedContent?.nextPrompts || [],
          pendingOpening: undefined,
        },
      },
    }));

    emit(EVENT_TYPES.MESSAGE_RECEIVED, {
      type: EVENT_TYPES.MESSAGE_RECEIVED,
      messageId: newNodeId,
      content: result.content || "",
      sender: "assistant",
      characterName: characterId,
      timestamp: Date.now(),
    });

    emitGenerationEnded(true, result.content || "", startTime);
  } catch (error) {
    console.error("Error regenerating message:", error);
    emit(EVENT_TYPES.ERROR_OCCURRED, {
      type: EVENT_TYPES.ERROR_OCCURRED,
      message: error instanceof Error ? error.message : "Unknown error",
      source: "regenerateMessage",
      timestamp: Date.now(),
    });
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
