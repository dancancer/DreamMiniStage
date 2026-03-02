/**
 * @input  lib/data/local-storage, lib/models/regex-script-model, lib/data/roleplay/regex-allow-list-operation
 * @output RegexScriptOperations
 * @pos    正则脚本数据操作层,管理脚本存储、合并、授权控制
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

import {
  REGEX_SCRIPTS_FILE,
  clearStore,
  getAllEntries,
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

const SOURCE_PRIORITY: Record<ScriptSource, number> = {
  [ScriptSource.GLOBAL]: 0,
  [ScriptSource.CHARACTER]: 1,
  [ScriptSource.PRESET]: 2,
};

interface GetAllScriptsOptions {
  allowedOnly?: boolean;
  includeGlobal?: boolean;
  presetSource?: {
    ownerId: string;
    apiId?: string;
    presetName?: string;
  };
}

export class RegexScriptOperations {
  private static async getRegexScriptStore(): Promise<Record<string, unknown>> {
    try {
      const entries = await getAllEntries<unknown>(REGEX_SCRIPTS_FILE);
      return entries.reduce<Record<string, unknown>>((acc, { key, value }) => {
        if (key) acc[String(key)] = value;
        return acc;
      }, {});
    } catch (error) {
      console.error("Error reading regex scripts:", error);
      return {};
    }
  }

  private static async saveRegexScriptStore(store: Record<string, unknown>): Promise<boolean> {
    try {
      await clearStore(REGEX_SCRIPTS_FILE);
      for (const [key, value] of Object.entries(store)) {
        await putRecord(REGEX_SCRIPTS_FILE, key, value);
      }
      return true;
    } catch (error) {
      console.error("Error saving regex scripts:", error);
      return false;
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
    const scriptStore = await this.getRegexScriptStore();
    
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
    
    scriptStore[ownerId] = scripts;
    await this.saveRegexScriptStore(scriptStore);
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

  /* ─────────────────────────────────────────────────────────────────────────
     来源过滤与装配
     ───────────────────────────────────────────────────────────────────────── */
  private static placementRank(placement?: number[]): number {
    return placement?.[0] ?? 999;
  }

  private static sourceRank(source?: ScriptSource): number {
    return SOURCE_PRIORITY[source as ScriptSource] ?? SOURCE_PRIORITY[ScriptSource.CHARACTER];
  }

  private static sortByPriority(a: RegexScript, b: RegexScript): number {
    const src = this.sourceRank(a.source) - this.sourceRank(b.source);
    if (src !== 0) {
      return src;
    }
    const placement = this.placementRank(a.placement) - this.placementRank(b.placement);
    if (placement !== 0) {
      return placement;
    }
    const nameA = a.scriptKey || a.scriptName || "";
    const nameB = b.scriptKey || b.scriptName || "";
    return nameA.localeCompare(nameB);
  }

  private static isSourceAllowed(
    source: ScriptSource,
    ownerId: string,
    allowList: RegexAllowList | null,
    apiId?: string,
    presetName?: string,
  ): boolean {
    if (!allowList) {
      return true;
    }
    if (source === ScriptSource.CHARACTER) {
      return allowList.characters.includes(ownerId);
    }
    if (source === ScriptSource.PRESET) {
      if (!apiId || !presetName) {
        return false;
      }
      return allowList.presets[apiId]?.includes(presetName) ?? false;
    }
    return true;
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
    const forbidden = allowedOnly && !this.isSourceAllowed(source, ownerId, allowList, apiId, presetName);
    if (forbidden) return [];
    const scripts = await this.getRegexScripts(ownerId);
    if (!scripts) return [];
    return Object.entries(scripts).map(([key, script]) => normalizeRegexScript({
      ...script,
      id: script.id ?? key,
      scriptKey: script.scriptKey ?? key,
      source,
      sourceId: ownerId,
    }));
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
    type SourceEntry = { source: ScriptSource; ownerId: string; apiId?: string; presetName?: string };

    const globalSources: SourceEntry[] = options.includeGlobal === false
      ? []
      : (await this.getGlobalOwnerIds()).map((globalOwnerId) => ({
        source: ScriptSource.GLOBAL,
        ownerId: globalOwnerId,
      }));

    const characterSources: SourceEntry[] = ownerId
      ? [{ source: ScriptSource.CHARACTER, ownerId }]
      : [];

    const presetSources: SourceEntry[] = options.presetSource?.ownerId
      ? [{
        source: ScriptSource.PRESET,
        ownerId: options.presetSource.ownerId,
        apiId: options.presetSource.apiId,
        presetName: options.presetSource.presetName,
      }]
      : [];

    const sources: SourceEntry[] = [...globalSources, ...characterSources, ...presetSources];

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

    return merged.flat().sort((a, b) => this.sortByPriority(a, b));
  }

}
