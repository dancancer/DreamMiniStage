/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   首条用户消息建树与开场落盘测试                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleCharacterChatRequest } from "../chat";

const executeMock = vi.fn();
const getDialogueTreeById = vi.fn();
const createDialogueTree = vi.fn();
const addNodeToDialogueTree = vi.fn();
const switchBranch = vi.fn();
const updateNodeInDialogueTree = vi.fn();
const ingestMock = vi.fn();
const processMessageVariables = vi.fn();

vi.mock("@/lib/workflow/examples/DialogueWorkflow", () => ({
  DialogueWorkflow: vi.fn().mockImplementation(() => ({
    execute: executeMock,
  })),
}));

vi.mock("@/lib/vector-memory/manager", () => ({
  getVectorMemoryManager: () => ({
    ingest: ingestMock,
  }),
}));

vi.mock("@/lib/mvu", () => ({
  processMessageVariables: (...args: unknown[]) => processMessageVariables(...args),
  initMvuVariablesFromWorldBooks: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/data/roleplay/character-dialogue-operation", () => ({
  LocalCharacterDialogueOperations: {
    getDialogueTreeById: (...args: unknown[]) => getDialogueTreeById(...args),
    createDialogueTree: (...args: unknown[]) => createDialogueTree(...args),
    addNodeToDialogueTree: (...args: unknown[]) => addNodeToDialogueTree(...args),
    switchBranch: (...args: unknown[]) => switchBranch(...args),
    updateNodeInDialogueTree: (...args: unknown[]) => updateNodeInDialogueTree(...args),
  },
}));

describe("handleCharacterChatRequest 首条消息建树并写入开场", () => {
  beforeEach(() => {
    executeMock.mockReset();
    getDialogueTreeById.mockReset();
    createDialogueTree.mockReset();
    addNodeToDialogueTree.mockReset();
    switchBranch.mockReset();
    updateNodeInDialogueTree.mockReset();
    ingestMock.mockReset();
    processMessageVariables.mockReset();

    getDialogueTreeById
      .mockResolvedValueOnce(null) // ensure tree missing at first
      .mockResolvedValue({
        id: "session-1",
        character_id: "char-1",
        nodes: [],
        current_nodeId: "session-1-opening",
      });

    createDialogueTree.mockResolvedValue({
      id: "session-1",
      nodes: [],
      current_nodeId: "root",
    });

    addNodeToDialogueTree.mockResolvedValueOnce("session-1-opening").mockResolvedValue("assistant-1");
    switchBranch.mockResolvedValue(true);
    updateNodeInDialogueTree.mockResolvedValue(null);

    executeMock.mockResolvedValue({
      outputData: {
        thinkingContent: "think",
        screenContent: "reply",
        fullResponse: "full reply",
        nextPrompts: [],
        event: "",
      },
    });

    ingestMock.mockResolvedValue(undefined);
    processMessageVariables.mockResolvedValue(undefined);
  });

  it("创建对话树并写入开场节点后，仅执行一次 DialogueWorkflow", async () => {
    const response = await handleCharacterChatRequest({
      username: "user",
      dialogueId: "session-1",
      characterId: "char-1",
      message: "hi",
      modelName: "gpt",
      baseUrl: "",
      apiKey: "key",
      llmType: "openai",
      language: "zh",
      number: 100,
      nodeId: "assistant-1",
      fastModel: false,
      openingMessage: {
        id: "session-1-opening",
        content: "opening regex",
        fullContent: "opening raw",
      },
    });

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(createDialogueTree).toHaveBeenCalledWith("session-1", "char-1");
    expect(addNodeToDialogueTree).toHaveBeenCalledWith(
      "session-1",
      "root",
      "",
      "opening regex",
      "opening raw",
      "",
      expect.objectContaining({ regexResult: "opening regex" }),
      "session-1-opening",
    );
    expect(executeMock).toHaveBeenCalledTimes(1);
  });
});
