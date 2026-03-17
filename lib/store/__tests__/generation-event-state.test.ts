import { describe, expect, it } from "vitest";
import {
  appendCompletedAssistantMessage,
  appendStreamingAssistantMessage,
  applyGenerationEventToDialogue,
  applyFinalizedStreamingResult,
  mergeDialogueData,
  replaceDialogueMessages,
  applyStreamingDeltaToDialogue,
} from "@/lib/store/dialogue-store/actions/generation-event-state";
import type { DialogueData } from "@/lib/store/dialogue-store/types";

function createDialogue(): DialogueData {
  return {
    messages: [
      { id: "user-1", role: "user", content: "hello" },
    ],
    openingMessages: [],
    openingIndex: 0,
    openingLocked: false,
    suggestedInputs: [],
    isSending: true,
    pendingOpening: undefined,
  };
}

describe("generation event state helpers", () => {
  it("appends an empty assistant message for streaming", () => {
    const result = appendStreamingAssistantMessage(createDialogue(), "assistant-1");

    expect(result.messages.at(-1)).toEqual({
      id: "assistant-1",
      role: "assistant",
      thinkingContent: "",
      content: "",
    });
  });

  it("applies content and reasoning deltas to the streaming assistant message", () => {
    const dialogue = appendStreamingAssistantMessage(createDialogue(), "assistant-1");
    const withContent = applyStreamingDeltaToDialogue(dialogue, "assistant-1", {
      type: "content-delta",
      delta: "He",
      accumulated: "Hello",
    });
    const withReasoning = applyStreamingDeltaToDialogue(withContent, "assistant-1", {
      type: "reasoning-delta",
      delta: "step",
      accumulated: "step-1",
    });

    expect(withReasoning.messages.at(-1)).toEqual(expect.objectContaining({
      id: "assistant-1",
      content: "Hello",
      thinkingContent: "step-1",
    }));
  });

  it("applies the finalized result and suggested inputs", () => {
    const dialogue = appendStreamingAssistantMessage(createDialogue(), "assistant-1");
    const result = applyFinalizedStreamingResult(dialogue, "assistant-1", {
      screenContent: "Visible reply",
      fullResponse: "Full reply",
      thinkingContent: "Reasoning",
      parsedContent: { nextPrompts: ["next"] },
      isPostProcessed: true,
    });

    expect(result.messages.at(-1)).toEqual(expect.objectContaining({
      id: "assistant-1",
      content: "Visible reply",
      thinkingContent: "Reasoning",
    }));
    expect(result.suggestedInputs).toEqual(["next"]);
  });

  it("applies runtime generation events through one adapter", () => {
    const dialogue = appendStreamingAssistantMessage(createDialogue(), "assistant-1");
    const afterDelta = applyGenerationEventToDialogue(dialogue, "assistant-1", {
      type: "content-delta",
      delta: "He",
      accumulated: "Hello",
    });
    const afterComplete = applyGenerationEventToDialogue(afterDelta, "assistant-1", {
      type: "complete",
      result: {
        screenContent: "Visible reply",
        fullResponse: "Full reply",
        thinkingContent: "Reasoning",
        parsedContent: { nextPrompts: ["next"] },
        isPostProcessed: true,
      },
    });

    expect(afterComplete.messages.at(-1)).toEqual(expect.objectContaining({
      id: "assistant-1",
      content: "Visible reply",
      thinkingContent: "Reasoning",
    }));
    expect(afterComplete.suggestedInputs).toEqual(["next"]);
  });

  it("appends a completed assistant message for non-streaming results", () => {
    const result = appendCompletedAssistantMessage(createDialogue(), "assistant-1", {
      screenContent: "Visible reply",
      fullResponse: "Full reply",
      thinkingContent: "Reasoning",
      parsedContent: { nextPrompts: ["next"] },
      isPostProcessed: true,
    });

    expect(result.messages.at(-1)).toEqual({
      id: "assistant-1",
      role: "assistant",
      thinkingContent: "Reasoning",
      content: "Visible reply",
    });
    expect(result.suggestedInputs).toEqual(["next"]);
  });

  it("replaces dialogue messages from a refreshed processed tree", () => {
    const replaced = replaceDialogueMessages(
      [
        { id: "assistant-2", role: "assistant", content: "reply" },
      ],
      ["next"],
    );

    expect(replaced.messages).toEqual([
      { id: "assistant-2", role: "assistant", content: "reply" },
    ]);
    expect(replaced.suggestedInputs).toEqual(["next"]);
  });

  it("merges a dialogue patch while preserving untouched fields", () => {
    const dialogue = createDialogue();
    const merged = mergeDialogueData(dialogue, {
      isSending: false,
      suggestedInputs: ["next"],
    });

    expect(merged.messages).toEqual(dialogue.messages);
    expect(merged.openingMessages).toEqual([]);
    expect(merged.isSending).toBe(false);
    expect(merged.suggestedInputs).toEqual(["next"]);
  });
});
