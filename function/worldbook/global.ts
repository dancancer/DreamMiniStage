/**
 * @input  lib/data/roleplay/world-book-operation, lib/data/roleplay/world-book-keys, lib/models/world-book-model
 * @output GlobalWorldBook, GlobalWorldBookResult, ListGlobalWorldBooksResult, getNextGlobalId, saveAsGlobalWorldBook, listGlobalWorldBooks, getGlobalWorldBook, importFromGlobalWorldBook, deleteGlobalWorldBook
 * @pos    全局世界书 - 全局世界书的 CRUD 与导入导出
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";
import {
  createUniqueGlobalWorldBookRecordKey,
  getWorldBookRecordPrefix,
  isGlobalWorldBookRecordKey,
} from "@/lib/data/roleplay/world-book-keys";
import type { WorldBookEntry } from "@/lib/models/world-book-model";

export interface GlobalWorldBook {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  entryCount: number;
  sourceCharacterId?: string;
  sourceCharacterName?: string;
}

export interface GlobalWorldBookResult {
  success: boolean;
  message: string;
  globalId?: string;
  worldBook?: GlobalWorldBook;
}

export interface ListGlobalWorldBooksResult {
  success: boolean;
  globalWorldBooks: GlobalWorldBook[];
  message?: string;
}

export async function getNextGlobalId(): Promise<string> {
  return createUniqueGlobalWorldBookRecordKey();
}

export async function saveAsGlobalWorldBook(
  sourceWorldBookKey: string,
  name: string,
  description?: string,
  sourceCharacterName?: string,
): Promise<GlobalWorldBookResult> {
  try {
    const worldBook = await WorldBookOperations.getWorldBook(sourceWorldBookKey);
    if (!worldBook) {
      return {
        success: false,
        message: "Source World Book not found",
      };
    }

    const globalId = await getNextGlobalId();
    const now = Date.now();

    const globalWorldBook: Record<string, WorldBookEntry> = {};
    Object.entries(worldBook).forEach(([entryId, entry]) => {
      globalWorldBook[entryId] = {
        ...entry,
        extensions: {
          ...entry.extensions,
          imported: true,
          importedAt: now,
          globalSource: true,
          sourceCharacterId: sourceWorldBookKey,
          sourceCharacterName,
        },
      };
    });

    await WorldBookOperations.updateWorldBook(globalId, globalWorldBook);

    const metadata: GlobalWorldBook = {
      id: globalId,
      name,
      description,
      createdAt: now,
      updatedAt: now,
      entryCount: Object.keys(globalWorldBook).length,
      sourceCharacterId: sourceWorldBookKey,
      sourceCharacterName,
    };

    // Save metadata in settings
    await WorldBookOperations.updateWorldBookSettings(globalId, {
      enabled: true,
      maxEntries: 50,
      contextWindow: 5,
      metadata,
    });

    return {
      success: true,
      message: `Global world book "${name}" created successfully with ${metadata.entryCount} entries`,
      globalId,
      worldBook: metadata,
    };
  } catch (error) {
    console.error("Failed to save as global world book:", error);
    return {
      success: false,
      message: `Failed to save as global world book: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function listGlobalWorldBooks(): Promise<ListGlobalWorldBooksResult> {
  try {
    const globalWorldBooks: GlobalWorldBook[] = [];
    const globalKeys = await WorldBookOperations.getWorldBookKeysByPrefix(
      getWorldBookRecordPrefix("global"),
    );

    for (const key of globalKeys) {
      const settings = await WorldBookOperations.getWorldBookSettings(key);
      if (settings.metadata) {
        globalWorldBooks.push(settings.metadata as GlobalWorldBook);
      }
    }

    globalWorldBooks.sort((a, b) => b.createdAt - a.createdAt);

    return {
      success: true,
      globalWorldBooks,
    };
  } catch (error) {
    console.error("Failed to list global world books:", error);
    return {
      success: false,
      globalWorldBooks: [],
      message: `Failed to list global world books: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function getGlobalWorldBook(globalId: string): Promise<{
  success: boolean;
  worldBook?: Record<string, WorldBookEntry>;
  metadata?: GlobalWorldBook;
  message?: string;
}> {
  try {
    if (!isGlobalWorldBookRecordKey(globalId)) {
      return {
        success: false,
        message: "Invalid global world book ID",
      };
    }

    const worldBook = await WorldBookOperations.getWorldBook(globalId);
    const settings = await WorldBookOperations.getWorldBookSettings(globalId);

    if (!worldBook || !settings?.metadata) {
      return {
        success: false,
        message: "Global world book not found",
      };
    }

    return {
      success: true,
      worldBook,
      metadata: settings.metadata as GlobalWorldBook,
    };
  } catch (error) {
    console.error("Failed to get global world book:", error);
    return {
      success: false,
      message: `Failed to get global world book: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function importFromGlobalWorldBook(
  targetWorldBookKey: string,
  globalId: string,
): Promise<{
  success: boolean;
  message: string;
  importedCount: number;
}> {
  try {
    const globalResult = await getGlobalWorldBook(globalId);
    if (!globalResult.success || !globalResult.worldBook) {
      return {
        success: false,
        message: globalResult.message || "Failed to load global world book",
        importedCount: 0,
      };
    }

    const characterWorldBook = await WorldBookOperations.getWorldBook(targetWorldBookKey) || {};
    const now = Date.now();
    let importedCount = 0;

    for (const [entryId, entry] of Object.entries(globalResult.worldBook)) {
      const newEntryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      characterWorldBook[newEntryId] = {
        ...entry,
        extensions: {
          ...entry.extensions,
          imported: true,
          importedAt: now,
          globalSource: true,
          globalSourceId: globalId,
          globalSourceName: globalResult.metadata?.name,
        },
      };
      importedCount++;
    }

    const saveResult = await WorldBookOperations.updateWorldBook(targetWorldBookKey, characterWorldBook);
    if (!saveResult) {
      return {
        success: false,
        message: "Failed to save imported entries",
        importedCount: 0,
      };
    }

    return {
      success: true,
      message: `Successfully imported ${importedCount} entries from global world book "${globalResult.metadata?.name}"`,
      importedCount,
    };
  } catch (error) {
    console.error("Failed to import from global world book:", error);
    return {
      success: false,
      message: `Failed to import from global world book: ${error instanceof Error ? error.message : "Unknown error"}`,
      importedCount: 0,
    };
  }
}

export async function deleteGlobalWorldBook(globalId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    if (!isGlobalWorldBookRecordKey(globalId)) {
      return {
        success: false,
        message: "Invalid global world book ID",
      };
    }

    const deleted = await WorldBookOperations.deleteWorldBook(globalId);
    if (!deleted) {
      return {
        success: false,
        message: "Global world book not found",
      };
    }

    return {
      success: true,
      message: "Global world book deleted successfully",
    };
  } catch (error) {
    console.error("Failed to delete global world book:", error);
    return {
      success: false,
      message: `Failed to delete global world book: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
} 
