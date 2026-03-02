import type { DialogueNode, DialogueTree } from "@/lib/models/node-model";

export interface SwipeInfo {
  activeIndex: number;
  total: number;
}

export type SwipeTarget =
  | { kind: "prev" }
  | { kind: "next" }
  | { kind: "index"; index: number };

export function getSwipeSiblings(tree: DialogueTree, nodeId: string): DialogueNode[] {
  const node = tree.nodes.find((item) => item.nodeId === nodeId);
  if (!node) return [];
  if (!node.userInput) return [];

  return tree.nodes.filter(
    (candidate) =>
      candidate.parentNodeId === node.parentNodeId && candidate.userInput === node.userInput,
  );
}

export function getSwipeInfo(tree: DialogueTree, nodeId: string): SwipeInfo | null {
  const siblings = getSwipeSiblings(tree, nodeId);
  if (siblings.length <= 1) return null;

  const activeIndex = siblings.findIndex((item) => item.nodeId === nodeId);
  if (activeIndex < 0) return null;

  return { activeIndex, total: siblings.length };
}

export function resolveSwipeTargetNodeId(
  tree: DialogueTree,
  currentNodeId: string,
  target: SwipeTarget,
): string {
  const siblings = getSwipeSiblings(tree, currentNodeId);
  if (siblings.length <= 1) return currentNodeId;

  const activeIndex = siblings.findIndex((item) => item.nodeId === currentNodeId);
  if (activeIndex < 0) return currentNodeId;

  const total = siblings.length;
  const nextIndex =
    target.kind === "index"
      ? clampIndex(target.index, total)
      : target.kind === "next"
        ? (activeIndex + 1) % total
        : (activeIndex - 1 + total) % total;

  return siblings[nextIndex]?.nodeId ?? currentNodeId;
}

function clampIndex(index: number, total: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), Math.max(total - 1, 0));
}

