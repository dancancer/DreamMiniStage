import type { GenerationEvent } from "@/lib/generation-runtime/types";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseLegacyDialogueStreamEvent(
  raw: string,
): GenerationEvent | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObjectRecord(parsed) || typeof parsed.type !== "string") {
      return null;
    }

    if (parsed.type === "content") {
      return {
        type: "content-delta",
        delta: typeof parsed.content === "string" ? parsed.content : "",
        accumulated: typeof parsed.accumulated === "string" ? parsed.accumulated : "",
      };
    }

    if (parsed.type === "reasoning") {
      return {
        type: "reasoning-delta",
        delta: typeof parsed.thinkingContent === "string" ? parsed.thinkingContent : "",
        accumulated: typeof parsed.thinkingContent === "string" ? parsed.thinkingContent : "",
      };
    }

    if (parsed.type === "complete") {
      return {
        type: "complete",
        result: {
          screenContent: typeof parsed.content === "string" ? parsed.content : "",
          fullResponse: typeof parsed.content === "string" ? parsed.content : "",
          thinkingContent: typeof parsed.thinkingContent === "string" ? parsed.thinkingContent : "",
          parsedContent: isObjectRecord(parsed.parsedContent)
            ? {
              nextPrompts: Array.isArray(parsed.parsedContent.nextPrompts)
                ? parsed.parsedContent.nextPrompts.filter((item): item is string => typeof item === "string")
                : undefined,
            }
            : undefined,
          isPostProcessed: typeof parsed.isRegexProcessed === "boolean"
            ? parsed.isRegexProcessed
            : undefined,
        },
      };
    }

    if (parsed.type === "error") {
      return {
        type: "error",
        message: typeof parsed.message === "string" ? parsed.message : "",
      };
    }

    return null;
  } catch {
    return null;
  }
}

export type LegacyDialogueStreamResult =
  | { kind: "complete"; event: Extract<GenerationEvent, { type: "complete" }> }
  | { kind: "error"; event: Extract<GenerationEvent, { type: "error" }> }
  | { kind: "incomplete" };

interface ConsumeLegacyDialogueStreamInput {
  onEvent?: (
    event: Extract<GenerationEvent, {
      type: "content-delta" | "reasoning-delta" | "complete" | "error";
    }>,
  ) => void | Promise<void>;
}

function normalizeCompleteEvent(
  event: Extract<GenerationEvent, { type: "complete" }>,
  accumulatedContent: string,
  accumulatedReasoning: string,
): Extract<GenerationEvent, { type: "complete" }> {
  return {
    type: "complete",
    result: {
      ...event.result,
      screenContent: event.result.screenContent || accumulatedContent,
      thinkingContent: event.result.thinkingContent || accumulatedReasoning,
    },
  };
}

export async function consumeLegacyDialogueStream(
  response: Response,
  input: ConsumeLegacyDialogueStreamInput = {},
): Promise<LegacyDialogueStreamResult> {
  const reader = response.body?.getReader();
  if (!reader) {
    return {
      kind: "error",
      event: {
        type: "error",
        message: "无法读取流式响应",
      },
    };
  }

  const { onEvent } = input;
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulatedContent = "";
  let accumulatedReasoning = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return { kind: "incomplete" };
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":") || !trimmed.startsWith("data:")) {
          continue;
        }

        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          continue;
        }

        const parsedEvent = parseLegacyDialogueStreamEvent(data);
        if (!parsedEvent) {
          continue;
        }

        if (parsedEvent.type === "content-delta") {
          accumulatedContent = parsedEvent.accumulated || `${accumulatedContent}${parsedEvent.delta}`;
          const event = {
            ...parsedEvent,
            accumulated: accumulatedContent,
          } satisfies Extract<GenerationEvent, { type: "content-delta" }>;
          await onEvent?.(event);
          continue;
        }

        if (parsedEvent.type === "reasoning-delta") {
          accumulatedReasoning = parsedEvent.accumulated || `${accumulatedReasoning}${parsedEvent.delta}`;
          const event = {
            ...parsedEvent,
            accumulated: accumulatedReasoning,
          } satisfies Extract<GenerationEvent, { type: "reasoning-delta" }>;
          await onEvent?.(event);
          continue;
        }

        if (parsedEvent.type === "complete") {
          const event = normalizeCompleteEvent(
            parsedEvent,
            accumulatedContent,
            accumulatedReasoning,
          );
          await onEvent?.(event);
          return { kind: "complete", event };
        }

        if (parsedEvent.type === "error") {
          await onEvent?.(parsedEvent);
          return { kind: "error", event: parsedEvent };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
