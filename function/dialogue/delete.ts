/**
 * @input  lib/data/roleplay/character-dialogue-operation, function/dialogue/processed-dialogue
 * @output deleteDialogueNode
 * @pos    对话节点删除 - 删除指定的对话节点
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { buildProcessedDialogue } from "@/function/dialogue/processed-dialogue";

interface DeleteDialogueNodeOptions {
  dialogueId: string;  // 对话树 ID（sessionId）
  nodeId: string;
}

export async function deleteDialogueNode({ dialogueId, nodeId }: DeleteDialogueNodeOptions) {
  try {
    const updatedDialogueTree = await LocalCharacterDialogueOperations.deleteNode(dialogueId, nodeId);
    
    if (!updatedDialogueTree) {
      throw new Error("Failed to delete node or node not found");
    }
    const processedDialogue = buildProcessedDialogue(updatedDialogueTree);

    return {
      success: true,
      message: "Successfully deleted dialogue node",
      dialogue: processedDialogue,
    };
  } catch (error) {
    console.error("Error deleting dialogue node:", error);
    throw new Error(`Failed to delete dialogue node: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
} 
