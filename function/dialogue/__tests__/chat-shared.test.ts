import { beforeEach, describe, expect, it, vi } from "vitest";

type DialogueNode = {
  nodeId: string;
  parsedContent?: Record<string, unknown>;
  assistantResponse?: string;
  fullResponse?: string;
  thinkingContent?: string;
};

const treeState = {
  nodes: [] as DialogueNode[],
};

const updateNodeInDialogueTree = vi.fn();
const getDialogueTreeById = vi.fn();
const ingestMock = vi.fn();
const processMessageVariables = vi.fn();
const createApiClientMock = vi.fn();
const chatMock = vi.fn();
const getCharacterVariablesMock = vi.fn();
const saveNodeVariablesMock = vi.fn();

vi.mock("@/lib/data/roleplay/character-dialogue-operation", () => ({
  LocalCharacterDialogueOperations: {
    getDialogueTreeById: (...args: unknown[]) => getDialogueTreeById(...args),
    updateNodeInDialogueTree: (...args: unknown[]) => updateNodeInDialogueTree(...args),
  },
}));

vi.mock("@/lib/vector-memory/manager", () => ({
  getVectorMemoryManager: () => ({
    ingest: ingestMock,
  }),
}));

vi.mock("@/lib/mvu", () => ({
  processMessageVariables: (...args: unknown[]) => processMessageVariables(...args),
}));

vi.mock("@/lib/api/backends", () => ({
  createApiClient: (...args: unknown[]) => createApiClientMock(...args),
}));

vi.mock("@/lib/mvu/data/persistence", () => ({
  getCharacterVariables: (...args: unknown[]) => getCharacterVariablesMock(...args),
  saveNodeVariables: (...args: unknown[]) => saveNodeVariablesMock(...args),
}));

import { processPostResponseAsync } from "@/function/dialogue/chat-shared";
import { useModelStore } from "@/lib/store/model-store";
import { resetMvuConfigStore, useMvuConfigStore } from "@/lib/store/mvu-config-store";

function cloneNode(node: DialogueNode): DialogueNode {
  return JSON.parse(JSON.stringify(node)) as DialogueNode;
}

function findNode(nodeId: string): DialogueNode {
  const node = treeState.nodes.find((entry) => entry.nodeId === nodeId);
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }
  return node;
}

describe("processPostResponseAsync", () => {
  beforeEach(() => {
    resetMvuConfigStore();
    useModelStore.setState({
      configs: [{
        id: "cfg-1",
        name: "Config",
        type: "openai",
        baseUrl: "https://api.example.com/v1",
        model: "gpt-4o-mini",
        apiKey: "key",
        advanced: {},
      }],
      activeConfigId: "cfg-1",
    });

    treeState.nodes = [{
      nodeId: "node-1",
      parsedContent: {},
    }];

    getDialogueTreeById.mockReset();
    updateNodeInDialogueTree.mockReset();
    ingestMock.mockReset();
    processMessageVariables.mockReset();
    createApiClientMock.mockReset();
    chatMock.mockReset();
    getCharacterVariablesMock.mockReset();
    saveNodeVariablesMock.mockReset();

    getDialogueTreeById.mockImplementation(async () => ({
      id: "dialogue-1",
      current_nodeId: "node-1",
      nodes: treeState.nodes.map(cloneNode),
    }));
    updateNodeInDialogueTree.mockImplementation(async (_dialogueId: string, nodeId: string, patch: Record<string, unknown>) => {
      const node = findNode(nodeId);
      if ("assistantResponse" in patch) {
        node.assistantResponse = patch.assistantResponse as string;
      }
      if ("fullResponse" in patch) {
        node.fullResponse = patch.fullResponse as string;
      }
      if ("thinkingContent" in patch) {
        node.thinkingContent = patch.thinkingContent as string;
      }
      if ("parsedContent" in patch) {
        node.parsedContent = patch.parsedContent as Record<string, unknown>;
      }
      return {
        id: "dialogue-1",
        current_nodeId: "node-1",
        nodes: treeState.nodes.map(cloneNode),
      };
    });
    ingestMock.mockResolvedValue(undefined);
    processMessageVariables.mockResolvedValue(undefined);
    createApiClientMock.mockReturnValue({ chat: chatMock });
    getCharacterVariablesMock.mockResolvedValue({
      stat_data: { hp: 1 },
      display_data: {},
      delta_data: {},
    });
    saveNodeVariablesMock.mockResolvedValue(true);
  });

  it("keeps UpdateVariable protocol out of vector memory while preserving raw fullResponse for MVU persistence", async () => {
    const fullResponse = "Visible reply\n<UpdateVariable><Analyze>hp</Analyze>_.set('hp', 3);</UpdateVariable>";

    await processPostResponseAsync({
      dialogueId: "dialogue-1",
      message: "hi",
      thinkingContent: "",
      fullResponse,
      screenContent: "",
      event: "",
      nextPrompts: [],
      nodeId: "node-1",
    });

    expect(ingestMock).toHaveBeenCalledWith(
      "dialogue-1",
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: "Visible reply",
        }),
      ]),
    );
    expect(processMessageVariables).toHaveBeenCalledWith({
      dialogueKey: "dialogue-1",
      nodeId: "node-1",
      messageContent: fullResponse,
    });
  });

  it("runs the extra-model helper when the explicit strategy is extra-model", async () => {
    useMvuConfigStore.getState().setStrategy("extra-model");
    chatMock.mockResolvedValue({
      content: "<UpdateVariable>_.set('hp', 3);</UpdateVariable>",
    });

    await processPostResponseAsync({
      dialogueId: "dialogue-1",
      message: "hi",
      thinkingContent: "",
      fullResponse: "Visible reply",
      screenContent: "Visible reply",
      event: "",
      nextPrompts: [],
      nodeId: "node-1",
    });

    expect(chatMock).toHaveBeenCalledTimes(1);
    expect(saveNodeVariablesMock).toHaveBeenCalledWith({
      dialogueKey: "dialogue-1",
      nodeId: "node-1",
      variables: expect.objectContaining({
        stat_data: {
          hp: 3,
        },
      }),
    });
  });

  it("persists a route trace even when extra-model is selected but no update is produced", async () => {
    useMvuConfigStore.getState().setStrategy("extra-model");
    chatMock.mockResolvedValue({
      content: "没有任何变量变化",
    });

    await processPostResponseAsync({
      dialogueId: "dialogue-1",
      message: "hi",
      thinkingContent: "",
      fullResponse: "Visible reply",
      screenContent: "Visible reply",
      event: "",
      nextPrompts: [],
      nodeId: "node-1",
    });

    expect(findNode("node-1").parsedContent?.mvuTrace).toMatchObject({
      selectedStrategy: "extra-model",
      appliedPath: "none",
      applied: false,
      hasUpdateProtocol: false,
    });
  });
});
