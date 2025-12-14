import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";
import { WorldBookEntry } from "@/lib/models/world-book-model";
import { v4 as uuidv4 } from "uuid";
import { saveAsGlobalWorldBook } from "./global";
import {
  canImportWorldBook,
  importWorldBookEntries,
  type NormalizedWorldBookEntry,
} from "@/lib/adapters/import/worldbook-import";

export interface ImportWorldBookResult {
  success: boolean;
  message: string;
  importedCount: number;
  skippedCount: number;
  errors: string[];
  globalId?: string;
}

export async function importWorldBookFromJson(
  characterId: string,
  jsonData: any,
  options?: {
    saveAsGlobal?: boolean;
    globalName?: string;
    globalDescription?: string;
    sourceCharacterName?: string;
  },
): Promise<ImportWorldBookResult> {
  if (!characterId) {
    throw new Error("Character ID is required");
  }

  const result: ImportWorldBookResult = {
    success: false,
    message: "",
    importedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  try {
    /* ─────────────────────────────────────────────────────────────────────
       使用导入适配器规范化数据
       - 转换旧字段名 (key → keys, disable → enabled)
       - 支持多种输入格式
       ───────────────────────────────────────────────────────────────────── */
    if (!canImportWorldBook(jsonData)) {
      result.errors.push("Unsupported JSON format");
      result.message = "Unsupported JSON format";
      return result;
    }

    const normalizedEntries = importWorldBookEntries(jsonData);

    if (normalizedEntries.length === 0) {
      result.success = false;
      result.message = "No valid entries found to import";
      return result;
    }

    const worldBook = await WorldBookOperations.getWorldBook(characterId) || {};
    const now = Date.now();

    for (const entry of normalizedEntries) {
      try {
        const entryId = `entry_${uuidv4()}`;

        const worldBookEntry: WorldBookEntry = {
          content: entry.content,
          keys: entry.keys,
          secondary_keys: entry.secondary_keys,
          selective: entry.selective,
          constant: entry.constant,
          position: entry.position,
          insertion_order: entry.insertion_order,
          enabled: entry.enabled,
          use_regex: entry.use_regex,
          depth: entry.depth,
          comment: entry.comment,
          selectiveLogic: entry.selectiveLogic,
          tokens: entry.tokens,
          sticky: entry.sticky,
          cooldown: entry.cooldown,
          delay: entry.delay,
          probability: entry.probability,
          group: entry.group,
          group_priority: entry.group_priority,
          extensions: {
            position: entry.position as number,
            depth: entry.depth,
            createdAt: now,
            updatedAt: now,
            imported: true,
            importedAt: now,
          },
        };

        worldBook[entryId] = worldBookEntry;
        result.importedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`Failed to import entry: ${errorMessage}`);
        result.skippedCount++;
      }
    }

    if (result.importedCount > 0) {
      const updateResult = await WorldBookOperations.updateWorldBook(characterId, worldBook);
      if (updateResult) {
        result.success = true;
        result.message = `Successfully imported ${result.importedCount} entries`;

        if (options?.saveAsGlobal && options.globalName) {
          try {
            const globalResult = await saveAsGlobalWorldBook(
              characterId,
              options.globalName,
              options.globalDescription,
              options.sourceCharacterName,
            );
            if (globalResult.success && globalResult.globalId) {
              result.globalId = globalResult.globalId;
              result.message += ` and saved as global world book "${options.globalName}"`;
            }
          } catch (globalError: any) {
            result.errors.push(`Failed to save as global: ${globalError.message}`);
          }
        }
      } else {
        result.success = false;
        result.message = "Failed to save imported entries";
      }
    } else {
      result.success = false;
      result.message = "No valid entries found to import";
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to import world book:", error);
    result.errors.push(errorMessage);
    result.message = `Import failed: ${errorMessage}`;
    return result;
  }
}

export function validateWorldBookJson(jsonData: unknown): { valid: boolean; errors: string[] } {
  if (!jsonData || typeof jsonData !== "object") {
    return { valid: false, errors: ["Invalid JSON: Root must be an object"] };
  }

  if (!canImportWorldBook(jsonData)) {
    return { valid: false, errors: ["No valid entries found in the provided data"] };
  }

  return { valid: true, errors: [] };
}
