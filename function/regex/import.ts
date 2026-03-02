/**
 * @input  lib/data/roleplay/regex-script-operation, lib/models/regex-script-model, lib/adapters/import, uuid
 * @output ImportRegexScriptResult, importRegexScriptFromJson
 * @pos    正则脚本导入 - 从 JSON 解析并导入正则脚本
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";
import { RegexScript } from "@/lib/models/regex-script-model";
import { importRegexScripts, canImportRegexScripts, NoAdapterMatchError } from "@/lib/adapters/import";
import { v4 as uuidv4 } from "uuid";

export interface ImportRegexScriptResult {
  success: boolean;
  message: string;
  importedCount: number;
  skippedCount: number;
  errors: string[];
  globalId?: string;
  successfulFiles?: string[];
  failedFiles?: string[];
}

export async function importRegexScriptFromJson(
  characterId: string,
  jsonData: unknown,
  options?: {
    saveAsGlobal?: boolean;
    globalName?: string;
    globalDescription?: string;
    sourceCharacterName?: string;
  },
): Promise<ImportRegexScriptResult> {
  if (!characterId) {
    throw new Error("Character ID is required");
  }

  const result: ImportRegexScriptResult = {
    success: false,
    message: "",
    importedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  try {
    /* ═══════════════════════════════════════════════════════════════════════════
       使用导入适配器进行格式检测和规范化

       适配器支持 4 种格式：
       - 数组格式: RegexScript[]
       - scripts 包装格式: { scripts: [] }
       - regexScripts 包装格式: { regexScripts: [] }
       - 单对象格式: RegexScript
       ═══════════════════════════════════════════════════════════════════════════ */

    if (!canImportRegexScripts(jsonData)) {
      result.errors.push("Unsupported JSON format");
      result.message = "Unsupported JSON format";
      return result;
    }

    let normalizedScripts: RegexScript[];
    try {
      normalizedScripts = importRegexScripts(jsonData);
    } catch (error) {
      if (error instanceof NoAdapterMatchError) {
        result.errors.push("Unsupported JSON format");
        result.message = "Unsupported JSON format";
        return result;
      }
      throw error;
    }

    if (normalizedScripts.length === 0) {
      result.errors.push("No valid scripts found");
      result.message = "No valid scripts found to import";
      return result;
    }

    const scripts = await RegexScriptOperations.getRegexScripts(characterId) || {};
    const now = Date.now();
    const importedScripts: Record<string, RegexScript> = {};

    for (const scriptData of normalizedScripts) {
      try {
        const scriptId = `script_${uuidv4()}`;

        if (!scriptData.findRegex || typeof scriptData.findRegex !== "string") {
          result.skippedCount++;
          result.errors.push("Skipped script: missing or invalid findRegex");
          continue;
        }

        const regexScript: RegexScript = {
          ...scriptData,
          scriptKey: scriptId,
          scriptName: scriptData.scriptName || "Imported Script",
          extensions: {
            ...scriptData.extensions,
            imported: true,
            importedAt: now,
          },
        };

        scripts[scriptId] = regexScript;
        importedScripts[scriptId] = regexScript;
        result.importedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`Failed to import script: ${errorMessage}`);
        result.skippedCount++;
      }
    }

    if (result.importedCount > 0) {
      const updateResult = await RegexScriptOperations.updateRegexScripts(characterId, scripts);
      if (updateResult) {
        result.success = true;
        result.message = `Successfully imported ${result.importedCount} regex scripts`;
        
        if (options?.saveAsGlobal && options.globalName) {
          try {
            const store = await RegexScriptOperations["getRegexScriptStore"]();
            let nextId = 1;
            
            for (const key of Object.keys(store)) {
              if (key.startsWith("global_regex_") && key.endsWith("_settings")) {
                const match = key.match(/^global_regex_(\d+)_settings$/);
                if (match) {
                  const id = parseInt(match[1], 10);
                  if (id >= nextId) {
                    nextId = id + 1;
                  }
                }
              }
            }
            
            const globalId = `global_regex_${nextId}`;
            
            await RegexScriptOperations.updateRegexScripts(globalId, importedScripts);
            
            const now = Date.now();
            const metadata = {
              id: globalId,
              name: options.globalName,
              description: options.globalDescription || "",
              createdAt: now,
              updatedAt: now,
              scriptCount: Object.keys(importedScripts).length,
              sourceCharacterId: characterId,
              sourceCharacterName: options.sourceCharacterName,
            };
            
            await RegexScriptOperations.updateRegexScriptSettings(globalId, {
              enabled: true,
              applyToPrompt: false,
              applyToResponse: true,
              metadata,
            });
            
            result.globalId = globalId;
            result.message += ` and saved as global regex script "${options.globalName}"`;
          } catch (globalError) {
            const errorMessage = globalError instanceof Error ? globalError.message : "Unknown error";
            result.errors.push(`Failed to save as global: ${errorMessage}`);
          }
        }
      } else {
        result.success = false;
        result.message = "Failed to save imported scripts";
      }
    } else {
      result.success = false;
      result.message = "No valid scripts found to import";
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to import regex scripts:", error);
    result.errors.push(errorMessage);
    result.message = `Import failed: ${errorMessage}`;
    return result;
  }
}
