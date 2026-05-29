import { beforeEach, describe, expect, it, vi } from "vitest";

const updateNodeInDialogueTree = vi.fn();
const syncDialogueSummaryState = vi.fn();

vi.mock("@/lib/data/roleplay/character-dialogue-operation", () => ({
  LocalCharacterDialogueOperations: {
    updateNodeInDialogueTree: (...args: unknown[]) => updateNodeInDialogueTree(...args),
  },
}));

vi.mock("@/function/dialogue/dialogue-summary", () => ({
  syncDialogueSummaryState: (...args: unknown[]) => syncDialogueSummaryState(...args),
}));

import { processPostResponseAsync } from "@/function/dialogue/chat-shared";

describe("processPostResponseAsync", () => {
  beforeEach(() => {
    updateNodeInDialogueTree.mockReset();
    syncDialogueSummaryState.mockReset();

    updateNodeInDialogueTree.mockResolvedValue({});
    syncDialogueSummaryState.mockResolvedValue(null);
  });

  it("refreshes dialogue summary cache after a successful response", async () => {
    await processPostResponseAsync({
      dialogueId: "dialogue-1",
      message: "hello",
      thinkingContent: "",
      fullResponse: "assistant full",
      screenContent: "assistant screen",
      event: "",
      nextPrompts: [],
      nodeId: "node-1",
    });

    expect(syncDialogueSummaryState).toHaveBeenCalledWith("dialogue-1");
  });
});
