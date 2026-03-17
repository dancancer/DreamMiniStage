import type { FinalizedDialogueResult, GenerationEvent } from "./types";

export function createContentDeltaEvent(
  delta: string,
  accumulated: string,
): GenerationEvent {
  return {
    type: "content-delta",
    delta,
    accumulated,
  };
}

export function createReasoningDeltaEvent(
  delta: string,
  accumulated: string,
): GenerationEvent {
  return {
    type: "reasoning-delta",
    delta,
    accumulated,
  };
}

export function createCompleteEvent(
  result: FinalizedDialogueResult,
): GenerationEvent {
  return {
    type: "complete",
    result,
  };
}

export function createPostprocessStartEvent(): GenerationEvent {
  return {
    type: "postprocess-start",
  };
}

export function createErrorEvent(message: string): GenerationEvent {
  return {
    type: "error",
    message,
  };
}
