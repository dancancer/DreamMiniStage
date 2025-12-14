/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Preset 工具函数                                         ║
 * ║                                                                            ║
 * ║  职责：Preset 加载、验证、合并                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  STOpenAIPreset,
  STCombinedPreset,
  STContextPreset,
} from "../st-preset-types";
import { STMacroEvaluator } from "../st-macro-evaluator";
import { STPromptManager } from "./manager";

/* ═══════════════════════════════════════════════════════════════════════════
   工厂函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 从组合预设创建 PromptManager
 */
export function createPromptManager(
  preset: STCombinedPreset,
  macroEvaluator?: STMacroEvaluator,
): STPromptManager {
  return new STPromptManager(preset, macroEvaluator);
}

/**
 * 从 OpenAI Preset 创建 PromptManager
 */
export function createPromptManagerFromOpenAI(
  openaiPreset: STOpenAIPreset,
  contextPreset?: STContextPreset,
  macroEvaluator?: STMacroEvaluator,
): STPromptManager {
  return new STPromptManager({ openai: openaiPreset, context: contextPreset }, macroEvaluator);
}

/* ═══════════════════════════════════════════════════════════════════════════
   验证函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 验证 OpenAI Preset 格式
 */
export function validateOpenAIPreset(preset: unknown): preset is STOpenAIPreset {
  if (typeof preset !== "object" || preset === null) return false;

  const p = preset as Record<string, unknown>;
  if (!Array.isArray(p.prompts) || !Array.isArray(p.prompt_order)) return false;

  for (const prompt of p.prompts) {
    if (typeof prompt !== "object" || prompt === null) return false;
    if (typeof (prompt as Record<string, unknown>).identifier !== "string") return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   合并函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 合并两个 preset（用于覆盖默认值）
 */
export function mergePresets(
  base: STOpenAIPreset,
  override: Partial<STOpenAIPreset>,
): STOpenAIPreset {
  const merged = { ...base, ...override };

  if (override.prompts) {
    const promptMap = new Map(base.prompts.map((p) => [p.identifier, p]));
    for (const prompt of override.prompts) {
      promptMap.set(prompt.identifier, { ...promptMap.get(prompt.identifier), ...prompt });
    }
    merged.prompts = Array.from(promptMap.values());
  }

  if (override.prompt_order) {
    merged.prompt_order = override.prompt_order;
  }

  return merged;
}
