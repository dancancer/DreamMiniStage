/* ═══════════════════════════════════════════════════════════════════════════
   Google Token Usage 适配器

   处理 Google Gemini API 响应中的 token 使用量信息
   支持 response_metadata.usage 格式和 usageMetadata 格式
   ═══════════════════════════════════════════════════════════════════════════ */

import type { TokenUsageAdapter, TokenUsage } from "./types";
import { isNonNullObject, getNestedProperty } from "./types";

/* ─────────────────────────────────────────────────────────────────────────────
   Google response_metadata.usage 格式适配器

   格式示例:
   {
     response_metadata: {
       usage: {
         prompt_tokens: 100,
         completion_tokens: 50,
         total_tokens: 150
       }
     }
   }
   ───────────────────────────────────────────────────────────────────────────── */

export const googleResponseMetadataAdapter: TokenUsageAdapter = {
  name: "google-response-metadata",

  canHandle(response: unknown): boolean {
    if (!isNonNullObject(response)) return false;
    const usage = getNestedProperty(response, ["response_metadata", "usage"]);
    // 检查是否是 Google 格式（与 OpenAI 区分）
    return (
      isNonNullObject(usage) &&
      typeof (usage as Record<string, unknown>).prompt_tokens === "number"
    );
  },

  extract(response: unknown): TokenUsage | null {
    const usage = getNestedProperty(response, [
      "response_metadata",
      "usage",
    ]) as Record<string, number>;
    if (!usage) return null;

    return {
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
    };
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   Google usageMetadata 格式适配器（原生 Gemini API 格式）

   格式示例:
   {
     usageMetadata: {
       promptTokenCount: 100,
       candidatesTokenCount: 50,
       totalTokenCount: 150
     }
   }
   ───────────────────────────────────────────────────────────────────────────── */

export const googleNativeUsageAdapter: TokenUsageAdapter = {
  name: "google-native-usage",

  canHandle(response: unknown): boolean {
    if (!isNonNullObject(response)) return false;
    const metadata = getNestedProperty(response, ["usageMetadata"]);
    return (
      isNonNullObject(metadata) &&
      typeof (metadata as Record<string, unknown>).promptTokenCount === "number"
    );
  },

  extract(response: unknown): TokenUsage | null {
    const metadata = getNestedProperty(response, ["usageMetadata"]) as Record<
      string,
      number
    >;
    if (!metadata) return null;

    return {
      promptTokens: metadata.promptTokenCount ?? 0,
      completionTokens: metadata.candidatesTokenCount ?? 0,
      totalTokens: metadata.totalTokenCount ?? 0,
    };
  },
};
