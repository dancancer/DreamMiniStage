/**
 * @input  lib/data/roleplay/character-record-operation
 * @output saveCharacterPrompts
 * @pos    提示词保存 - 保存角色自定义提示词
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";

interface SaveCharacterPromptsOptions {
  characterId: string;
  prompts: any;
}

export async function saveCharacterPrompts({ characterId, prompts }: SaveCharacterPromptsOptions) {
  if (!characterId || !prompts) {
    throw new Error("Missing required fields");
  }

  try {
    const character = await LocalCharacterRecordOperations.getCharacterById(characterId);
    if (!character) {
      throw new Error("Character not found");
    }

    const updatedData = {
      ...character.data,
      custom_prompts: prompts,
    };

    const updatedCharacter = await LocalCharacterRecordOperations.updateCharacter(characterId, updatedData);

    return { success: true, character: updatedCharacter };
  } catch (error) {
    console.error("Error saving character prompts:", error);
    throw new Error("Failed to save character prompts");
  }
}
