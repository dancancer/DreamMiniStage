import type { GenerationEvent } from "@/lib/generation-runtime/types";

type LegacyBufferedPayload =
  | {
    type: "complete";
    success: true;
    thinkingContent: string;
    content: string;
    parsedContent: { nextPrompts: string[] };
    isRegexProcessed: boolean;
  }
  | {
    type: "error";
    success: false;
    message: string;
  }
  | null;

type LegacySsePayload =
  | {
    type: "content";
    content: string;
    accumulated: string;
  }
  | {
    type: "reasoning";
    thinkingContent: string;
  }
  | {
    type: "complete";
    success: true;
    thinkingContent: string;
    content: string;
    parsedContent: { nextPrompts: string[] };
    isRegexProcessed: boolean;
  }
  | {
    type: "error";
    message: string;
    success: false;
  }
  | null;

export function toLegacyBufferedPayload(
  event: GenerationEvent,
): LegacyBufferedPayload {
  if (event.type === "complete") {
    return {
      type: "complete",
      success: true,
      thinkingContent: event.result.thinkingContent,
      content: event.result.screenContent,
      parsedContent: {
        nextPrompts: event.result.parsedContent?.nextPrompts ?? [],
      },
      isRegexProcessed: event.result.isPostProcessed ?? false,
    };
  }

  if (event.type === "error") {
    return {
      type: "error",
      success: false,
      message: event.message,
    };
  }

  return null;
}

export function toLegacySsePayload(
  event: GenerationEvent,
): LegacySsePayload {
  if (event.type === "content-delta") {
    return {
      type: "content",
      content: event.delta,
      accumulated: event.accumulated,
    };
  }

  if (event.type === "reasoning-delta") {
    return {
      type: "reasoning",
      thinkingContent: event.accumulated,
    };
  }

  return toLegacyBufferedPayload(event);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseLegacyDialogueResponsePayload(
  value: unknown,
): GenerationEvent | null {
  if (!isObjectRecord(value) || typeof value.type !== "string") {
    return null;
  }

  if (value.type === "complete" && value.success === true) {
    const nextPrompts = isObjectRecord(value.parsedContent) && Array.isArray(value.parsedContent.nextPrompts)
      ? value.parsedContent.nextPrompts.filter((item): item is string => typeof item === "string")
      : [];

    return {
      type: "complete",
      result: {
        screenContent: typeof value.content === "string" ? value.content : "",
        fullResponse: typeof value.content === "string" ? value.content : "",
        thinkingContent: typeof value.thinkingContent === "string" ? value.thinkingContent : "",
        parsedContent: { nextPrompts },
        isPostProcessed: typeof value.isRegexProcessed === "boolean"
          ? value.isRegexProcessed
          : undefined,
      },
    };
  }

  if (value.type === "error") {
    return {
      type: "error",
      message: typeof value.message === "string" ? value.message : "",
    };
  }

  return null;
}
