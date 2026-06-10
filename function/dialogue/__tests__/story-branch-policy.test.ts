import { beforeEach, describe, expect, it, vi } from "vitest";
import { switchDialogueBranch } from "../truncate";
import { switchSwipe } from "../swipe";

const mocks = vi.hoisted(() => ({
  getDialogueTreeById: vi.fn(),
  switchBranch: vi.fn(),
  buildProcessedDialogue: vi.fn(),
  assertStoryBranchOperationSupported: vi.fn(),
}));

vi.mock("@/lib/data/roleplay/character-dialogue-operation", () => ({
  LocalCharacterDialogueOperations: {
    getDialogueTreeById: (...args: unknown[]) => mocks.getDialogueTreeById(...args),
    switchBranch: (...args: unknown[]) => mocks.switchBranch(...args),
  },
}));

vi.mock("@/function/dialogue/processed-dialogue", () => ({
  buildProcessedDialogue: (...args: unknown[]) => mocks.buildProcessedDialogue(...args),
}));

vi.mock("@/lib/story-agent/session", () => ({
  assertStoryBranchOperationSupported: (...args: unknown[]) =>
    mocks.assertStoryBranchOperationSupported(...args),
}));

describe("Story Agent branch policy", () => {
  beforeEach(() => {
    mocks.getDialogueTreeById.mockReset();
    mocks.switchBranch.mockReset();
    mocks.buildProcessedDialogue.mockReset();
    mocks.assertStoryBranchOperationSupported.mockReset();

    mocks.assertStoryBranchOperationSupported.mockResolvedValue(undefined);
    mocks.buildProcessedDialogue.mockReturnValue({ messages: [] });
  });

  it("blocks swipe before switching a StorySession branch", async () => {
    mocks.getDialogueTreeById.mockResolvedValue({
      id: "dialogue-1",
      current_nodeId: "turn-a",
      nodes: [
        makeNode("turn-a", "root", "hi"),
        makeNode("turn-b", "root", "hi"),
      ],
    });
    mocks.assertStoryBranchOperationSupported.mockRejectedValue(new Error(
      "Story Agent swipe is disabled until StoryState branch replay is implemented.",
    ));

    await expect(switchSwipe({
      dialogueId: "dialogue-1",
      nodeId: "turn-a",
      target: "next",
    })).rejects.toThrow(
      "Story Agent swipe is disabled until StoryState branch replay is implemented.",
    );

    expect(mocks.assertStoryBranchOperationSupported).toHaveBeenCalledWith("dialogue-1", "swipe");
    expect(mocks.switchBranch).not.toHaveBeenCalled();
  });

  it("blocks branch switching before changing the active dialogue node", async () => {
    mocks.assertStoryBranchOperationSupported.mockRejectedValue(new Error(
      "Story Agent branch switching is disabled until StoryState branch replay is implemented.",
    ));

    await expect(switchDialogueBranch({
      dialogueId: "dialogue-1",
      nodeId: "turn-a",
    })).rejects.toThrow(
      "Story Agent branch switching is disabled until StoryState branch replay is implemented.",
    );

    expect(mocks.assertStoryBranchOperationSupported).toHaveBeenCalledWith(
      "dialogue-1",
      "branch-switch",
    );
    expect(mocks.switchBranch).not.toHaveBeenCalled();
  });
});

function makeNode(nodeId: string, parentNodeId: string, userInput: string) {
  return {
    nodeId,
    parentNodeId,
    userInput,
    assistantResponse: "reply",
    fullResponse: "reply",
  };
}
