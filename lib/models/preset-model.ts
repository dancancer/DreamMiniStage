/**
 * @input  lib/model-runtime
 * @output Preset, PresetPrompt, PromptOrderEntry, PromptOrderGroup
 * @pos    Preset 预设数据模型,定义提示词组合与排序配置
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

import type { ModelAdvancedSettings } from "@/lib/model-runtime";
import type { STContextPreset, STSyspromptPreset } from "@/lib/core/st-preset-types";

export interface PresetPrompt {
  identifier: string;
  name: string;
  enabled?: boolean;
  marker?: boolean;
  role?: string;
  content?: string;
  forbid_overrides?: boolean;
  group_id?: string | number;
  position?: number;
  injection_position?: number;
  injection_depth?: number;
  injection_order?: number;
}

export interface PromptOrderEntry {
  identifier: string;
  enabled: boolean;
}

export interface PromptOrderGroup {
  character_id: number;
  order: PromptOrderEntry[];
}

export interface Preset {
  id?: string;
  name: string;
  enabled?: boolean;
  prompts: PresetPrompt[];
  prompt_order?: PromptOrderGroup[];
  sampling?: ModelAdvancedSettings;
  context?: STContextPreset;
  sysprompt?: STSyspromptPreset;
  created_at?: string;
  updated_at?: string;
}
