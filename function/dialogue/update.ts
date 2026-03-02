/**
 * @input  lib/data/roleplay/character-record-operation
 * @output updateCharacter
 * @pos    角色更新 - 更新角色数据
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";

export async function updateCharacter(
  character_id: string,
  character_data: any,
): Promise<{ success: true; character: any }> {
  try {
    const existingCharacter = await LocalCharacterRecordOperations.getCharacterById(character_id);
    if (!existingCharacter) {
      throw new Error("Character not found");
    }

    const updatedCharacter = await LocalCharacterRecordOperations.updateCharacter(character_id, character_data);
    if (!updatedCharacter) {
      throw new Error("Failed to update character");
    }

    return {
      success: true,
      character: updatedCharacter,
    };
  } catch (error) {
    console.error("Failed to update character:", error);
    throw new Error(`Failed to update character: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
