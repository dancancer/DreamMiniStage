/* ═══════════════════════════════════════════════════════════════════════════
   Anthropic Token Usage 适配器

   处理 Anthropic Claude API 响应中的 token 使用量信息
   支持 response_metadata.tokenUsage 格式
   ═══════════════════════════════════════════════════════════════════════════ */

import type { TokenUsageAdapter, TokenUsage } from "./types";
import { isNonNullObject, getNestedProperty } from "./types";

/* ─────────────────────────────────────────────────────────────────────────────
   Anthropic response_metadata.tokenUsage 格式适配器

   格式示例:
   {
     response_metadata: {
       tokenUsage: {
         promptTokens: 100,
         completionTokens: 50,
         totalTokens: 150
       }
     }
   }
   ───────────────────────────────────────────────────────────────────────────── */

export const anthropicTokenUsageAdapter: TokenUsageAdapter = {
  name: "anthropic-token-usage",

  canHandle(response: unknown): boolean {
    if (!isNonNullObject(response)) return false;
    const tokenUsage = getNestedProperty(response, [
      "response_metadata",
      "tokenUsage",
    ]);
    return (
      isNonNullObject(tokenUsage) &&
      typeof (tokenUsage as Record<string, unknown>).promptTokens === "number"
    );
  },

  extract(response: unknown): TokenUsage | null {
    const tokenUsage = getNestedProperty(response, [
      "response_metadata",
      "tokenUsage",
    ]) as Record<string, number>;
    if (!tokenUsage) return null;

    return {
      promptTokens: tokenUsage.promptTokens ?? 0,
      completionTokens: tokenUsage.completionTokens ?? 0,
      totalTokens: tokenUsage.totalTokens ?? 0,
    };
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   Anthropic usage 格式适配器（原生 API 格式）

   格式示例:
   {
     usage: {
       input_tokens: 100,
       output_tokens: 50
     }
   }
   ───────────────────────────────────────────────────────────────────────────── */

export const anthropicNativeUsageAdapter: TokenUsageAdapter = {
  name: "anthropic-native-usage",

  canHandle(response: unknown): boolean {
    if (!isNonNullObject(response)) return false;
    const usage = getNestedProperty(response, ["usage"]);
    return (
      isNonNullObject(usage) &&
      typeof (usage as Record<string, unknown>).input_tokens === "number"
    );
  },

  extract(response: unknown): TokenUsage | null {
    const usage = getNestedProperty(response, ["usage"]) as Record<
      string,
      number
    >;
    if (!usage) return null;

    const promptTokens = usage.input_tokens ?? 0;
    const completionTokens = usage.output_tokens ?? 0;

    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  },
};
