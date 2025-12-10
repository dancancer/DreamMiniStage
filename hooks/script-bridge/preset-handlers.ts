/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         预设操作 Handlers                                  ║
 * ║                                                                            ║
 * ║  实现 Requirements 7.1-7.5：                                               ║
 * ║  • getPresetNames - 返回所有预设名称列表                                    ║
 * ║  • getPreset - 按名称或 ID 获取预设配置                                     ║
 * ║  • loadPreset - 激活指定预设                                               ║
 * ║  • createPreset - 创建新预设                                               ║
 * ║  • deletePreset - 删除预设                                                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { PresetOperations } from "@/lib/data/roleplay/preset-operation";
import { importPresetFromJson } from "@/function/preset/import";
import type { Preset } from "@/lib/models/preset-model";
import type { ApiHandlerMap } from "./types";

// ============================================================================
//                              辅助函数
// ============================================================================

/**
 * 根据名称或 ID 查找预设
 * 好品味：统一查找逻辑，消除重复代码
 */
async function findPresetByNameOrId(nameOrId: string): Promise<Preset | null> {
  if (!nameOrId) return null;
  
  const presets = await PresetOperations.getAllPresets();
  
  // 优先按 ID 精确匹配
  const byId = presets.find((p) => p.id === nameOrId);
  if (byId) return byId;
  
  // 其次按名称匹配
  return presets.find((p) => p.name === nameOrId) || null;
}

// ============================================================================
//                              查询操作
// ============================================================================

/**
 * 获取所有预设名称列表
 * Requirements 7.1: WHEN a script calls `getPresetNames()` THEN the System
 * SHALL return an array of all available preset names
 */
async function getPresetNames() {
  const presets = await PresetOperations.getAllPresets();
  return presets.map((p) => p.name);
}

/**
 * 获取预设详情（支持按名称或 ID 查找）
 * Requirements 7.2: WHEN a script calls `getPreset(name)` THEN the System
 * SHALL return the full preset configuration object
 */
async function getPreset(args: unknown[]) {
  const [nameOrId] = args as [string];
  return findPresetByNameOrId(nameOrId);
}

/**
 * 获取预设的有序 prompts 列表
 */
async function getOrderedPrompts(args: unknown[]) {
  const [nameOrId] = args as [string];
  const preset = await findPresetByNameOrId(nameOrId);
  if (!preset?.id) return [];
  return PresetOperations.getPromptsOrderedForDisplay(preset.id);
}

/**
 * 获取当前激活的预设名称
 */
async function getLoadedPresetName() {
  const presets = await PresetOperations.getAllPresets();
  const active = presets.find((preset) => preset.enabled !== false);
  return active?.name || null;
}

// ============================================================================
//                              创建/更新操作
// ============================================================================

/**
 * 创建新预设
 * Requirements 7.4: WHEN a script calls `createPreset(name, config)` THEN the
 * System SHALL create a new preset with the given configuration
 * 
 * 支持两种调用方式：
 * 1. createPreset(name, config) - SillyTavern 风格
 * 2. createPreset(presetData) - 完整对象风格
 */
async function createPreset(args: unknown[]) {
  const [first, second] = args as [string | Partial<Preset>, Partial<Preset>?];
  
  // 判断调用方式：如果第一个参数是字符串，则为 (name, config) 风格
  const payload: Partial<Preset> = typeof first === "string"
    ? { name: first, ...(second || {}), prompts: second?.prompts || [] }
    : { name: first?.name || "New Preset", ...first, prompts: first?.prompts || [] };
  
  payload.enabled = payload.enabled !== false;
  
  return PresetOperations.createPreset(payload as Preset);
}

/**
 * 更新预设（支持按名称或 ID）
 */
async function updatePreset(args: unknown[]) {
  const [nameOrId, updates] = args as [string, Partial<Preset>];
  const preset = await findPresetByNameOrId(nameOrId);
  if (!preset?.id) return false;
  return PresetOperations.updatePreset(preset.id, updates || {});
}

/**
 * 创建或替换预设
 */
async function createOrReplacePreset(args: unknown[]) {
  const [presetData] = args as [Partial<Preset>];
  
  // 按 ID 或名称查找现有预设
  const existing = presetData?.id 
    ? await PresetOperations.getPreset(presetData.id)
    : presetData?.name 
      ? await findPresetByNameOrId(presetData.name)
      : null;
  
  if (existing?.id) {
    await PresetOperations.updatePreset(existing.id, presetData);
    return existing.id;
  }
  
  return PresetOperations.createPreset(presetData as Preset);
}

/**
 * 重命名预设（支持按名称或 ID）
 */
async function renamePreset(args: unknown[]) {
  const [nameOrId, newName] = args as [string, string];
  if (!nameOrId || !newName) return false;
  
  const preset = await findPresetByNameOrId(nameOrId);
  if (!preset?.id) return false;
  
  return PresetOperations.updatePreset(preset.id, { name: newName });
}

/**
 * 替换预设内容（支持按名称或 ID）
 */
async function replacePreset(args: unknown[]) {
  const [nameOrId, newPreset] = args as [string, Partial<Preset>];
  const preset = await findPresetByNameOrId(nameOrId);
  if (!preset?.id) return false;
  return PresetOperations.updatePreset(preset.id, newPreset || {});
}

// ============================================================================
//                              删除/加载操作
// ============================================================================

/**
 * 删除预设（支持按名称或 ID）
 * Requirements 7.5: WHEN a script calls `deletePreset(name)` THEN the System
 * SHALL remove the preset from storage
 */
async function deletePreset(args: unknown[]) {
  const [nameOrId] = args as [string];
  const preset = await findPresetByNameOrId(nameOrId);
  if (!preset?.id) return false;
  return PresetOperations.deletePreset(preset.id);
}

/**
 * 加载（激活）预设
 * Requirements 7.3: WHEN a script calls `loadPreset(name)` THEN the System
 * SHALL activate the specified preset for subsequent generations
 */
async function loadPreset(args: unknown[]) {
  const [nameOrId] = args as [string];
  const target = await findPresetByNameOrId(nameOrId);
  if (!target?.id) return false;

  const presets = await PresetOperations.getPresets();
  
  // 禁用其他预设，启用目标预设
  for (const id of Object.keys(presets)) {
    if (id !== target.id && presets[id].enabled !== false) {
      await PresetOperations.updatePreset(id, { enabled: false });
    }
  }
  
  await PresetOperations.updatePreset(target.id, { enabled: true });
  return target.name;
}

// ============================================================================
//                              导入操作
// ============================================================================

async function importPreset(args: unknown[]) {
  const [jsonContent, customName] = args as [string | object, string?];
  const parsedJson =
    typeof jsonContent === "string" ? jsonContent : JSON.stringify(jsonContent || {});
  const result = await importPresetFromJson(parsedJson, customName);
  if (!result.success) {
    return { success: false, error: result.error || "Import failed" };
  }
  return { success: true, presetId: result.presetId };
}

// ============================================================================
//                              导出 Handler Map
// ============================================================================

export const presetHandlers: ApiHandlerMap = {
  "preset.getPresetNames": getPresetNames,
  "preset.getPreset": getPreset,
  "preset.createPreset": createPreset,
  "preset.deletePreset": deletePreset,
  "preset.updatePreset": updatePreset,
  "preset.loadPreset": loadPreset,
  "preset.getLoadedPresetName": getLoadedPresetName,
  "preset.createOrReplacePreset": createOrReplacePreset,
  "preset.renamePreset": renamePreset,
  "preset.replacePreset": replacePreset,
  "preset.updatePresetWith": updatePreset,
  "preset.setPreset": updatePreset,
  "preset.getOrderedPrompts": getOrderedPrompts,
  "preset.importPreset": importPreset,
};
