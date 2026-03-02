/**
 * @input  lib/data/roleplay/character-dialogue-operation, function/dialogue/processed-dialogue, lib/dialogue/swipe-variants
 * @output switchSwipe
 * @pos    滑动切换 - 在同一节点的多个响应变体间切换
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { buildProcessedDialogue } from "@/function/dialogue/processed-dialogue";
import { resolveSwipeTargetNodeId } from "@/lib/dialogue/swipe-variants";

interface SwitchSwipeOptions {
  dialogueId: string;
  nodeId: string;
  target: "prev" | "next" | number;
}

export async function switchSwipe({ dialogueId, nodeId, target }: SwitchSwipeOptions) {
  const dialogueTree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueId);
  if (!dialogueTree) {
    throw new Error("Dialogue not found");
  }

  if (dialogueTree.current_nodeId !== nodeId) {
    return {
      success: false,
      message: "Only the last assistant message supports swipe switching",
      dialogue: buildProcessedDialogue(dialogueTree),
    };
  }

  const swipeTarget =
    typeof target === "number"
      ? { kind: "index" as const, index: target }
      : target === "prev"
        ? { kind: "prev" as const }
        : { kind: "next" as const };

  const nextNodeId = resolveSwipeTargetNodeId(dialogueTree, nodeId, swipeTarget);
  if (nextNodeId === nodeId) {
    return {
      success: true,
      message: "No swipe change",
      dialogue: buildProcessedDialogue(dialogueTree),
    };
  }

  const updated = await LocalCharacterDialogueOperations.switchBranch(dialogueId, nextNodeId);
  if (!updated) {
    throw new Error("Failed to switch swipe");
  }

  const updatedDialogueTree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueId);
  if (!updatedDialogueTree) {
    throw new Error("Failed to retrieve updated dialogue");
  }

  return {
    success: true,
    message: "Swipe switched",
    dialogue: buildProcessedDialogue(updatedDialogueTree),
  };
}

