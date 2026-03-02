/**
 * @input  lib/data/roleplay/world-book-operation
 * @output deleteWorldBookEntry
 * @pos    世界书条目删除 - 删除单个世界书条目
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";

export async function deleteWorldBookEntry(characterId: string, entryId: string) {
  if (!characterId || !entryId) {
    throw new Error("Character ID and Entry ID are required");
  }

  try {
    const success = await WorldBookOperations.deleteWorldBookEntry(characterId, entryId);
    
    return {
      success,
    };
  } catch (error) {
    console.error("Failed to delete world book entry:", error);
    throw new Error(`Failed to delete world book entry: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
