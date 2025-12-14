/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     模型转换器索引                                          ║
 * ║                                                                            ║
 * ║  职责：                                                                     ║
 * ║  1. 统一导出所有模型转换器                                                   ║
 * ║  2. 提供 getConverterForModel 工厂函数                                      ║
 * ║                                                                            ║
 * ║  设计哲学：                                                                  ║
 * ║  - 消除特殊情况：通过映射表替代 switch/case                                   ║
 * ║  - 类型安全：利用 TypeScript 联合类型约束模型名称                             ║
 * ║  - 可扩展：新增模型只需添加映射条目                                           ║
 * ║                                                                            ║
 * ║  Requirements: 7.1, 8.1                                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

/* ═══════════════════════════════════════════════════════════════════════════
   导出转换器
   ═══════════════════════════════════════════════════════════════════════════ */

export {
  convertForClaude,
  type ClaudeConversionResult,
  type ClaudeConvertOptions,
  type ClaudeMessage,
  type ClaudeSystemBlock,
  type ClaudeContentPart,
  type ClaudeImageSource,
} from "./claude";

export {
  convertForGoogle,
  type GoogleConversionResult,
  type GoogleConvertOptions,
  type GoogleMessage,
  type GoogleSystemInstruction,
  type GooglePart,
  type GoogleInlineData,
  type GoogleFileData,
} from "./google";

/* ═══════════════════════════════════════════════════════════════════════════
   模型类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 支持的模型类型
 *
 * 设计说明：
 * - claude: Anthropic Claude 系列
 * - google: Google Gemini 系列
 * - openai: OpenAI GPT 系列（直接使用，无需转换）
 */
export type ModelType = "claude" | "google" | "openai";

/* ═══════════════════════════════════════════════════════════════════════════
   工厂函数
   ═══════════════════════════════════════════════════════════════════════════ */

import { convertForClaude } from "./claude";
import { convertForGoogle } from "./google";
import type { ExtendedChatMessage } from "../../st-preset-types";
import type { ClaudeConversionResult, ClaudeConvertOptions } from "./claude";
import type { GoogleConversionResult, GoogleConvertOptions } from "./google";

/**
 * 获取模型对应的转换器
 *
 * 设计哲学：
 * - 简单直接：映射表查找，无复杂逻辑
 * - 类型安全：返回类型根据模型自动推断
 * - 优雅降级：未知模型返回 null，调用方决定处理方式
 *
 * Requirements: 7.1, 8.1
 *
 * @param modelType - 模型类型
 * @returns 对应的转换器函数，或 null（openai/未知模型）
 */
export function getConverterForModel(
  modelType: "claude"
): (
  messages: ExtendedChatMessage[],
  options?: ClaudeConvertOptions
) => ClaudeConversionResult;

export function getConverterForModel(
  modelType: "google"
): (
  messages: ExtendedChatMessage[],
  options?: GoogleConvertOptions
) => GoogleConversionResult;

export function getConverterForModel(modelType: "openai"): null;

export function getConverterForModel(
  modelType: ModelType
): ((messages: ExtendedChatMessage[], options?: Record<string, unknown>) => unknown) | null;

export function getConverterForModel(
  modelType: ModelType,
): ((messages: ExtendedChatMessage[], options?: Record<string, unknown>) => unknown) | null {
  // 映射表：用数据结构替代条件分支
  const converterMap: Record<string, typeof convertForClaude | typeof convertForGoogle> = {
    claude: convertForClaude,
    google: convertForGoogle,
  };

  // OpenAI 格式是基准格式，无需转换
  if (modelType === "openai") {
    return null;
  }

  return converterMap[modelType] ?? null;
}

/**
 * 检查模型是否需要转换
 *
 * @param modelType - 模型类型
 * @returns 是否需要转换
 */
export function requiresConversion(modelType: ModelType): boolean {
  return modelType !== "openai";
}
