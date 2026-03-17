import { describe, expect, it } from "vitest";
import {
  clearDialogueSending,
  markDialogueSending,
} from "@/lib/store/dialogue-store/actions/dialogue-status-state";
import type { DialogueData } from "@/lib/store/dialogue-store/types";

function createDialogue(): DialogueData {
  return {
    messages: [{ id: "m1", role: "assistant", content: "hello" }],
    openingMessages: [],
    openingIndex: 0,
    openingLocked: false,
    suggestedInputs: ["one", "two"],
    isSending: false,
    pendingOpening: undefined,
  };
}

describe("dialogue status state helpers", () => {
  it("marks dialogue as sending and clears suggested inputs", () => {
    const result = markDialogueSending(createDialogue());

    expect(result.isSending).toBe(true);
    expect(result.suggestedInputs).toEqual([]);
    expect(result.messages).toEqual([{ id: "m1", role: "assistant", content: "hello" }]);
  });

  it("clears sending while preserving other fields", () => {
    const result = clearDialogueSending({
      ...createDialogue(),
      isSending: true,
    });

    expect(result.isSending).toBe(false);
    expect(result.suggestedInputs).toEqual(["one", "two"]);
  });
});
