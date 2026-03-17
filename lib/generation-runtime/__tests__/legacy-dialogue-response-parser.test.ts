import { describe, expect, it } from "vitest";
import { parseLegacyDialogueResponsePayload } from "@/lib/generation-runtime/transport/legacy-dialogue-response";

describe("parseLegacyDialogueResponsePayload", () => {
  it("parses a legacy complete payload into a runtime complete event", () => {
    expect(parseLegacyDialogueResponsePayload({
      type: "complete",
      success: true,
      thinkingContent: "Reasoning",
      content: "Visible reply",
      parsedContent: { nextPrompts: ["next"] },
      isRegexProcessed: true,
    })).toEqual({
      type: "complete",
      result: {
        screenContent: "Visible reply",
        fullResponse: "Visible reply",
        thinkingContent: "Reasoning",
        parsedContent: { nextPrompts: ["next"] },
        isPostProcessed: true,
      },
    });
  });

  it("parses a legacy error payload into a runtime error event", () => {
    expect(parseLegacyDialogueResponsePayload({
      type: "error",
      success: false,
      message: "boom",
    })).toEqual({
      type: "error",
      message: "boom",
    });
  });

  it("returns null for unsupported payloads", () => {
    expect(parseLegacyDialogueResponsePayload({ foo: "bar" })).toBeNull();
  });
});
