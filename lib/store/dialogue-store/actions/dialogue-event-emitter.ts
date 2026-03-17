import { emit } from "@/lib/events";
import { EVENT_TYPES } from "@/lib/events/types";

export function emitGenerationStarted(input: {
  generationType: "normal" | "continue" | "regenerate";
  characterId: string;
  userInput: string;
  timestamp: number;
}): void {
  emit(EVENT_TYPES.GENERATION_STARTED, {
    type: EVENT_TYPES.GENERATION_STARTED,
    generationType: input.generationType,
    characterId: input.characterId,
    userInput: input.userInput,
    timestamp: input.timestamp,
  });
}

export function emitGenerationEnded(
  success: boolean,
  contentOrError: string,
  startTime: number,
  timestamp: number = Date.now(),
): void {
  emit(EVENT_TYPES.GENERATION_ENDED, {
    type: EVENT_TYPES.GENERATION_ENDED,
    success,
    ...(success ? { content: contentOrError } : { error: contentOrError }),
    duration: timestamp - startTime,
    timestamp,
  });
}

export function emitAssistantMessageReceived(
  messageId: string,
  content: string,
  characterId: string,
  timestamp: number = Date.now(),
): void {
  emit(EVENT_TYPES.MESSAGE_RECEIVED, {
    type: EVENT_TYPES.MESSAGE_RECEIVED,
    messageId,
    content,
    sender: "assistant",
    characterName: characterId,
    timestamp,
  });
}

export function emitUserMessageSent(
  messageId: string,
  content: string,
  timestamp: number = Date.now(),
): void {
  emit(EVENT_TYPES.MESSAGE_SENT, {
    type: EVENT_TYPES.MESSAGE_SENT,
    messageId,
    content,
    timestamp,
  });
}

export function emitDialogueError(
  message: string,
  source: string,
  timestamp: number = Date.now(),
): void {
  emit(EVENT_TYPES.ERROR_OCCURRED, {
    type: EVENT_TYPES.ERROR_OCCURRED,
    message,
    source,
    timestamp,
  });
}
