/**
 * @input  lib/data/local-storage, lib/models/regex-script-model
 * @output RegexPresetOperations
 * @pos    正则预设数据操作层,管理脚本启用状态快照的 CRUD
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

/* ═══════════════════════════════════════════════════════════════════════════
   正则预设操作类

   职责：管理正则脚本预设的 CRUD 操作
   设计理念：预设是状态快照，不是脚本副本
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  REGEX_PRESETS_FILE,
  getRecordByKey,
  putRecord,
  deleteRecord,
  getAllEntries,
} from "@/lib/data/local-storage";
import { RegexPresetConfig } from "@/lib/models/regex-script-model";
import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";

/* ═══════════════════════════════════════════════════════════════════════════
   RegexPresetOperations 类
   ═══════════════════════════════════════════════════════════════════════════ */

export class RegexPresetOperations {
  /* ─────────────────────────────────────────────────────────────────────────
     保存预设
     
     将当前脚本的启用/禁用状态保存为预设
     设计理念：消除特殊情况，统一使用 name 作为键
     ───────────────────────────────────────────────────────────────────────── */
  
  static async savePreset(
    name: string,
    config: Omit<RegexPresetConfig, "name">,
  ): Promise<void> {
    const preset: RegexPresetConfig = {
      name,
      ...config,
    };
    
    await putRecord(REGEX_PRESETS_FILE, name, preset);
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     加载预设
     
     根据名称获取预设配置
     ───────────────────────────────────────────────────────────────────────── */
  
  static async loadPreset(name: string): Promise<RegexPresetConfig | null> {
    try {
      const preset = await getRecordByKey<RegexPresetConfig>(
        REGEX_PRESETS_FILE,
        name,
      );
      return preset;
    } catch (error) {
      console.error(`Error loading preset "${name}":`, error);
      return null;
    }
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     删除预设
     
     从存储中移除指定预设
     ───────────────────────────────────────────────────────────────────────── */
  
  static async deletePreset(name: string): Promise<void> {
    await deleteRecord(REGEX_PRESETS_FILE, name);
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     列出所有预设
     
     返回所有已保存的预设列表
     ───────────────────────────────────────────────────────────────────────── */
  
  static async listPresets(): Promise<RegexPresetConfig[]> {
    try {
      const entries = await getAllEntries<RegexPresetConfig>(REGEX_PRESETS_FILE);
      return entries.map(({ value }) => value);
    } catch (error) {
      console.error("Error listing presets:", error);
      return [];
    }
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     应用预设
     
     将预设中保存的脚本状态应用到指定 owner 的脚本
     设计理念：只修改 disabled 字段，不改变其他配置
     ───────────────────────────────────────────────────────────────────────── */
  
  static async applyPreset(name: string, ownerId: string): Promise<void> {
    const preset = await this.loadPreset(name);
    if (!preset) {
      throw new Error(`Preset "${name}" not found`);
    }
    
    const scripts = await RegexScriptOperations.getRegexScripts(ownerId);
    if (!scripts) {
      throw new Error(`No scripts found for owner "${ownerId}"`);
    }
    
    // 应用预设状态到脚本
    for (const [scriptKey, script] of Object.entries(scripts)) {
      const enabled = preset.scriptStates[scriptKey];
      if (enabled !== undefined) {
        script.disabled = !enabled;
      }
    }
    
    // 保存更新后的脚本
    await RegexScriptOperations.updateRegexScripts(ownerId, scripts);
  }
}
