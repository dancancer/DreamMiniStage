/**
 * @input  lib/data/roleplay/world-book-operation
 * @output bulkToggleWorldBookEntries
 * @pos    世界书批量操作 - 批量启用/禁用世界书条目
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";

export async function bulkToggleWorldBookEntries(
  characterId: string,
  entryIds: string[],
  enabled: boolean,
) {
  if (!characterId) {
    throw new Error("Character ID is required");
  }

  if (!entryIds || entryIds.length === 0) {
    throw new Error("At least one entry ID is required");
  }

  try {
    const worldBook = await WorldBookOperations.getWorldBook(characterId);
    
    if (!worldBook) {
      throw new Error("World book not found");
    }

    let updatedCount = 0;
    const now = Date.now();

    for (const entryId of entryIds) {
      if (worldBook[entryId]) {
        worldBook[entryId] = {
          ...worldBook[entryId],
          enabled,
          extensions: {
            ...worldBook[entryId].extensions,
            updatedAt: now,
          },
        };
        updatedCount++;
      }
    }

    if (updatedCount === 0) {
      return {
        success: false,
        message: "No entries were found to update",
        updatedCount: 0,
      };
    }

    const result = await WorldBookOperations.updateWorldBook(characterId, worldBook);
    
    return {
      success: result,
      updatedCount,
      message: `${updatedCount} entries ${enabled ? "enabled" : "disabled"}`,
    };
  } catch (error) {
    console.error("Failed to bulk toggle world book entries:", error);
    throw new Error(`Failed to bulk toggle world book entries: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
} 
