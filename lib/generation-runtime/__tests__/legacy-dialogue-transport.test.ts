import { describe, expect, it } from "vitest";
import { resolveLegacyDialogueTransport } from "@/lib/generation-runtime/transport/legacy-dialogue-transport";

describe("resolveLegacyDialogueTransport", () => {
  it("classifies SSE responses as streaming", async () => {
    const response = new Response("data: [DONE]\n\n", {
      headers: { "Content-Type": "text/event-stream" },
    });
    await expect(resolveLegacyDialogueTransport(response)).resolves.toEqual({
      kind: "streaming",
    });
  });

  it("parses legacy complete JSON into a complete transport result", async () => {
    const response = new Response(JSON.stringify({
      type: "complete",
      success: true,
      thinkingContent: "Reasoning",
      content: "Visible reply",
      parsedContent: { nextPrompts: ["next"] },
      isRegexProcessed: true,
    }), {
      headers: { "Content-Type": "application/json" },
    });
    await expect(resolveLegacyDialogueTransport(response)).resolves.toEqual({
      kind: "complete",
      event: {
        type: "complete",
        result: {
          screenContent: "Visible reply",
          fullResponse: "Visible reply",
          thinkingContent: "Reasoning",
          parsedContent: { nextPrompts: ["next"] },
          isPostProcessed: true,
        },
      },
    });
  });

  it("parses legacy error JSON into an error transport result", async () => {
    const response = new Response(JSON.stringify({
      type: "error",
      success: false,
      message: "boom",
    }), {
      headers: { "Content-Type": "application/json" },
    });
    await expect(resolveLegacyDialogueTransport(response)).resolves.toEqual({
      kind: "error",
      event: { type: "error", message: "boom" },
    });
  });
});
