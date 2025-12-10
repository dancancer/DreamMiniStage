/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       preset-editor 导出与类型                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

export interface PresetPromptData {
  identifier: string;
  name: string;
  system_prompt?: boolean;
  enabled?: boolean;
  marker?: boolean;
  role?: string;
  content?: string;
  injection_position?: number;
  injection_depth?: number;
  forbid_overrides?: boolean;
  contentLength: number;
}

export interface PresetData {
  id: string;
  name: string;
  enabled?: boolean;
  prompts: PresetPromptData[];
  created_at?: string;
  updated_at?: string;
  totalPrompts: number;
  enabledPrompts: number;
  lastUpdated: number;
}

export { PresetHeader } from "./PresetHeader";
export { PresetControls } from "./PresetControls";
export { PresetTable } from "./PresetTable";
