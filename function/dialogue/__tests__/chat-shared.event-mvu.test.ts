import { beforeEach, describe, expect, it, vi } from "vitest";

type DialogueNode = {
  nodeId: string;
  parentNodeId: string;
  parsedContent?: Record<string, unknown>;
  assistantResponse?: string;
  fullResponse?: string;
  thinkingContent?: string;
};

const treeState = {
  tree: {
    id: "dialogue-1",
    current_nodeId: "node-1",
    nodes: [] as DialogueNode[],
  },
};

const updateNodeInDialogueTree = vi.fn();
const getDialogueTreeById = vi.fn();
const getDialoguePathToNode = vi.fn();
const ingestMock = vi.fn();

vi.mock("@/lib/data/roleplay/character-dialogue-operation", () => ({
  LocalCharacterDialogueOperations: {
    getDialogueTreeById: (...args: unknown[]) => getDialogueTreeById(...args),
    getDialoguePathToNode: (...args: unknown[]) => getDialoguePathToNode(...args),
    updateNodeInDialogueTree: (...args: unknown[]) => updateNodeInDialogueTree(...args),
  },
}));

vi.mock("@/lib/vector-memory/manager", () => ({
  getVectorMemoryManager: () => ({
    ingest: ingestMock,
  }),
}));

function findNode(nodeId: string): DialogueNode {
  const node = treeState.tree.nodes.find((entry) => entry.nodeId === nodeId);
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }
  return node;
}

function cloneTreeNode(node: DialogueNode): DialogueNode {
  return JSON.parse(JSON.stringify(node)) as DialogueNode;
}

import { processPostResponseAsync } from "@/function/dialogue/chat-shared";

describe("processPostResponseAsync event + mvu integration", () => {
  beforeEach(() => {
    treeState.tree = {
      id: "dialogue-1",
      current_nodeId: "node-1",
      nodes: [
        {
          nodeId: "opening",
          parentNodeId: "root",
          parsedContent: {
            variables: {
              stat_data: {
                hp: 1,
              },
              display_data: {},
              delta_data: {},
            },
          },
        },
        {
          nodeId: "node-1",
          parentNodeId: "opening",
          parsedContent: {},
        },
      ],
    };

    ingestMock.mockReset();
    ingestMock.mockResolvedValue(undefined);

    getDialogueTreeById.mockReset();
    getDialogueTreeById.mockImplementation(async () => ({
      ...treeState.tree,
      nodes: treeState.tree.nodes.map(cloneTreeNode),
    }));

    getDialoguePathToNode.mockReset();
    getDialoguePathToNode.mockImplementation(async (_dialogueId: string, nodeId: string) => {
      if (nodeId !== "node-1") {
        return [];
      }
      return treeState.tree.nodes.map(cloneTreeNode);
    });

    updateNodeInDialogueTree.mockReset();
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
        ...treeState.tree,
        nodes: treeState.tree.nodes.map(cloneTreeNode),
      };
    });
  });

  it("keeps parsedContent.variables after writing compressedContent", async () => {
    await processPostResponseAsync({
      dialogueId: "dialogue-1",
      message: "hi",
      thinkingContent: "",
      fullResponse: "Visible reply\n<UpdateVariable>_.set('hp', 3);</UpdateVariable>",
      screenContent: "Visible reply",
      event: "event-1",
      nextPrompts: [],
      nodeId: "node-1",
    });

    const updatedNode = findNode("node-1");
    expect(updatedNode.parsedContent?.compressedContent).toBe("event-1");
    expect(updatedNode.parsedContent?.variables).toMatchObject({
      stat_data: {
        hp: 3,
      },
    });
  });
});
