/**
 * @input  lib/data/roleplay/character-dialogue-operation, function/dialogue/processed-dialogue
 * @output switchDialogueBranch
 * @pos    对话分支切换 - 切换到指定的对话节点
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { buildProcessedDialogue } from "@/function/dialogue/processed-dialogue";

interface SwitchDialogueBranchOptions {
  dialogueId: string;  // 对话树 ID（sessionId）
  nodeId: string;
}

export async function switchDialogueBranch({ dialogueId, nodeId }: SwitchDialogueBranchOptions) {

  try {
    const updated = await LocalCharacterDialogueOperations.switchBranch(dialogueId, nodeId);
    if (!updated) {
      throw new Error("Failed to switch to the specified node");
    }

    const updatedDialogueTree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueId);
    if (!updatedDialogueTree) {
      throw new Error("Failed to retrieve updated dialogue");
    }
    const processedDialogue = buildProcessedDialogue(updatedDialogueTree);

    return {
      success: true,
      message: "成功切换到指定对话节点",
      dialogue: processedDialogue,
    };
  } catch (error) {
    console.error("Error switching dialogue branch:", error);
    throw new Error(`Failed to switch dialogue branch: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
