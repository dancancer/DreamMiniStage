import type { DialogueData, DialogueMessage } from "../types";
import type { FinalizedDialogueResult, GenerationEvent } from "@/lib/generation-runtime/types";

function updateAssistantMessage(
  messages: DialogueMessage[],
  nodeId: string,
  patch: Partial<DialogueMessage>,
): DialogueMessage[] {
  const nextMessages = [...messages];
  const lastIndex = nextMessages.length - 1;

  if (lastIndex >= 0 && nextMessages[lastIndex].id === nodeId) {
    nextMessages[lastIndex] = {
      ...nextMessages[lastIndex],
      ...patch,
    };
  }

  return nextMessages;
}

export function appendStreamingAssistantMessage(
  dialogue: DialogueData,
  nodeId: string,
): DialogueData {
  return {
    ...dialogue,
    messages: [
      ...dialogue.messages,
      {
        id: nodeId,
        role: "assistant",
        thinkingContent: "",
        content: "",
      },
    ],
  };
}

export function applyStreamingDeltaToDialogue(
  dialogue: DialogueData,
  nodeId: string,
  event: Extract<GenerationEvent, { type: "content-delta" | "reasoning-delta" }>,
): DialogueData {
  if (event.type === "content-delta") {
    return {
      ...dialogue,
      messages: updateAssistantMessage(dialogue.messages, nodeId, {
        content: event.accumulated,
      }),
    };
  }

  return {
    ...dialogue,
    messages: updateAssistantMessage(dialogue.messages, nodeId, {
      thinkingContent: event.accumulated,
    }),
  };
}

export function applyGenerationEventToDialogue(
  dialogue: DialogueData,
  nodeId: string,
  event: Extract<GenerationEvent, { type: "content-delta" | "reasoning-delta" | "complete" }>,
): DialogueData {
  if (event.type === "complete") {
    return applyFinalizedStreamingResult(dialogue, nodeId, event.result);
  }

  return applyStreamingDeltaToDialogue(dialogue, nodeId, event);
}

export function applyFinalizedStreamingResult(
  dialogue: DialogueData,
  nodeId: string,
  result: FinalizedDialogueResult,
): DialogueData {
  return {
    ...dialogue,
    messages: updateAssistantMessage(dialogue.messages, nodeId, {
      content: result.screenContent,
      thinkingContent: result.thinkingContent,
    }),
    suggestedInputs: result.parsedContent?.nextPrompts || [],
    pendingOpening: undefined,
  };
}

export function appendCompletedAssistantMessage(
  dialogue: DialogueData,
  nodeId: string,
  result: FinalizedDialogueResult,
): DialogueData {
  return {
    ...dialogue,
    messages: [
      ...dialogue.messages,
      {
        id: nodeId,
        role: "assistant",
        thinkingContent: result.thinkingContent,
        content: result.screenContent,
      },
    ],
    suggestedInputs: result.parsedContent?.nextPrompts || [],
    pendingOpening: undefined,
  };
}

export function replaceDialogueMessages(
  messages: DialogueMessage[],
  suggestedInputs: string[],
): Pick<DialogueData, "messages" | "suggestedInputs" | "pendingOpening"> {
  return {
    messages,
    suggestedInputs,
    pendingOpening: undefined,
  };
}

export function mergeDialogueData(
  dialogue: DialogueData,
  patch: Partial<DialogueData>,
): DialogueData {
  return {
    ...dialogue,
    ...patch,
  };
}
