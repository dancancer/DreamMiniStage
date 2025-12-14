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
  created_at?: string;
  updated_at?: string;
}
