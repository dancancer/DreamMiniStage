/**
 * @input  lib/data/roleplay/character-dialogue-operation, lib/data/roleplay/character-record-operation, lib/core/character, function/dialogue/processed-dialogue
 * @output getCharacterDialogue
 * @pos    对话信息获取 - 获取角色对话完整信息
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import { Character } from "@/lib/core/character";
import { buildProcessedDialogue } from "@/function/dialogue/processed-dialogue";

/**
 * 获取角色对话信息
 * 
 * @param dialogueKey - 对话索引 Key（sessionId）
 * @param characterId - 角色 ID（用于获取角色信息）
 * @param language - 语言
 * @param username - 用户名
 */
export async function getCharacterDialogue(
  dialogueKey: string,
  characterId: string,
  language: "en" | "zh" = "zh",
  username?: string
) {
  if (!dialogueKey) {
    throw new Error("dialogueKey is required");
  }
  if (!characterId) {
    throw new Error("Character ID is required");
  }

  try {
    const characterRecord = await LocalCharacterRecordOperations.getCharacterById(characterId);
    if (!characterRecord) {
      throw new Error(`Character not found: ${characterId}`);
    }
    const character = new Character(characterRecord);
    const dialogueTree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueKey);
    let processedDialogue = null;

    if (dialogueTree) {
      processedDialogue = buildProcessedDialogue(dialogueTree);
    }

    return {
      success: true,
      character: {
        id: character.id,
        data: character.getData(language, username),
        imagePath: character.imagePath,
      },
      dialogue: processedDialogue,
    };
  } catch (error) {
    console.error("Failed to get character information:", error);
    throw new Error(`Failed to get character information: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
