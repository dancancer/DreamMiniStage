import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";
import { RegexScript, ScriptSource } from "@/lib/models/regex-script-model";

export interface GlobalRegexScript {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  scriptCount: number;
  sourceCharacterId?: string;
  sourceCharacterName?: string;
}

export interface GlobalRegexScriptResult {
  success: boolean;
  message: string;
  globalId?: string;
  regexScript?: GlobalRegexScript;
}

export interface ListGlobalRegexScriptsResult {
  success: boolean;
  globalRegexScripts: GlobalRegexScript[];
  message?: string;
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                        Type Guard for Settings                            ║
 * ║  类型守卫：检查对象是否包含 metadata 属性                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
function hasMetadata(obj: unknown): obj is { metadata: GlobalRegexScript } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "metadata" in obj &&
    typeof (obj as { metadata: unknown }).metadata === "object"
  );
}

export async function getNextGlobalId(): Promise<string> {
  try {
    const result = await listGlobalRegexScripts();
    if (!result.success) {
      return "global_regex_1";
    }

    const existingIds = result.globalRegexScripts.map(script => {
      const match = script.id.match(/^global_regex_(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });

    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    return `global_regex_${maxId + 1}`;
  } catch (error) {
    console.error("Failed to get next global ID:", error);
    return "global_regex_1";
  }
}

export async function listGlobalRegexScripts(): Promise<ListGlobalRegexScriptsResult> {
  try {
    const globalRegexScripts: GlobalRegexScript[] = [];
    const store = await RegexScriptOperations["getRegexScriptStore"]();
    
    for (const key of Object.keys(store)) {
      if (key.startsWith("global_regex_") && key.endsWith("_settings")) {
        const settings = store[key];

        // ═══════════════════════════════════════════════════════════════════════
        // 类型守卫：确保 settings 包含有效的 metadata
        // ═══════════════════════════════════════════════════════════════════════
        if (hasMetadata(settings)) {
          globalRegexScripts.push(settings.metadata);
        }
      }
    }

    globalRegexScripts.sort((a, b) => b.createdAt - a.createdAt);

    return {
      success: true,
      globalRegexScripts,
    };
  } catch (error) {
    console.error("Failed to list global regex scripts:", error);
    return {
      success: false,
      globalRegexScripts: [],
      message: `Failed to list global regex scripts: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function getGlobalRegexScript(globalId: string): Promise<{
  success: boolean;
  scripts?: Record<string, RegexScript>;
  metadata?: GlobalRegexScript;
  message?: string;
}> {
  try {
    if (!globalId.startsWith("global_regex_")) {
      return {
        success: false,
        message: "Invalid global regex script ID",
      };
    }

    const scripts = await RegexScriptOperations.getRegexScripts(globalId);
    const settings = await RegexScriptOperations.getRegexScriptSettings(globalId);

    if (!scripts || !settings?.metadata) {
      return {
        success: false,
        message: "Global regex script not found",
      };
    }

    return {
      success: true,
      scripts,
      metadata: settings.metadata as GlobalRegexScript,
    };
  } catch (error) {
    console.error("Failed to get global regex script:", error);
    return {
      success: false,
      message: `Failed to get global regex script: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function importFromGlobalRegexScript(
  characterId: string,
  globalId: string,
): Promise<{
  success: boolean;
  message: string;
  importedCount: number;
}> {
  try {
    const globalResult = await getGlobalRegexScript(globalId);
    if (!globalResult.success || !globalResult.scripts) {
      return {
        success: false,
        message: globalResult.message || "Failed to load global regex script",
        importedCount: 0,
      };
    }

    const characterScripts = await RegexScriptOperations.getRegexScripts(characterId) || {};
    let importedCount = 0;
    const now = Date.now();

    for (const [scriptId, script] of Object.entries(globalResult.scripts)) {
      const newScriptId = `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      characterScripts[newScriptId] = {
        ...script,
        scriptKey: newScriptId,
        extensions: {
          imported: true,
          importedAt: now,
          globalSource: true,
          globalSourceId: globalId,
          globalSourceName: globalResult.metadata?.name,
        },
      };
      importedCount++;
    }

    const saveResult = await RegexScriptOperations.updateRegexScripts(characterId, characterScripts);
    if (!saveResult) {
      return {
        success: false,
        message: "Failed to save imported scripts",
        importedCount: 0,
      };
    }

    return {
      success: true,
      message: `Successfully imported ${importedCount} scripts from global regex script "${globalResult.metadata?.name}"`,
      importedCount,
    };
  } catch (error) {
    console.error("Failed to import from global regex script:", error);
    return {
      success: false,
      message: `Failed to import from global regex script: ${error instanceof Error ? error.message : "Unknown error"}`,
      importedCount: 0,
    };
  }
}

export async function deleteGlobalRegexScript(globalId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    if (!globalId.startsWith("global_regex_")) {
      return {
        success: false,
        message: "Invalid global regex script ID",
      };
    }

    const store = await RegexScriptOperations["getRegexScriptStore"]();
    
    delete store[globalId];
    
    delete store[`${globalId}_settings`];
    
    await RegexScriptOperations["saveRegexScriptStore"](store);

    return {
      success: true,
      message: "Global regex script deleted successfully",
    };
  } catch (error) {
    console.error("Failed to delete global regex script:", error);
    return {
      success: false,
      message: `Failed to delete global regex script: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                 导出局部/预设脚本为全局正则脚本                      ║
 * ║  保持脚本原样，仅追加 source 元数据，统一写入 global_regex_* 存档     ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */
export async function exportToGlobalRegexScripts(
  ownerId: string,
  scriptIds: string[] = [],
  options: {
    name?: string;
    description?: string;
    sourceCharacterName?: string;
  } = {},
): Promise<GlobalRegexScriptResult> {
  try {
    const scripts = await RegexScriptOperations.getRegexScripts(ownerId) || {};

    const selectedEntries = scriptIds.length > 0
      ? Object.entries(scripts).filter(([id]) => scriptIds.includes(id))
      : Object.entries(scripts);

    if (selectedEntries.length === 0) {
      return {
        success: false,
        message: "No scripts available to export",
      };
    }

    const normalizedScripts: Record<string, RegexScript> = {};
    selectedEntries.forEach(([id, script]) => {
      const scriptKey = script.scriptKey || id;
      normalizedScripts[id] = {
        ...script,
        id: script.id ?? id,
        scriptKey,
        source: ScriptSource.GLOBAL,
        sourceId: ownerId,
      };
    });

    const globalId = await getNextGlobalId();
    const now = Date.now();

    const metadata = {
      id: globalId,
      name: options.name || `Global Regex ${globalId}`,
      description: options.description || "",
      createdAt: now,
      updatedAt: now,
      scriptCount: Object.keys(normalizedScripts).length,
      sourceCharacterId: ownerId,
      sourceCharacterName: options.sourceCharacterName,
    };

    await RegexScriptOperations.updateRegexScripts(globalId, normalizedScripts);
    await RegexScriptOperations.updateRegexScriptSettings(globalId, {
      enabled: true,
      applyToPrompt: false,
      applyToResponse: true,
      metadata,
    });

    return {
      success: true,
      message: `Exported ${Object.keys(normalizedScripts).length} scripts to ${globalId}`,
      globalId,
      regexScript: metadata,
    };
  } catch (error) {
    console.error("Failed to export scripts to global regex:", error);
    return {
      success: false,
      message: `Failed to export scripts to global: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
