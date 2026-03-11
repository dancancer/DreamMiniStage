import {
  DEFAULT_CONTEXT_PRESET,
  PostProcessingMode,
  type PromptNames,
  type STContextPreset,
  type STSyspromptPreset,
} from "@/lib/core/st-preset-types";
import type { Preset } from "@/lib/models/preset-model";
import { findInstructPreset } from "@/lib/prompt-config/catalog";

export interface PromptBehaviorInstructState {
  enabled: boolean;
  preset: string | null;
}

export interface PromptBehaviorSyspromptState extends STSyspromptPreset {
  enabled: boolean;
}

export interface PromptBehaviorState {
  activePresetId: string | null;
  activePresetName: string | null;
  instruct: PromptBehaviorInstructState;
  context: STContextPreset;
  sysprompt: PromptBehaviorSyspromptState;
  stopStrings: string[];
  promptPostProcessing: PostProcessingMode;
}

export interface EffectivePromptConfigSummary {
  presetName: string | null;
  instructEnabled: boolean;
  instructPreset: string | null;
  promptPostProcessing: PostProcessingMode;
  contextName: string;
  syspromptEnabled: boolean;
  syspromptName: string;
  stopStrings: string[];
}

export interface ResolvedPromptRuntimeConfig {
  activePresetId: string | null;
  contextPreset: STContextPreset;
  sysprompt: PromptBehaviorSyspromptState;
  stopStrings: string[];
  promptNames: PromptNames;
  postProcessingMode: PostProcessingMode;
  effectiveConfig: EffectivePromptConfigSummary;
}

export function normalizePromptPostProcessing(value: unknown): PostProcessingMode {
  return Object.values(PostProcessingMode).includes(value as PostProcessingMode)
    ? (value as PostProcessingMode)
    : PostProcessingMode.NONE;
}

export function normalizeStopStrings(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter((value) => value.length > 0),
    ),
  );
}

export function normalizeContextPreset(value?: Partial<STContextPreset> | null): STContextPreset {
  const storyString = typeof value?.story_string === "string"
    ? value.story_string
    : DEFAULT_CONTEXT_PRESET.story_string;
  const exampleSeparator = typeof value?.example_separator === "string"
    ? value.example_separator
    : DEFAULT_CONTEXT_PRESET.example_separator;
  const chatStart = typeof value?.chat_start === "string"
    ? value.chat_start
    : DEFAULT_CONTEXT_PRESET.chat_start;

  return {
    ...DEFAULT_CONTEXT_PRESET,
    ...(value || {}),
    name: String(value?.name || DEFAULT_CONTEXT_PRESET.name).trim() || DEFAULT_CONTEXT_PRESET.name,
    story_string: storyString,
    example_separator: exampleSeparator,
    chat_start: chatStart,
    use_stop_strings: value?.use_stop_strings === true,
    names_as_stop_strings: value?.names_as_stop_strings !== false,
    story_string_position: typeof value?.story_string_position === "number"
      ? value.story_string_position
      : DEFAULT_CONTEXT_PRESET.story_string_position,
    story_string_depth: typeof value?.story_string_depth === "number"
      ? value.story_string_depth
      : DEFAULT_CONTEXT_PRESET.story_string_depth,
    story_string_role: typeof value?.story_string_role === "number"
      ? value.story_string_role
      : DEFAULT_CONTEXT_PRESET.story_string_role,
    always_force_name2: value?.always_force_name2 !== false,
    trim_sentences: value?.trim_sentences === true,
    single_line: value?.single_line === true,
  };
}

export function normalizeSyspromptState(
  value?: Partial<PromptBehaviorSyspromptState> | Partial<STSyspromptPreset> | null,
): PromptBehaviorSyspromptState {
  const content = String(value?.content || "");
  const postHistory = String(value?.post_history || "");

  return {
    enabled: value && "enabled" in value
      ? value.enabled === true
      : content.trim().length > 0 || postHistory.trim().length > 0,
    name: String(value?.name || "Default").trim() || "Default",
    content,
    post_history: postHistory,
  };
}

export function createDefaultPromptBehaviorState(): PromptBehaviorState {
  return {
    activePresetId: null,
    activePresetName: null,
    instruct: {
      enabled: false,
      preset: null,
    },
    context: normalizeContextPreset(DEFAULT_CONTEXT_PRESET),
    sysprompt: normalizeSyspromptState(),
    stopStrings: [],
    promptPostProcessing: PostProcessingMode.NONE,
  };
}

export function applyPresetPromptDefaults(preset?: Preset | null): Pick<
  PromptBehaviorState,
  "activePresetId" | "activePresetName" | "context" | "sysprompt"
> {
  return {
    activePresetId: typeof preset?.id === "string" ? preset.id : null,
    activePresetName: typeof preset?.name === "string" ? preset.name : null,
    context: normalizeContextPreset(preset?.context),
    sysprompt: normalizeSyspromptState(preset?.sysprompt),
  };
}

export function resolveEffectivePostProcessingMode(state: Pick<
  PromptBehaviorState,
  "instruct" | "promptPostProcessing"
>): PostProcessingMode {
  if (!state.instruct.enabled) {
    return PostProcessingMode.NONE;
  }

  if (state.promptPostProcessing !== PostProcessingMode.NONE) {
    return state.promptPostProcessing;
  }

  return findInstructPreset(state.instruct.preset)?.postProcessingMode || PostProcessingMode.MERGE;
}

export function buildPromptNames(charName: string, userName: string): PromptNames {
  return {
    charName,
    userName,
    groupNames: [],
    startsWithGroupName: () => false,
  };
}

export function buildEffectivePromptConfigSummary(state: Pick<
  PromptBehaviorState,
  "activePresetName" | "instruct" | "context" | "sysprompt" | "stopStrings" | "promptPostProcessing"
>): EffectivePromptConfigSummary {
  return {
    presetName: state.activePresetName,
    instructEnabled: state.instruct.enabled,
    instructPreset: state.instruct.preset,
    promptPostProcessing: resolveEffectivePostProcessingMode(state),
    contextName: state.context.name,
    syspromptEnabled: state.sysprompt.enabled,
    syspromptName: state.sysprompt.name,
    stopStrings: normalizeStopStrings(state.stopStrings),
  };
}
