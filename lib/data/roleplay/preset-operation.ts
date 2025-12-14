import {
  PRESET_FILE,
  clearStore,
  getAllEntries,
  getRecordByKey,
  putRecord,
} from "@/lib/data/local-storage";
import { Preset, PresetPrompt } from "@/lib/models/preset-model";
import { importPreset as normalizePresetData, type NormalizedPreset } from "@/lib/adapters/import/preset-import";
import { sortPrompts, getPromptsFromBestGroup } from "@/lib/core/prompt/sorting";

export class PresetOperations {
  static async getPresets(): Promise<Record<string, Preset>> {
    const entries = await getAllEntries<Preset>(PRESET_FILE);
    return entries.reduce<Record<string, Preset>>((acc, { key, value }) => {
      if (key) acc[String(key)] = value;
      return acc;
    }, {});
  }

  private static async savePresets(presets: Record<string, Preset>): Promise<void> {
    await clearStore(PRESET_FILE);
    for (const [key, value] of Object.entries(presets)) {
      await putRecord(PRESET_FILE, key, value);
    }
  }

  static async getAllPresets(): Promise<Preset[]> {
    try {
      const presets = await this.getPresets();
      const presetList = Object.entries(presets)
        .filter(([key]) => !key.endsWith("_settings"))
        .map(([_, value]) => value as Preset);
      
      return presetList;
    } catch (error) {
      console.error("Error getting presets:", error);
      return [];
    }
  }

  static async getPreset(presetId: string): Promise<Preset | null> {
    try {
      const presets = await this.getPresets();
      return presets[presetId] as Preset || null;
    } catch (error) {
      console.error("Error getting preset:", error);
      return null;
    }
  }

  static async createPreset(preset: Preset): Promise<string | null> {
    try {
      const presets = await this.getPresets();
      const presetId = `preset_${Date.now()}`;
      
      const newPresetIsActive = preset.enabled !== false;

      const newPreset = {
        ...preset,
        id: presetId,
        enabled: newPresetIsActive,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      if (newPresetIsActive) {
        for (const existingPresetId in presets) {
          if (presets.hasOwnProperty(existingPresetId) && existingPresetId !== presetId) {
            if (presets[existingPresetId].enabled !== false) {
              presets[existingPresetId].enabled = false;
              presets[existingPresetId].updated_at = new Date().toISOString();
            }
          }
        }
      }
      
      presets[presetId] = newPreset;
      await this.savePresets(presets);
      
      return presetId;
    } catch (error) {
      console.error("Error creating preset:", error);
      return null;
    }
  }

  static async updatePreset(presetId: string, updates: Partial<Preset>): Promise<boolean> {
    try {
      const presets = await this.getPresets();
      
      if (!presets[presetId]) {
        return false;
      }
      
      presets[presetId] = {
        ...presets[presetId],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      
      await this.savePresets(presets);
      return true;
    } catch (error) {
      console.error("Error updating preset:", error);
      return false;
    }
  }

  static async deletePreset(presetId: string): Promise<boolean> {
    try {
      const presets = await this.getPresets();
      
      if (!presets[presetId]) {
        return false;
      }
      
      delete presets[presetId];
      await this.savePresets(presets);
      
      return true;
    } catch (error) {
      console.error("Error deleting preset:", error);
      return false;
    }
  }

  static async importPreset(jsonData: string | object, customName?: string): Promise<string | null> {
    try {
      const presetData = typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;

      /* ─────────────────────────────────────────────────────────────────────
         使用导入适配器规范化数据
         - 转换 legacy 占位符 (<USER> → {{user}})
         - 转换 prompt_order → group_id/position
         ───────────────────────────────────────────────────────────────────── */
      const normalized = normalizePresetData(presetData);

      const newPreset: Preset = {
        name: customName || normalized.name,
        enabled: true,
        prompts: normalized.prompts,
        // 不再保留 prompt_order，只使用 group_id/position
      };

      return this.createPreset(newPreset);
    } catch (error) {
      console.error("Error importing preset:", error);
      return null;
    }
  }

  static async getOrderedPrompts(presetId: string): Promise<PresetPrompt[]> {
    try {
      const preset = await this.getPreset(presetId);
      console.log(`[PresetOperations.getOrderedPrompts] presetId=${presetId}, preset=${!!preset}, enabled=${preset?.enabled}`);

      if (!preset || preset.enabled === false) {
        console.log("[PresetOperations.getOrderedPrompts] Preset not found or disabled");
        return [];
      }

      console.log(`[PresetOperations.getOrderedPrompts] prompts count: ${preset.prompts?.length || 0}`);

      /* ─────────────────────────────────────────────────────────────────────
         使用统一排序算法
         - prompt_order 已在导入时转换为 group_id/position
         - 运行时只使用单一排序路径
         ───────────────────────────────────────────────────────────────────── */
      const orderedPrompts = getPromptsFromBestGroup(preset.prompts, true);
      console.log(`[PresetOperations.getOrderedPrompts] Returning ${orderedPrompts.length} prompts`);
      return orderedPrompts;
    } catch (error) {
      console.error("Error getting ordered prompts:", error);
      return [];
    }
  }

  static async getPromptsOrderedForDisplay(presetId: string): Promise<PresetPrompt[]> {
    try {
      const preset = await this.getPreset(presetId);

      if (!preset) {
        return [];
      }

      /* ─────────────────────────────────────────────────────────────────────
         使用统一排序算法（不过滤禁用项，用于 UI 展示）
         ───────────────────────────────────────────────────────────────────── */
      return getPromptsFromBestGroup(preset.prompts, false);
    } catch (error) {
      console.error("Error getting ordered prompts for display:", error);
      return [];
    }
  }

  static async updateCharacterPrompt(
    presetId: string,
    characterId: string | number,
    promptData: {
      identifier: string;
      name: string;
      content?: string;
      enabled?: boolean;
      position?: number;
      [key: string]: unknown;
    },
  ): Promise<boolean> {
    try {
      const preset = await this.getPreset(presetId);
      
      if (!preset) {
        return false;
      }
      
      const groupPrompts = preset.prompts.filter(
        prompt => String(prompt.group_id) === String(characterId),
      );
      
      const existingIndex = groupPrompts.findIndex(
        prompt => prompt.identifier === promptData.identifier,
      );
      
      const updatedPrompt: PresetPrompt = {
        ...promptData,
        group_id: characterId,
        position: promptData.position !== undefined ? 
          promptData.position : 
          groupPrompts.length > 0 ? 
            Math.max(...groupPrompts.map(p => p.position || 0)) + 1 : 
            0,
      };
      
      const updatedPrompts = [...preset.prompts];
      
      if (existingIndex >= 0) {
        const globalIndex = updatedPrompts.findIndex(
          p => p.identifier === promptData.identifier && 
               String(p.group_id) === String(characterId),
        );
        
        if (globalIndex >= 0) {
          updatedPrompts[globalIndex] = updatedPrompt;
        }
      } else {
        updatedPrompts.push(updatedPrompt);
      }
      
      return this.updatePreset(presetId, { prompts: updatedPrompts });
    } catch (error) {
      console.error("Error updating character prompt:", error);
      return false;
    }
  }
}
