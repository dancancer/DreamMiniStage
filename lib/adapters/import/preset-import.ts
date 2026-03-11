/* ═══════════════════════════════════════════════════════════════════════════
   Preset 导入适配器

   设计理念：
   - 边界转换：在导入时一次性完成所有格式规范化
   - prompt_order → group_id/position 转换
   - 消除运行时格式检测
   ═══════════════════════════════════════════════════════════════════════════ */

import type { ImportAdapter } from "./types";
import { createImportPipeline, isNonNullObject } from "./types";
import {
  convertPresetToModelAdvancedSettings,
  normalizeModelAdvancedSettings,
  resolveModelAdvancedSettings,
  type ModelAdvancedSettings,
} from "@/lib/model-runtime";
import {
  DEFAULT_CONTEXT_PRESET,
  type STContextPreset,
  type STSyspromptPreset,
} from "@/lib/core/st-preset-types";
import type { Preset, PresetPrompt, PromptOrderGroup } from "@/lib/models/preset-model";

/* ─────────────────────────────────────────────────────────────────────────────
   类型定义
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 规范化后的 Preset（不含 prompt_order）
 */
export interface NormalizedPreset extends Omit<Preset, "prompt_order"> {
  prompts: NormalizedPresetPrompt[];
}

/**
 * 规范化后的 PresetPrompt（必有 group_id/position）
 */
export interface NormalizedPresetPrompt extends PresetPrompt {
  group_id: string | number;
  position: number;
}

/**
 * 原始 Preset 输入（可能包含旧格式）
 */
interface RawPreset {
  name?: string;
  prompts?: RawPresetPrompt[];
  prompt_order?: PromptOrderGroup[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  openai_max_context?: number;
  openai_max_tokens?: number;
  stream_openai?: boolean;
  sampling?: Partial<ModelAdvancedSettings>;
  context?: Partial<STContextPreset>;
  sysprompt?: Partial<STSyspromptPreset>;
  [key: string]: unknown;
}

/** 原始 PresetPrompt */
interface RawPresetPrompt {
  identifier: string;
  name?: string;
  content?: string;
  enabled?: boolean;
  marker?: boolean;
  role?: string;
  group_id?: string | number;
  position?: number;
  [key: string]: unknown;
}

/* ─────────────────────────────────────────────────────────────────────────────
   prompt_order → group_id/position 转换
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 将 prompt_order 转换为 group_id/position
 *
 * SillyTavern 使用 prompt_order 数组控制 prompt 顺序
 * 现代格式使用每个 prompt 上的 group_id 和 position 字段
 *
 * @param prompts - 原始 prompts 列表
 * @param promptOrder - SillyTavern 格式的 prompt_order
 * @returns 带有 group_id/position 的 prompts
 */
export function convertPromptOrder(
  prompts: RawPresetPrompt[],
  promptOrder: PromptOrderGroup[],
): NormalizedPresetPrompt[] {
  const promptMap = new Map<string, RawPresetPrompt>();
  for (const prompt of prompts) {
    promptMap.set(prompt.identifier, prompt);
  }

  const result: NormalizedPresetPrompt[] = [];
  const processedIds = new Set<string>();

  for (let groupIdx = 0; groupIdx < promptOrder.length; groupIdx++) {
    const orderGroup = promptOrder[groupIdx];
    const groupId = orderGroup.character_id ?? groupIdx + 1;

    if (!Array.isArray(orderGroup.order)) continue;

    for (let position = 0; position < orderGroup.order.length; position++) {
      const entry = orderGroup.order[position];
      const identifier = entry.identifier;

      if (processedIds.has(identifier)) continue;
      processedIds.add(identifier);

      const existingPrompt = promptMap.get(identifier);

      if (existingPrompt) {
        result.push(
          normalizePrompt({
            ...existingPrompt,
            enabled: entry.enabled !== false,
            group_id: groupId,
            position,
          }),
        );
      } else {
        result.push({
          identifier,
          name: identifier,
          enabled: entry.enabled !== false,
          marker: true,
          group_id: groupId,
          position,
        });
      }
    }
  }

  for (const prompt of prompts) {
    if (!processedIds.has(prompt.identifier)) {
      result.push(
        normalizePrompt({
          ...prompt,
          group_id: prompt.group_id ?? 0,
          position: prompt.position ?? result.length,
        }),
      );
    }
  }

  return result;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Prompt 规范化
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 规范化单个 Prompt
 *
 * - 确保 group_id/position 存在
 */
function normalizeContextPresetField(value: unknown): STContextPreset | undefined {
  if (!isNonNullObject(value)) {
    return undefined;
  }

  const preset = value as Partial<STContextPreset>;
  const storyString = typeof preset.story_string === "string"
    ? preset.story_string
    : DEFAULT_CONTEXT_PRESET.story_string;
  const exampleSeparator = typeof preset.example_separator === "string"
    ? preset.example_separator
    : DEFAULT_CONTEXT_PRESET.example_separator;
  const chatStart = typeof preset.chat_start === "string"
    ? preset.chat_start
    : DEFAULT_CONTEXT_PRESET.chat_start;

  return {
    ...DEFAULT_CONTEXT_PRESET,
    ...preset,
    name: String(preset.name || DEFAULT_CONTEXT_PRESET.name).trim() || DEFAULT_CONTEXT_PRESET.name,
    story_string: storyString,
    example_separator: exampleSeparator,
    chat_start: chatStart,
    use_stop_strings: preset.use_stop_strings === true,
    names_as_stop_strings: preset.names_as_stop_strings !== false,
    story_string_position: typeof preset.story_string_position === "number"
      ? preset.story_string_position
      : DEFAULT_CONTEXT_PRESET.story_string_position,
    story_string_depth: typeof preset.story_string_depth === "number"
      ? preset.story_string_depth
      : DEFAULT_CONTEXT_PRESET.story_string_depth,
    story_string_role: typeof preset.story_string_role === "number"
      ? preset.story_string_role
      : DEFAULT_CONTEXT_PRESET.story_string_role,
    always_force_name2: preset.always_force_name2 !== false,
    trim_sentences: preset.trim_sentences === true,
    single_line: preset.single_line === true,
  };
}

function normalizeSyspromptField(value: unknown): STSyspromptPreset | undefined {
  if (!isNonNullObject(value)) {
    return undefined;
  }

  const preset = value as Partial<STSyspromptPreset>;
  const content = String(preset.content || "");
  const postHistory = String(preset.post_history || "");
  if (content.trim().length === 0 && postHistory.trim().length === 0) {
    return undefined;
  }

  return {
    name: String(preset.name || "Default").trim() || "Default",
    content,
    post_history: postHistory,
  };
}

function normalizePrompt(prompt: RawPresetPrompt & {
  group_id?: string | number;
  position?: number;
}): NormalizedPresetPrompt {
  return {
    identifier: prompt.identifier,
    name: prompt.name ?? prompt.identifier,
    enabled: prompt.enabled !== false,
    marker: prompt.marker,
    role: prompt.role,
    content: prompt.content,
    forbid_overrides: prompt.forbid_overrides as boolean | undefined,
    injection_position: prompt.injection_position as number | undefined,
    injection_depth: prompt.injection_depth as number | undefined,
    injection_order: prompt.injection_order as number | undefined,
    group_id: prompt.group_id ?? 0,
    position: prompt.position ?? 0,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   类型守卫函数
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 检查是否为有效的原始 Preset
 */
function isRawPreset(value: unknown): value is RawPreset {
  if (!isNonNullObject(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    (typeof obj.name === "string" || obj.name === undefined) &&
    (Array.isArray(obj.prompts) || obj.prompts === undefined)
  );
}

/**
 * 检查是否包含 prompt_order（SillyTavern 格式）
 */
function hasPromptOrder(preset: RawPreset): preset is RawPreset & { prompt_order: PromptOrderGroup[] } {
  return Array.isArray(preset.prompt_order) && preset.prompt_order.length > 0;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Preset 规范化核心函数
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 规范化 Preset
 *
 * 1. 如果有 prompt_order，转换为 group_id/position
 * 2. 移除 prompt_order 字段
 */
export function normalizePreset(raw: RawPreset): NormalizedPreset {
  const prompts = raw.prompts ?? [];

  let normalizedPrompts: NormalizedPresetPrompt[];

  if (hasPromptOrder(raw)) {
    normalizedPrompts = convertPromptOrder(prompts, raw.prompt_order);
  } else {
    normalizedPrompts = prompts.map((p, idx) =>
      normalizePrompt({
        ...p,
        group_id: p.group_id ?? 1,
        position: p.position ?? idx,
      }),
    );
  }

  const currentSampling = isNonNullObject(raw.sampling)
    ? normalizeModelAdvancedSettings(raw.sampling as Partial<ModelAdvancedSettings>)
    : undefined;
  const legacySampling = convertPresetToModelAdvancedSettings(raw);

  return {
    id: raw.id as string | undefined,
    name: raw.name ?? "Imported Preset",
    enabled: raw.enabled as boolean | undefined,
    prompts: normalizedPrompts,
    sampling: resolveModelAdvancedSettings({
      request: currentSampling,
      preset: legacySampling,
    }),
    context: normalizeContextPresetField(raw.context),
    sysprompt: normalizeSyspromptField(raw.sysprompt),
    created_at: raw.created_at as string | undefined,
    updated_at: raw.updated_at as string | undefined,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   适配器实现
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 标准 Preset 适配器
 *
 * 支持 SillyTavern 格式和现代格式
 */
export const standardPresetAdapter: ImportAdapter<RawPreset, NormalizedPreset> = {
  name: "standard-preset",
  canHandle: isRawPreset,
  normalize: normalizePreset,
};

/* ─────────────────────────────────────────────────────────────────────────────
   导出的管道
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Preset 导入管道
 *
 * @example
 * import { presetImportPipeline } from "@/lib/adapters/import/preset-import";
 * const preset = presetImportPipeline.process(jsonData);
 */
export const presetImportPipeline = createImportPipeline<NormalizedPreset>(
  [standardPresetAdapter],
  "preset",
);

/**
 * 从任意格式的 JSON 数据导入 Preset
 */
export function importPreset(jsonData: unknown): NormalizedPreset {
  return presetImportPipeline.process(jsonData);
}

/**
 * 检查 JSON 数据是否可以被导入为 Preset
 */
export function canImportPreset(jsonData: unknown): boolean {
  return standardPresetAdapter.canHandle(jsonData);
}
