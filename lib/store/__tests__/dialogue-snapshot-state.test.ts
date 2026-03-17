import { describe, expect, it } from "vitest";
import { replaceDialogueSnapshot } from "@/lib/store/dialogue-store/actions/dialogue-snapshot-state";
import type { DialogueData } from "@/lib/store/dialogue-store/types";

function createDialogue(): DialogueData {
  return {
    messages: [
      { id: "user-1", role: "user", content: "hello" },
    ],
    openingMessages: [{ id: "open-1", content: "opening" }],
    openingIndex: 0,
    openingLocked: true,
    suggestedInputs: [],
    isSending: true,
    pendingOpening: { id: "open-1", content: "opening", fullContent: "opening" },
  };
}

describe("replaceDialogueSnapshot", () => {
  it("replaces messages and suggested inputs while preserving untouched fields", () => {
    const result = replaceDialogueSnapshot({
      dialogue: createDialogue(),
      messages: [{ id: "assistant-1", role: "assistant", content: "reply" }],
      suggestedInputs: ["next"],
    });

    expect(result.messages).toEqual([
      { id: "assistant-1", role: "assistant", content: "reply" },
    ]);
    expect(result.suggestedInputs).toEqual(["next"]);
    expect(result.openingMessages).toEqual([{ id: "open-1", content: "opening" }]);
    expect(result.isSending).toBe(true);
    expect(result.pendingOpening).toBeUndefined();
  });

  it("applies extra patch fields together with snapshot replacement", () => {
    const result = replaceDialogueSnapshot({
      dialogue: createDialogue(),
      messages: [{ id: "assistant-2", role: "assistant", content: "reply-2" }],
      suggestedInputs: [],
      patch: {
        openingIndex: 1,
        openingLocked: false,
      },
    });

    expect(result.openingIndex).toBe(1);
    expect(result.openingLocked).toBe(false);
    expect(result.messages).toEqual([
      { id: "assistant-2", role: "assistant", content: "reply-2" },
    ]);
  });
});
