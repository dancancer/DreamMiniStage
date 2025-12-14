/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      增量对话接口 session 键测试                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getIncrementalDialogue } from "../incremental-info";

const getDialogueTreeById = vi.fn();

vi.mock("@/lib/data/roleplay/character-dialogue-operation", () => ({
  LocalCharacterDialogueOperations: {
    getDialogueTreeById: (...args: unknown[]) => getDialogueTreeById(...args),
  },
}));

describe("getIncrementalDialogue", () => {
  beforeEach(() => {
    getDialogueTreeById.mockReset();
  });

  it("缺少 dialogueId 时抛出错误", async () => {
    await expect(getIncrementalDialogue({} as any)).rejects.toThrow(/dialogueId is required/);
  });

  it("仅使用 dialogueId 读取会话树并返回增量节点", async () => {
    const tree = {
      id: "session-1",
      nodes: [
        { nodeId: "root", parentNodeId: "", parsedContent: {} },
        { nodeId: "n1", parentNodeId: "root", parsedContent: {}, updated_at: new Date().toISOString() },
      ],
      current_nodeId: "n1",
    };

    getDialogueTreeById.mockResolvedValue(tree);

    const response = await getIncrementalDialogue({
      dialogueId: "session-1",
      lastKnownNodeIds: [],
    });

    expect(response.success).toBe(true);
    expect(response.hasNewData).toBe(true);
    expect(response.newNodes.length).toBeGreaterThanOrEqual(1);
    expect(response.newNodes.map((n) => n.nodeId)).toContain("n1");
    expect(response.currentNodeId).toBe("n1");
    expect(getDialogueTreeById).toHaveBeenCalledWith("session-1");
  });
});
