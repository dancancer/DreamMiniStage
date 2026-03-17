import { describe, expect, it } from "vitest";
import {
  toLegacyBufferedPayload,
  toLegacySsePayload,
} from "@/lib/generation-runtime/transport/legacy-dialogue-response";
import {
  createCompleteEvent,
  createContentDeltaEvent,
  createErrorEvent,
  createReasoningDeltaEvent,
} from "@/lib/generation-runtime/events";

describe("legacy dialogue response transport", () => {
  it("maps content and reasoning deltas to legacy SSE payloads", () => {
    expect(toLegacySsePayload(createContentDeltaEvent("He", "He"))).toEqual({
      type: "content",
      content: "He",
      accumulated: "He",
    });

    expect(toLegacySsePayload(createReasoningDeltaEvent("step", "step"))).toEqual({
      type: "reasoning",
      thinkingContent: "step",
    });
  });

  it("maps complete events to the legacy dialogue completion payload", () => {
    expect(toLegacyBufferedPayload(createCompleteEvent({
      screenContent: "Visible reply",
      fullResponse: "Full reply",
      thinkingContent: "Reasoning",
      parsedContent: { nextPrompts: ["next"] },
      event: "",
      isPostProcessed: true,
    }))).toEqual({
      type: "complete",
      success: true,
      thinkingContent: "Reasoning",
      content: "Visible reply",
      parsedContent: { nextPrompts: ["next"] },
      isRegexProcessed: true,
    });
  });

  it("maps error events to the legacy failure payload", () => {
    expect(toLegacyBufferedPayload(createErrorEvent("boom"))).toEqual({
      type: "error",
      success: false,
      message: "boom",
    });
  });
});
