/* ═══════════════════════════════════════════════════════════════════════════
   OpenAI Token Usage 适配器

   处理 OpenAI API 响应中的 token 使用量信息
   支持 usage_metadata 格式（LangChain ChatOpenAI 返回格式）
   ═══════════════════════════════════════════════════════════════════════════ */

import type { TokenUsageAdapter, TokenUsage } from "./types";
import { isNonNullObject, getNestedProperty } from "./types";

/* ─────────────────────────────────────────────────────────────────────────────
   OpenAI usage_metadata 格式适配器

   格式示例:
   {
     usage_metadata: {
       input_tokens: 100,
       output_tokens: 50,
       total_tokens: 150
     }
   }
   ───────────────────────────────────────────────────────────────────────────── */

export const openaiUsageMetadataAdapter: TokenUsageAdapter = {
  name: "openai-usage-metadata",

  canHandle(response: unknown): boolean {
    if (!isNonNullObject(response)) return false;
    const metadata = getNestedProperty(response, ["usage_metadata"]);
    return (
      isNonNullObject(metadata) &&
      typeof (metadata as Record<string, unknown>).input_tokens === "number"
    );
  },

  extract(response: unknown): TokenUsage | null {
    const metadata = getNestedProperty(response, ["usage_metadata"]) as Record<
      string,
      number
    >;
    if (!metadata) return null;

    return {
      promptTokens: metadata.input_tokens ?? 0,
      completionTokens: metadata.output_tokens ?? 0,
      totalTokens: metadata.total_tokens ?? 0,
    };
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   OpenAI response_metadata.usage 格式适配器

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

export const openaiResponseMetadataUsageAdapter: TokenUsageAdapter = {
  name: "openai-response-metadata-usage",

  canHandle(response: unknown): boolean {
    if (!isNonNullObject(response)) return false;
    const usage = getNestedProperty(response, ["response_metadata", "usage"]);
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
