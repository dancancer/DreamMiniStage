import { handleCharacterChatRequest } from "@/function/dialogue/chat";
import { buildProcessedDialogue } from "@/function/dialogue/processed-dialogue";
import { formatMessages } from "@/hooks/character-dialogue/message-utils";
import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { consumeLegacyDialogueStream } from "@/lib/generation-runtime/transport/legacy-dialogue-stream";
import { resolveLegacyDialogueTransport } from "@/lib/generation-runtime/transport/legacy-dialogue-transport";
import type { GenerationEvent } from "@/lib/generation-runtime/types";
import { resolveStreamingEnabled, type ModelAdvancedSettings } from "@/lib/model-runtime";
import type { OpeningPayload } from "@/types/character-dialogue";
import { getDisplayUsername } from "@/utils/username-helper";
import {
  appendCompletedAssistantMessage,
  appendStreamingAssistantMessage,
  applyGenerationEventToDialogue,
  mergeDialogueData,
} from "./generation-event-state";
import { replaceDialogueSnapshot } from "./dialogue-snapshot-state";
import {
  emitAssistantMessageReceived,
  emitDialogueError,
  emitGenerationEnded,
  emitGenerationStarted,
} from "./dialogue-event-emitter";
import {
  clearDialogueSending,
  markDialogueSending,
} from "./dialogue-status-state";
import type { DialogueState } from "../types";

export interface GenerationLifecycleInput {
  dialogueKey: string;
  characterId: string;
  userInput: string;
  generationType: "normal" | "continue" | "regenerate";
  errorSource: string;
  onError?: (message: string) => void;
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void;
  run: (startTime: number) => Promise<boolean>;
}

export interface ChatRequestInput {
  dialogueKey: string;
  characterId: string;
  userInput: string;
  nodeId: string;
  parentNodeId?: string;
  pendingOpening?: OpeningPayload;
  llmType: "openai" | "ollama" | "gemini";
  modelName: string;
  baseUrl: string;
  apiKey: string;
  language: "zh" | "en";
  responseLength: number;
  fastModel: boolean;
  advanced?: ModelAdvancedSettings;
}

interface StreamingHandlerParams {
  response: Response;
  dialogueKey: string;
  nodeId: string;
  characterId: string;
  startTime: number;
  onError?: (message: string) => void;
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void;
}

interface DialogueTransportHandlerParams extends StreamingHandlerParams {
  onBufferedComplete: (event: Extract<GenerationEvent, { type: "complete" }>) => Promise<void> | void;
  onStreamingSuccess?: () => Promise<void> | void;
}

function getTransportErrorMessage(
  result: Extract<GenerationEvent, { type: "error" }> | null,
): string {
  return result?.type === "error"
    ? result.message
    : "请检查网络连接或 API 配置";
}

function setDialogueSendingState(
  dialogueKey: string,
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void,
  update: (dialogue: DialogueState["dialogues"][string]) => DialogueState["dialogues"][string],
): void {
  setState((state: DialogueState) => ({
    dialogues: {
      ...state.dialogues,
      [dialogueKey]: update(state.dialogues[dialogueKey]),
    },
  }));
}

function applyStreamingEventToState(params: {
  dialogueKey: string;
  nodeId: string;
  event: Extract<GenerationEvent, {
    type: "content-delta" | "reasoning-delta" | "complete";
  }>;
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void;
}): void {
  const { dialogueKey, nodeId, event, setState } = params;

  setState((state: DialogueState) => {
    const dialogue = state.dialogues[dialogueKey];
    if (!dialogue) {
      return state;
    }

    return {
      dialogues: {
        ...state.dialogues,
        [dialogueKey]: mergeDialogueData(
          dialogue,
          applyGenerationEventToDialogue(dialogue, nodeId, event),
        ),
      },
    };
  });
}

function handleGenerationFailure(
  startTime: number,
  onError: ((message: string) => void) | undefined,
  result: Extract<GenerationEvent, { type: "error" }> | null,
): false {
  const errorMessage = getTransportErrorMessage(result);
  emitGenerationEnded(false, errorMessage, startTime);
  onError?.(errorMessage);
  return false;
}

async function handleStreamingResponse(
  params: StreamingHandlerParams,
): Promise<boolean> {
  const { response, dialogueKey, nodeId, characterId, startTime, onError, setState } = params;

  setState((state: DialogueState) => ({
    dialogues: {
      ...state.dialogues,
      [dialogueKey]: {
        ...appendStreamingAssistantMessage(state.dialogues[dialogueKey], nodeId),
      },
    },
  }));

  try {
    const result = await consumeLegacyDialogueStream(response, {
      onEvent: async (event) => {
        if (event.type === "error") {
          return;
        }

        applyStreamingEventToState({
          dialogueKey,
          nodeId,
          event,
          setState,
        });
      },
    });

    if (result.kind === "complete") {
      emitAssistantMessageReceived(nodeId, result.event.result.screenContent, characterId);
      emitGenerationEnded(true, result.event.result.screenContent, startTime);
      return true;
    }

    if (result.kind === "error") {
      onError?.(result.event.message || "流式响应错误");
      emitGenerationEnded(false, result.event.message || "流式响应错误", startTime);
      return false;
    }

    return false;
  } catch (error) {
    console.error("Stream processing error:", error);
    onError?.("流式处理错误");
    emitGenerationEnded(false, "流式处理错误", startTime);
    return false;
  }
}

export async function handleDialogueTransport(
  params: DialogueTransportHandlerParams,
): Promise<boolean> {
  const {
    response,
    startTime,
    onError,
    onBufferedComplete,
    onStreamingSuccess,
    ...streamingParams
  } = params;

  if (!response.ok) {
    onError?.("请检查网络连接或 API 配置");
    emitGenerationEnded(false, "请检查网络连接或 API 配置", startTime);
    return false;
  }

  const transport = await resolveLegacyDialogueTransport(response);

  if (transport.kind === "streaming") {
    const success = await handleStreamingResponse({
      response,
      ...streamingParams,
      startTime,
      onError,
    });
    if (success) {
      await onStreamingSuccess?.();
    }
    return success;
  }

  if (transport.kind === "complete") {
    await onBufferedComplete(transport.event);
    return true;
  }

  return handleGenerationFailure(startTime, onError, transport.event);
}

export async function requestCharacterChatResponse(
  input: ChatRequestInput,
): Promise<Response> {
  const username = getDisplayUsername();

  return handleCharacterChatRequest({
    username,
    dialogueId: input.dialogueKey,
    characterId: input.characterId,
    message: input.userInput,
    modelName: input.modelName,
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    llmType: input.llmType,
    language: input.language,
    streaming: resolveStreamingEnabled(input.advanced),
    number: input.responseLength,
    nodeId: input.nodeId,
    fastModel: input.fastModel,
    advanced: input.advanced,
    openingMessage: input.pendingOpening,
    parentNodeId: input.parentNodeId,
  });
}

export async function refreshDialogueFromTree(
  dialogueKey: string,
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void,
): Promise<boolean> {
  const updatedTree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueKey);
  if (!updatedTree) {
    return false;
  }

  const processed = buildProcessedDialogue(updatedTree);
  const formattedMessages = formatMessages(processed.messages);
  const lastMessage = processed.messages[processed.messages.length - 1];

  setState((state: DialogueState) => ({
    dialogues: {
      ...state.dialogues,
      [dialogueKey]: {
        ...replaceDialogueSnapshot({
          dialogue: state.dialogues[dialogueKey],
          messages: formattedMessages,
          suggestedInputs: lastMessage?.parsedContent?.nextPrompts || [],
        }),
      },
    },
  }));

  return true;
}

export function finalizeBufferedAssistantMessage(params: {
  dialogueKey: string;
  nodeId: string;
  characterId: string;
  startTime: number;
  result: Extract<GenerationEvent, { type: "complete" }>["result"];
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void;
}): void {
  const { dialogueKey, nodeId, characterId, startTime, result, setState } = params;

  setState((state: DialogueState) => ({
    dialogues: {
      ...state.dialogues,
      [dialogueKey]: mergeDialogueData(
        state.dialogues[dialogueKey],
        appendCompletedAssistantMessage(
          state.dialogues[dialogueKey],
          nodeId,
          result,
        ),
      ),
    },
  }));

  emitAssistantMessageReceived(nodeId, result.screenContent, characterId);
  emitGenerationEnded(true, result.screenContent, startTime);
}

export async function runGenerationLifecycle(
  input: GenerationLifecycleInput,
): Promise<boolean> {
  const {
    dialogueKey,
    characterId,
    userInput,
    generationType,
    errorSource,
    onError,
    setState,
    run,
  } = input;

  const startTime = Date.now();

  emitGenerationStarted({
    generationType,
    characterId,
    userInput,
    timestamp: startTime,
  });

  setDialogueSendingState(dialogueKey, setState, markDialogueSending);

  try {
    return await run(startTime);
  } catch (error) {
    console.error(`Error in ${errorSource}:`, error);
    emitDialogueError(
      error instanceof Error ? error.message : "Unknown error",
      errorSource,
    );
    onError?.("请检查网络连接或 API 配置");
    return false;
  } finally {
    setDialogueSendingState(dialogueKey, setState, clearDialogueSending);
  }
}
