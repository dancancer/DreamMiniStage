/**
 * @input  lib/data/local-storage, lib/models/regex-script-model, lib/data/roleplay/regex-allow-list-operation
 * @output RegexScriptOperations
 * @pos    正则脚本数据操作层,管理脚本存储、合并、授权控制
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

import {
  REGEX_SCRIPTS_FILE,
  deleteRecord,
  getRecordMap,
  getRecordByKey,
  putRecord,
} from "@/lib/data/local-storage";
import {
  RegexScript,
  RegexAllowList,
  ScriptSource,
  normalizeRegexScript,
} from "@/lib/models/regex-script-model";
import { AllowListOperations } from "@/lib/data/roleplay/regex-allow-list-operation";
import {
  buildRegexScriptSources,
  isRegexScriptSourceAllowed,
  normalizeRegexScriptsBySource,
  sortRegexScriptsByPriority,
  type RegexScriptSourceOptions,
} from "@/lib/data/roleplay/regex-script-source";

export interface RegexScriptSettings {
  enabled: boolean;
  applyToPrompt: boolean;
  applyToResponse: boolean;
  metadata?: unknown;
}

const DEFAULT_SETTINGS: RegexScriptSettings = {
  enabled: true,
  applyToPrompt: false,
  applyToResponse: true,
};

interface GetAllScriptsOptions extends RegexScriptSourceOptions {
  allowedOnly?: boolean;
}

export class RegexScriptOperations {
  private static async getRegexScriptStore(): Promise<Record<string, unknown>> {
    try {
      return await getRecordMap<unknown>(REGEX_SCRIPTS_FILE);
    } catch (error) {
      console.error("Error reading regex scripts:", error);
      return {};
    }
  }

  static async getRegexScripts(ownerId: string): Promise<Record<string, RegexScript> | null> {
    try {
      const scripts = await getRecordByKey<Record<string, RegexScript>>(REGEX_SCRIPTS_FILE, ownerId);
      return scripts || null;
    } catch (error) {
      console.error("Error getting regex scripts:", error);
      return null;
    }
  }

  static async updateRegexScript(
    ownerId: string,
    scriptId: string,
    updates: Partial<RegexScript>,
  ): Promise<boolean> {
    const scripts = await this.getRegexScripts(ownerId);
    
    if (!scripts || !scripts[scriptId]) {
      return false;
    }
    
    scripts[scriptId] = { ...scripts[scriptId], ...updates };
    
    return this.updateOwnerScripts(ownerId, scripts);
  }

  static async addRegexScript(
    ownerId: string,
    script: RegexScript,
  ): Promise<string | null> {
    const scripts = await this.getRegexScripts(ownerId) || {};

    const scriptId = `script_${Object.keys(scripts).length}_${Date.now().toString().slice(-4)}`;

    const newScript = {
      ...script,
      id: scriptId,
    };
    
    scripts[scriptId] = newScript;
    
    const success = await this.updateOwnerScripts(ownerId, scripts);
    return success ? scriptId : null;
  }

  static async deleteRegexScript(ownerId: string, scriptId: string): Promise<boolean> {
    const scripts = await this.getRegexScripts(ownerId);
    
    if (!scripts || !scripts[scriptId]) {
      return false;
    }
    
    delete scripts[scriptId];
    return this.updateOwnerScripts(ownerId, scripts);
  }

  private static async updateOwnerScripts(ownerId: string, scripts: Record<string, RegexScript>): Promise<boolean> {
    try {
      await putRecord(REGEX_SCRIPTS_FILE, ownerId, scripts);
      return true;
    } catch (error) {
      console.error("Error updating regex scripts:", error);
      return false;
    }
  }

  static async updateRegexScripts(
    ownerId: string,
    regexScripts: Record<string, RegexScript> | RegexScript[],
  ): Promise<boolean> {
    const processScript = (script: RegexScript): RegexScript => {
      return {
        ...script,
        disabled: script.disabled || false,
        scriptName: script.scriptName || "Unnamed Script",
        trimStrings: script.trimStrings || [],
        placement: script.placement || [999],
      } as RegexScript;
    };
    
    const scripts = Array.isArray(regexScripts)
      ? regexScripts.reduce((acc, script, i) => {
        if (!script.findRegex) {
          console.warn("Skipping invalid regex script", script);
          return acc;
        }
        const processedScript = processScript(script);
        return {
          ...acc,
          [`script_${i}`]: processedScript,
        };
      }, {} as Record<string, RegexScript>)
      : Object.fromEntries(
        Object.entries(regexScripts).map(([key, script]) => {
          if (!script.findRegex) {
            console.warn("Skipping invalid regex script", script);
            return [key, null];
          }
          const processedScript = processScript(script);
          return [key, processedScript];
        }).filter(([_, script]) => script !== null),
      );
    
    await putRecord(REGEX_SCRIPTS_FILE, ownerId, scripts);
    return true;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     批量操作
     ───────────────────────────────────────────────────────────────────────── */

  static async bulkEnable(ownerId: string, scriptIds: string[]): Promise<boolean> {
    const scripts = await this.getRegexScripts(ownerId);
    if (!scripts || scriptIds.length === 0) return false;

    let changed = false;
    for (const id of scriptIds) {
      const script = scripts[id];
      if (!script) continue;
      if (script.disabled === false) continue;
      scripts[id] = { ...script, disabled: false };
      changed = true;
    }

    if (!changed) return false;
    return this.updateOwnerScripts(ownerId, scripts);
  }

  static async bulkDisable(ownerId: string, scriptIds: string[]): Promise<boolean> {
    const scripts = await this.getRegexScripts(ownerId);
    if (!scripts || scriptIds.length === 0) return false;

    let changed = false;
    for (const id of scriptIds) {
      const script = scripts[id];
      if (!script) continue;
      if (script.disabled === true) continue;
      scripts[id] = { ...script, disabled: true };
      changed = true;
    }

    if (!changed) return false;
    return this.updateOwnerScripts(ownerId, scripts);
  }

  static async bulkDelete(ownerId: string, scriptIds: string[]): Promise<boolean> {
    const scripts = await this.getRegexScripts(ownerId);
    if (!scripts || scriptIds.length === 0) return false;

    let changed = false;
    for (const id of scriptIds) {
      if (!scripts[id]) continue;
      delete scripts[id];
      changed = true;
    }

    if (!changed) return false;
    return this.updateOwnerScripts(ownerId, scripts);
  }

  static async bulkMove(
    ownerId: string,
    scriptIds: string[],
    targetSource: ScriptSource,
    targetOwnerId?: string,
  ): Promise<boolean> {
    if (scriptIds.length === 0) return false;
    if (targetSource !== ScriptSource.GLOBAL && targetSource !== ScriptSource.CHARACTER) {
      return false;
    }

    const sourceScripts = await this.getRegexScripts(ownerId);
    if (!sourceScripts) return false;

    const destinationOwnerId = targetSource === ScriptSource.GLOBAL
      ? ScriptSource.GLOBAL
      : targetOwnerId;

    if (!destinationOwnerId || destinationOwnerId === ownerId) {
      return false;
    }

    const destinationScripts = (await this.getRegexScripts(destinationOwnerId)) || {};

    let moved = false;
    for (const id of scriptIds) {
      const script = sourceScripts[id];
      if (!script) continue;
      if (destinationScripts[id]) continue;

      destinationScripts[id] = normalizeRegexScript({
        ...script,
        id: script.id ?? id,
        scriptKey: script.scriptKey ?? id,
        source: targetSource,
        sourceId: destinationOwnerId,
      });
      delete sourceScripts[id];
      moved = true;
    }

    if (!moved) return false;

    const [sourceSaved, destinationSaved] = await Promise.all([
      this.updateOwnerScripts(ownerId, sourceScripts),
      this.updateOwnerScripts(destinationOwnerId, destinationScripts),
    ]);

    return sourceSaved && destinationSaved;
  }

  static async getScriptsBySource(
    source: ScriptSource,
    ownerId: string,
    options: {
      allowedOnly?: boolean;
      allowList?: RegexAllowList | null;
      apiId?: string;
      presetName?: string;
    } = {},
  ): Promise<RegexScript[]> {
    const { allowedOnly = false, allowList = null, apiId, presetName } = options;
    if (!ownerId) return [];
    const enabled = await this.getRegexScriptSettings(ownerId);
    if (!enabled.enabled) return [];
    const forbidden = allowedOnly &&
      !isRegexScriptSourceAllowed(source, ownerId, allowList, apiId, presetName);
    if (forbidden) return [];
    const scripts = await this.getRegexScripts(ownerId);
    if (!scripts) return [];
    return normalizeRegexScriptsBySource(scripts, source, ownerId);
  }

  static async getRegexScriptSettings(ownerId: string): Promise<RegexScriptSettings> {
    const settings = await getRecordByKey<RegexScriptSettings>(REGEX_SCRIPTS_FILE, `${ownerId}_settings`);
    
    if (!settings) {
      return { ...DEFAULT_SETTINGS };
    }
    
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
    };
  }

  static async updateRegexScriptSettings(
    ownerId: string,
    updates: Partial<RegexScriptSettings>,
  ): Promise<RegexScriptSettings> {
    const currentSettings = await this.getRegexScriptSettings(ownerId);
    const newSettings = { ...currentSettings, ...updates };
    
    await putRecord(REGEX_SCRIPTS_FILE, `${ownerId}_settings`, newSettings);
    
    return newSettings;
  }

  static async listGlobalRegexScriptSettings(): Promise<Array<{
    ownerId: string;
    settings: RegexScriptSettings;
  }>> {
    const store = await this.getRegexScriptStore();
    return Object.entries(store).flatMap(([key, value]) => {
      if (!key.startsWith("global_regex_") || !key.endsWith("_settings")) return [];
      return [{
        ownerId: key.replace(/_settings$/, ""),
        settings: value as RegexScriptSettings,
      }];
    });
  }

  static async deleteRegexScriptOwner(ownerId: string): Promise<boolean> {
    const settingsKey = `${ownerId}_settings`;
    const [scripts, settings] = await Promise.all([
      getRecordByKey<unknown>(REGEX_SCRIPTS_FILE, ownerId),
      getRecordByKey<unknown>(REGEX_SCRIPTS_FILE, settingsKey),
    ]);
    if (!scripts && !settings) return false;
    await Promise.all([
      scripts ? deleteRecord(REGEX_SCRIPTS_FILE, ownerId) : Promise.resolve(),
      settings ? deleteRecord(REGEX_SCRIPTS_FILE, settingsKey) : Promise.resolve(),
    ]);
    return true;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     全局来源收集：扫描所有 global_regex_* 存档
     ───────────────────────────────────────────────────────────────────────── */
  private static async getGlobalOwnerIds(): Promise<string[]> {
    const store = await this.getRegexScriptStore();
    const ownerIds = Object.keys(store).filter(
      (key) => key.startsWith("global_regex_") && !key.endsWith("_settings"),
    );

    if (store[ScriptSource.GLOBAL]) {
      ownerIds.push(ScriptSource.GLOBAL);
    }

    return ownerIds;
  }

  static async getAllScriptsForProcessing(
    ownerId: string,
    options: GetAllScriptsOptions = {},
  ): Promise<RegexScript[]> {
    const allowList = options.allowedOnly ? await AllowListOperations.getAllowList() : null;
    const sources = buildRegexScriptSources(ownerId, await this.getGlobalOwnerIds(), options);

    const merged = await Promise.all(
      sources.map(({ source, ownerId: id, apiId, presetName }) =>
        this.getScriptsBySource(source, id, {
          allowedOnly: options.allowedOnly,
          allowList,
          apiId,
          presetName,
        }),
      ),
    );

    return merged.flat().sort(sortRegexScriptsByPriority);
  }

}
