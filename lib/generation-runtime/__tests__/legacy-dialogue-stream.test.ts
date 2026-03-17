import { describe, expect, it } from "vitest";
import {
  consumeLegacyDialogueStream,
  parseLegacyDialogueStreamEvent,
} from "@/lib/generation-runtime/transport/legacy-dialogue-stream";

describe("parseLegacyDialogueStreamEvent", () => {
  it("parses legacy content and reasoning events", () => {
    expect(parseLegacyDialogueStreamEvent("{\"type\":\"content\",\"content\":\"He\",\"accumulated\":\"He\"}")).toEqual({
      type: "content-delta",
      delta: "He",
      accumulated: "He",
    });

    expect(parseLegacyDialogueStreamEvent("{\"type\":\"reasoning\",\"thinkingContent\":\"step\"}")).toEqual({
      type: "reasoning-delta",
      delta: "step",
      accumulated: "step",
    });
  });

  it("parses complete and error payloads", () => {
    expect(parseLegacyDialogueStreamEvent("{\"type\":\"complete\",\"content\":\"Hello\",\"thinkingContent\":\"step\",\"parsedContent\":{\"nextPrompts\":[\"next\"]}}")).toEqual({
      type: "complete",
      result: {
        screenContent: "Hello",
        fullResponse: "Hello",
        thinkingContent: "step",
        parsedContent: { nextPrompts: ["next"] },
      },
    });

    expect(parseLegacyDialogueStreamEvent("{\"type\":\"error\",\"message\":\"boom\",\"success\":false}")).toEqual({
      type: "error",
      message: "boom",
    });
  });

  it("returns null for unsupported payloads", () => {
    expect(parseLegacyDialogueStreamEvent("{\"foo\":\"bar\"}")).toBeNull();
    expect(parseLegacyDialogueStreamEvent("not-json")).toBeNull();
  });

  it("consumes streaming chunks and normalizes the completion payload", async () => {
    const seen: string[] = [];
    const response = new Response(
      [
        "data: {\"type\":\"content\",\"content\":\"He\",\"accumulated\":\"He\"}\n\n",
        "data: {\"type\":\"reasoning\",\"thinkingContent\":\"step\"}\n\n",
        "data: {\"type\":\"complete\",\"content\":\"\",\"thinkingContent\":\"\",\"parsedContent\":{\"nextPrompts\":[\"next\"]}}\n\n",
        "data: [DONE]\n\n",
      ].join(""),
      {
        headers: { "Content-Type": "text/event-stream" },
      },
    );

    const result = await consumeLegacyDialogueStream(response, {
      onEvent: (event) => {
        seen.push(event.type);
      },
    });

    expect(seen).toEqual([
      "content-delta",
      "reasoning-delta",
      "complete",
    ]);
    expect(result).toEqual({
      kind: "complete",
      event: {
        type: "complete",
        result: {
          screenContent: "He",
          fullResponse: "",
          thinkingContent: "step",
          parsedContent: { nextPrompts: ["next"] },
        },
      },
    });
  });

  it("surfaces error events while consuming the stream", async () => {
    const response = new Response(
      "data: {\"type\":\"error\",\"message\":\"boom\",\"success\":false}\n\n",
      {
        headers: { "Content-Type": "text/event-stream" },
      },
    );

    await expect(consumeLegacyDialogueStream(response)).resolves.toEqual({
      kind: "error",
      event: {
        type: "error",
        message: "boom",
      },
    });
  });
});
