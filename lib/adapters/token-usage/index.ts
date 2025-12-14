/* ═══════════════════════════════════════════════════════════════════════════
   Token Usage 适配器模块导出

   提供统一的 token 使用量提取功能，支持多种 LLM 提供商格式
   ═══════════════════════════════════════════════════════════════════════════ */

export type { TokenUsage, TokenUsageAdapter, TokenUsageExtractor } from "./types";
export { createTokenUsageExtractor, isNonNullObject, getNestedProperty } from "./types";

export {
  openaiUsageMetadataAdapter,
  openaiResponseMetadataUsageAdapter,
} from "./openai";

export {
  anthropicTokenUsageAdapter,
  anthropicNativeUsageAdapter,
} from "./anthropic";

export {
  googleResponseMetadataAdapter,
  googleNativeUsageAdapter,
} from "./google";

/* ─────────────────────────────────────────────────────────────────────────────
   预配置的提取器
   ───────────────────────────────────────────────────────────────────────────── */

import { createTokenUsageExtractor } from "./types";
import {
  openaiUsageMetadataAdapter,
  openaiResponseMetadataUsageAdapter,
} from "./openai";
import {
  anthropicTokenUsageAdapter,
  anthropicNativeUsageAdapter,
} from "./anthropic";
import {
  googleResponseMetadataAdapter,
  googleNativeUsageAdapter,
} from "./google";

/**
 * 默认的 Token Usage 提取器
 *
 * 包含所有内置适配器，按优先级排序：
 * 1. OpenAI usage_metadata（最新格式）
 * 2. Anthropic tokenUsage
 * 3. Google native usageMetadata
 * 4. OpenAI response_metadata.usage（旧格式）
 * 5. Google response_metadata.usage
 * 6. Anthropic native usage
 *
 * @example
 * import { defaultTokenUsageExtractor } from "@/lib/adapters/token-usage";
 * const usage = defaultTokenUsageExtractor.extract(llmResponse);
 */
export const defaultTokenUsageExtractor = createTokenUsageExtractor([
  openaiUsageMetadataAdapter,
  anthropicTokenUsageAdapter,
  googleNativeUsageAdapter,
  openaiResponseMetadataUsageAdapter,
  googleResponseMetadataAdapter,
  anthropicNativeUsageAdapter,
]);

/**
 * 从 LLM 响应中提取 token 使用量
 *
 * 便捷函数，使用默认提取器
 *
 * @param response - LLM 响应对象
 * @returns TokenUsage 或 null
 */
export function extractTokenUsage(response: unknown) {
  return defaultTokenUsageExtractor.extract(response);
}
