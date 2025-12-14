/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 会话键持久化测试                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCharacterVariables, processMessageVariables } from "../data/persistence";
import type { MvuData } from "../types";

const getDialogueTreeById = vi.fn();
const getDialoguePathToNode = vi.fn();
const updateNodeInDialogueTree = vi.fn();

vi.mock("@/lib/data/roleplay/character-dialogue-operation", () => ({
  LocalCharacterDialogueOperations: {
    getDialogueTreeById: (...args: unknown[]) => getDialogueTreeById(...args),
    getDialoguePathToNode: (...args: unknown[]) => getDialoguePathToNode(...args),
    updateNodeInDialogueTree: (...args: unknown[]) => updateNodeInDialogueTree(...args),
  },
}));

const baseVariables: MvuData = {
  stat_data: { hp: 1 },
  display_data: { hp: "" },
  delta_data: {},
  initialized_lorebooks: {},
};

describe("MVU 持久化使用 session dialogueKey", () => {
  beforeEach(() => {
    getDialogueTreeById.mockReset();
    getDialoguePathToNode.mockReset();
    updateNodeInDialogueTree.mockReset();
  });

  it("缺少 dialogueKey 时直接抛错，不进入数据层", async () => {
    await expect(getCharacterVariables({ dialogueKey: "" } as unknown))
      .rejects
      .toThrow(/dialogueKey is required/i);

    await expect(processMessageVariables({
      dialogueKey: "" as unknown,
      nodeId: "n1",
      messageContent: "content",
    }))
      .rejects
      .toThrow(/dialogueKey is required/i);

    expect(getDialogueTreeById).not.toHaveBeenCalled();
  });

  it("读取变量时仅使用提供的 dialogueKey", async () => {
    const tree = {
      id: "session-1",
      nodes: [
        { nodeId: "root", parentNodeId: "", parsedContent: {} },
        { nodeId: "n1", parentNodeId: "root", parsedContent: { variables: baseVariables } },
      ],
      current_nodeId: "n1",
    };

    getDialogueTreeById.mockResolvedValueOnce(tree);
    getDialoguePathToNode.mockResolvedValueOnce([tree.nodes[0], tree.nodes[1]]);

    const vars = await getCharacterVariables({ dialogueKey: "session-1" });

    expect(vars?.stat_data.hp).toBe(1);
    expect(getDialogueTreeById).toHaveBeenCalledTimes(1);
    expect(getDialogueTreeById).toHaveBeenCalledWith("session-1");
  });

  it("写入变量时保留 session 范围且不回落其他键", async () => {
    const tree = {
      id: "session-1",
      nodes: [
        { nodeId: "root", parentNodeId: "", parsedContent: {} },
        { nodeId: "n1", parentNodeId: "root", parsedContent: { variables: baseVariables } },
      ],
      current_nodeId: "n1",
    };

    getDialogueTreeById.mockResolvedValue(tree);
    getDialoguePathToNode.mockResolvedValue([tree.nodes[0], tree.nodes[1]]);
    updateNodeInDialogueTree.mockResolvedValue(tree);

    const result = await processMessageVariables({
      dialogueKey: "session-1",
      nodeId: "n1",
      messageContent: "<UpdateVariable>_.set('hp', 3);</UpdateVariable>",
    });

    expect(result?.stat_data.hp).toBe(3);
    expect(getDialogueTreeById).toHaveBeenCalledWith("session-1");
    expect(updateNodeInDialogueTree).toHaveBeenCalledTimes(1);
    const [, , payload] = updateNodeInDialogueTree.mock.calls[0];
    expect(payload.parsedContent?.variables?.stat_data.hp).toBe(3);
    expect(payload.parsedContent?.variables?.display_data.hp).toContain("1->3");
  });
});
