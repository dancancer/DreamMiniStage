import { describe, expect, it } from "vitest";

import { DialogueNode, DialogueTree } from "@/lib/models/node-model";
import {
  DEFAULT_DIALOGUE_SUMMARY_CONFIG,
  buildDialogueSummaryState,
} from "@/function/dialogue/dialogue-summary";

function createDialogueTree(nodes: DialogueNode[], currentNodeId: string): DialogueTree {
  return new DialogueTree("dialogue-summary-test", "char-summary-test", nodes, currentNodeId);
}

describe("buildDialogueSummaryState", () => {
  it("prefers per-turn compressedContent for older turns", () => {
    const tree = createDialogueTree([
      new DialogueNode("root", "", "", "", ""),
      new DialogueNode("n1", "root", "", "开场白", "开场白", "", {
        compressedContent: "开场：角色与用户第一次见面。",
      }),
      new DialogueNode("n2", "n1", "继续", "推进剧情", "推进剧情", "", {
        compressedContent: "进展：两人继续交谈并确认目标。",
      }),
      new DialogueNode("n3", "n2", "最新动作", "最新回复", "最新回复"),
    ], "n3");

    const state = buildDialogueSummaryState(tree, {
      triggerThreshold: 4,
      preserveRecentMessages: 2,
      maxSummaryLength: DEFAULT_DIALOGUE_SUMMARY_CONFIG.maxSummaryLength,
    });

    expect(state).not.toBeNull();
    expect(state?.content).toContain("开场：角色与用户第一次见面。");
    expect(state?.content).toContain("进展：两人继续交谈并确认目标。");
    expect(state?.content).not.toContain("最新回复");
    expect(state?.source).toBe("turn-summary");
  });

  it("falls back to structured summary when compressedContent is missing", () => {
    const tree = createDialogueTree([
      new DialogueNode("root", "", "", "", ""),
      new DialogueNode("n1", "root", "", "开场白", "开场白"),
      new DialogueNode("n2", "n1", "用户询问秘境入口", "她指出了山门后的石阶", "她指出了山门后的石阶"),
      new DialogueNode("n3", "n2", "继续追问", "她没有立刻回答", "她没有立刻回答"),
    ], "n3");

    const state = buildDialogueSummaryState(tree, {
      triggerThreshold: 4,
      preserveRecentMessages: 2,
      maxSummaryLength: DEFAULT_DIALOGUE_SUMMARY_CONFIG.maxSummaryLength,
    });

    expect(state).not.toBeNull();
    expect(state?.source).toBe("fallback");
    expect(state?.content).toContain("用户");
    expect(state?.content).toContain("用户询问秘境入口");
    expect(state?.content).toContain("她指出了山门后的石阶");
  });

  it("returns null when the conversation does not exceed the threshold", () => {
    const tree = createDialogueTree([
      new DialogueNode("root", "", "", "", ""),
      new DialogueNode("n1", "root", "你好", "你好。", "你好。"),
    ], "n1");

    const state = buildDialogueSummaryState(tree, {
      triggerThreshold: 4,
      preserveRecentMessages: 2,
      maxSummaryLength: DEFAULT_DIALOGUE_SUMMARY_CONFIG.maxSummaryLength,
    });

    expect(state).toBeNull();
  });

  it("tracks the active branch instead of stale sibling history", () => {
    const nodes = [
      new DialogueNode("root", "", "", "", ""),
      new DialogueNode("a1", "root", "", "分支A开场", "分支A开场", "", {
        compressedContent: "分支A：从雪夜客栈开始。",
      }),
      new DialogueNode("a2", "a1", "询问A", "回答A", "回答A", "", {
        compressedContent: "分支A：用户得知旧地图线索。",
      }),
      new DialogueNode("b1", "root", "", "分支B开场", "分支B开场", "", {
        compressedContent: "分支B：从山门外开始。",
      }),
      new DialogueNode("b2", "b1", "询问B", "回答B", "回答B", "", {
        compressedContent: "分支B：用户被引向后山。",
      }),
      new DialogueNode("b3", "b2", "继续B", "最新B", "最新B"),
    ];

    const branchA = buildDialogueSummaryState(
      createDialogueTree(nodes, "a2"),
      { triggerThreshold: 2, preserveRecentMessages: 1, maxSummaryLength: 500 },
    );
    const branchB = buildDialogueSummaryState(
      createDialogueTree(nodes, "b3"),
      { triggerThreshold: 2, preserveRecentMessages: 2, maxSummaryLength: 500 },
    );

    expect(branchA?.content).toContain("分支A");
    expect(branchA?.content).not.toContain("分支B");
    expect(branchB?.content).toContain("分支B");
    expect(branchB?.content).not.toContain("分支A");
  });
});
