import { 
  REGEX_SCRIPTS_FILE, 
  clearStore, 
  getAllEntries, 
  getRecordByKey, 
  putRecord, 
} from "@/lib/data/local-storage";
import { RegexScript } from "@/lib/models/regex-script-model";

export interface RegexScriptSettings {
  enabled: boolean;
  applyToPrompt: boolean;
  applyToResponse: boolean;
  metadata?: any;
}

const DEFAULT_SETTINGS: RegexScriptSettings = {
  enabled: true,
  applyToPrompt: false,
  applyToResponse: true,
};

export class RegexScriptOperations {
  private static async getRegexScriptStore(): Promise<Record<string, any>> {
    try {
      const entries = await getAllEntries<any>(REGEX_SCRIPTS_FILE);
      return entries.reduce<Record<string, any>>((acc, { key, value }) => {
        if (key) acc[String(key)] = value;
        return acc;
      }, {});
    } catch (error) {
      console.error("Error reading regex scripts:", error);
      return {};
    }
  }

  private static async saveRegexScriptStore(store: Record<string, any>): Promise<boolean> {
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

  static async getAllScriptsForProcessing(
    ownerId: string,
  ): Promise<RegexScript[]> {
    const ownerScripts = await this.getRegexScripts(ownerId) || {};
    const globalScripts = await this.getRegexScripts("global") || {};

    const allScripts: RegexScript[] = [
      ...Object.values(ownerScripts),
      ...Object.values(globalScripts),
    ];
    
    return allScripts;
  }

}
