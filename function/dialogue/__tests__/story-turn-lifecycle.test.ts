import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareStoryDialogueTurn } from "../story-turn-lifecycle";

const mocks = vi.hoisted(() => ({
  getDialogueTreeById: vi.fn(),
  createDialogueTree: vi.fn(),
  addNodeToDialogueTree: vi.fn(),
  prepareDialogueExecution: vi.fn(),
  prepareOpeningGreeting: vi.fn(),
}));

vi.mock("@/lib/data/roleplay/character-dialogue-operation", () => ({
  LocalCharacterDialogueOperations: {
    getDialogueTreeById: (...args: unknown[]) => mocks.getDialogueTreeById(...args),
    createDialogueTree: (...args: unknown[]) => mocks.createDialogueTree(...args),
    addNodeToDialogueTree: (...args: unknown[]) => mocks.addNodeToDialogueTree(...args),
  },
}));

vi.mock("@/lib/generation-runtime/prepare/prepare-dialogue-execution", () => ({
  prepareDialogueExecution: (...args: unknown[]) => mocks.prepareDialogueExecution(...args),
}));

vi.mock("@/function/dialogue/opening", () => ({
  prepareOpeningGreeting: (...args: unknown[]) => mocks.prepareOpeningGreeting(...args),
}));

describe("prepareStoryDialogueTurn", () => {
  beforeEach(() => {
    mocks.getDialogueTreeById.mockReset();
    mocks.createDialogueTree.mockReset();
    mocks.addNodeToDialogueTree.mockReset();
    mocks.prepareDialogueExecution.mockReset();
    mocks.prepareOpeningGreeting.mockReset();

    mocks.prepareDialogueExecution.mockImplementation(async (params) => ({
      runtime: "story",
      context: { id: "turn" },
      llmConfig: params,
      postprocessNodeId: "story-runtime",
    }));
  });

  it("creates the tree, persists the original user turn, then prepares sanitized story input", async () => {
    mocks.getDialogueTreeById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ current_nodeId: "opening-node" });
    mocks.createDialogueTree.mockResolvedValue({ id: "dialogue-1" });
    mocks.addNodeToDialogueTree.mockResolvedValue("created");

    const turn = await prepareStoryDialogueTurn(baseInput({
      message: "<input_message>hi</input_message>",
      openingMessage: {
        id: "opening-node",
        content: "opening visible",
        fullContent: "opening full",
      },
    }));

    expect(turn).toMatchObject({
      dialogueId: "dialogue-1",
      nodeId: "turn-node",
      originalMessage: "<input_message>hi</input_message>",
      responseStreaming: false,
    });
    expect(mocks.createDialogueTree).toHaveBeenCalledWith("dialogue-1", "char-1");
    expect(mocks.addNodeToDialogueTree).toHaveBeenNthCalledWith(
      1,
      "dialogue-1",
      "root",
      "",
      "opening visible",
      "opening full",
      "",
      expect.objectContaining({ regexResult: "opening visible" }),
      "opening-node",
    );
    expect(mocks.addNodeToDialogueTree).toHaveBeenNthCalledWith(
      2,
      "dialogue-1",
      "opening-node",
      "<input_message>hi</input_message>",
      "",
      "",
      "",
      undefined,
      "turn-node",
    );
    expect(mocks.prepareDialogueExecution).toHaveBeenCalledWith(expect.objectContaining({
      dialogueKey: "dialogue-1",
      userInput: "hi",
      streaming: false,
      streamUsage: true,
    }));
  });

  it("keeps response streaming separate from model streaming policy", async () => {
    mocks.getDialogueTreeById.mockResolvedValue({ current_nodeId: "root" });

    const turn = await prepareStoryDialogueTurn(baseInput({
      streaming: false,
      advanced: {
        temperature: 0.35,
        streaming: true,
        streamUsage: false,
      },
    }));

    expect(turn.responseStreaming).toBe(false);
    expect(mocks.prepareDialogueExecution).toHaveBeenCalledWith(expect.objectContaining({
      temperature: 0.35,
      streaming: true,
      streamUsage: false,
    }));
  });
});

function baseInput(
  overrides: Partial<Parameters<typeof prepareStoryDialogueTurn>[0]> = {},
): Parameters<typeof prepareStoryDialogueTurn>[0] {
  return {
    username: "user",
    dialogueId: "dialogue-1",
    characterId: "char-1",
    message: "hi",
    modelName: "gpt-test",
    baseUrl: "",
    apiKey: "key",
    llmType: "openai",
    streaming: false,
    language: "zh",
    number: 100,
    nodeId: "turn-node",
    fastModel: false,
    ...overrides,
  };
}
