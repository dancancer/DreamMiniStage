import {
  DEFAULT_CONTEXT_PRESET,
  PostProcessingMode,
  type STContextPreset,
} from "@/lib/core/st-preset-types";

export interface BuiltInContextPreset extends STContextPreset {
  description: string;
}

export interface InstructPresetDefinition {
  name: string;
  description: string;
  postProcessingMode: PostProcessingMode;
}

export const BUILT_IN_CONTEXT_PRESETS: BuiltInContextPreset[] = [
  {
    ...DEFAULT_CONTEXT_PRESET,
    description: "保持当前 DreamMiniStage 的默认角色上下文编排。",
  },
  {
    ...DEFAULT_CONTEXT_PRESET,
    name: "Minimal",
    story_string: "{{#if description}}{{description}}\n{{/if}}{{#if scenario}}{{scenario}}\n{{/if}}{{#if persona}}{{persona}}\n{{/if}}{{trim}}",
    example_separator: "---",
    chat_start: "",
    names_as_stop_strings: false,
    description: "压缩为最小故事上下文，减少重复提示与噪声。",
  },
];

export const INSTRUCT_PRESET_DEFINITIONS: InstructPresetDefinition[] = [
  {
    name: "Roleplay",
    description: "保持多条消息结构，只做最小格式规整。",
    postProcessingMode: PostProcessingMode.MERGE,
  },
  {
    name: "ChatML",
    description: "合并连续同角色消息，适合聊天模板模型。",
    postProcessingMode: PostProcessingMode.SEMI,
  },
  {
    name: "Strict",
    description: "严格规整 prompt，确保首条非 system 消息为 user。",
    postProcessingMode: PostProcessingMode.STRICT,
  },
  {
    name: "Single User",
    description: "将上下文折叠为单条 user 消息，适合极简兼容模式。",
    postProcessingMode: PostProcessingMode.SINGLE,
  },
];

export function findBuiltInContextPreset(name?: string | null): BuiltInContextPreset | undefined {
  const target = (name || "").trim().toLowerCase();
  if (!target) {
    return undefined;
  }
  return BUILT_IN_CONTEXT_PRESETS.find((preset) => preset.name.trim().toLowerCase() === target);
}

export function findInstructPreset(name?: string | null): InstructPresetDefinition | undefined {
  const target = (name || "").trim().toLowerCase();
  if (!target) {
    return undefined;
  }
  return INSTRUCT_PRESET_DEFINITIONS.find((preset) => preset.name.trim().toLowerCase() === target);
}
