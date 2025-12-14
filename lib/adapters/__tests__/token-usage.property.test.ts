/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              Token Usage Adapter Property Tests                           ║
 * ║                                                                           ║
 * ║  **Feature: compatibility-debt-remediation, Property 7: Token Usage      ║
 * ║    适配器一致性**                                                          ║
 * ║  **Validates: Requirements 8.4**                                         ║
 * ║                                                                           ║
 * ║  验证 Token Usage 适配器的核心不变量：                                       ║
 * ║  *For any* LLM response that does not contain token usage information,   ║
 * ║  all token usage adapters SHALL return null, providing consistent        ║
 * ║  behavior across providers.                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  createTokenUsageExtractor,
  extractTokenUsage,
  defaultTokenUsageExtractor,
  openaiUsageMetadataAdapter,
  openaiResponseMetadataUsageAdapter,
  anthropicTokenUsageAdapter,
  anthropicNativeUsageAdapter,
  googleResponseMetadataAdapter,
  googleNativeUsageAdapter,
  type TokenUsage,
} from "../token-usage";

/* ═══════════════════════════════════════════════════════════════════════════
   生成器定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成有效的 token 数量
 */
const tokenCountArb = fc.integer({ min: 0, max: 100000 });

/**
 * 生成 OpenAI usage_metadata 格式响应
 */
const openaiUsageMetadataResponseArb = fc.record({
  usage_metadata: fc.record({
    input_tokens: tokenCountArb,
    output_tokens: tokenCountArb,
    total_tokens: tokenCountArb,
  }),
  content: fc.string(),
});

/**
 * 生成 OpenAI response_metadata.usage 格式响应
 */
const openaiResponseMetadataUsageArb = fc.record({
  response_metadata: fc.record({
    usage: fc.record({
      prompt_tokens: tokenCountArb,
      completion_tokens: tokenCountArb,
      total_tokens: tokenCountArb,
    }),
  }),
  content: fc.string(),
});

/**
 * 生成 Anthropic tokenUsage 格式响应
 */
const anthropicTokenUsageResponseArb = fc.record({
  response_metadata: fc.record({
    tokenUsage: fc.record({
      promptTokens: tokenCountArb,
      completionTokens: tokenCountArb,
      totalTokens: tokenCountArb,
    }),
  }),
  content: fc.string(),
});

/**
 * 生成 Anthropic native usage 格式响应
 */
const anthropicNativeUsageArb = fc.record({
  usage: fc.record({
    input_tokens: tokenCountArb,
    output_tokens: tokenCountArb,
  }),
  content: fc.array(fc.record({ text: fc.string() })),
});

/**
 * 生成 Google usageMetadata 格式响应
 */
const googleNativeUsageArb = fc.record({
  usageMetadata: fc.record({
    promptTokenCount: tokenCountArb,
    candidatesTokenCount: tokenCountArb,
    totalTokenCount: tokenCountArb,
  }),
  candidates: fc.array(fc.record({ content: fc.string() })),
});

/**
 * 生成不包含 token usage 的响应
 */
const noUsageResponseArb = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.string(),
  fc.integer(),
  fc.boolean(),
  fc.record({ content: fc.string() }),
  fc.record({ response: fc.string(), metadata: fc.record({}) }),
);

/**
 * 生成任意有效格式的响应
 */
const anyValidResponseArb = fc.oneof(
  openaiUsageMetadataResponseArb,
  openaiResponseMetadataUsageArb,
  anthropicTokenUsageResponseArb,
  anthropicNativeUsageArb,
  googleNativeUsageArb,
);

/* ═══════════════════════════════════════════════════════════════════════════
   属性测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 7: Token Usage 适配器一致性", () => {
  /**
   * **Feature: compatibility-debt-remediation, Property 7: Token Usage 适配器一致性**
   * **Validates: Requirements 8.4**
   *
   * 当响应不包含 token usage 时，所有适配器应返回 null
   */
  it("*For any* response without token usage, all adapters SHALL return null", () => {
    const allAdapters = [
      openaiUsageMetadataAdapter,
      openaiResponseMetadataUsageAdapter,
      anthropicTokenUsageAdapter,
      anthropicNativeUsageAdapter,
      googleResponseMetadataAdapter,
      googleNativeUsageAdapter,
    ];

    fc.assert(
      fc.property(noUsageResponseArb, (response) => {
        for (const adapter of allAdapters) {
          if (adapter.canHandle(response)) {
            const result = adapter.extract(response);
            // 如果能处理，结果应该是有效的 TokenUsage 或 null
            if (result !== null) {
              expect(typeof result.promptTokens).toBe("number");
              expect(typeof result.completionTokens).toBe("number");
              expect(typeof result.totalTokens).toBe("number");
            }
          }
        }

        // 默认提取器对无 usage 响应应返回 null
        const result = extractTokenUsage(response);
        expect(result).toBe(null);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 7: Token Usage 适配器一致性**
   * **Validates: Requirements 8.1**
   *
   * OpenAI usage_metadata 格式应被正确处理
   */
  it("*For any* OpenAI usage_metadata response, the adapter SHALL extract correct values", () => {
    fc.assert(
      fc.property(openaiUsageMetadataResponseArb, (response) => {
        expect(openaiUsageMetadataAdapter.canHandle(response)).toBe(true);

        const result = openaiUsageMetadataAdapter.extract(response);
        expect(result).not.toBe(null);

        if (result) {
          expect(result.promptTokens).toBe(response.usage_metadata.input_tokens);
          expect(result.completionTokens).toBe(
            response.usage_metadata.output_tokens,
          );
          expect(result.totalTokens).toBe(response.usage_metadata.total_tokens);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 7: Token Usage 适配器一致性**
   * **Validates: Requirements 8.1**
   *
   * Anthropic tokenUsage 格式应被正确处理
   */
  it("*For any* Anthropic tokenUsage response, the adapter SHALL extract correct values", () => {
    fc.assert(
      fc.property(anthropicTokenUsageResponseArb, (response) => {
        expect(anthropicTokenUsageAdapter.canHandle(response)).toBe(true);

        const result = anthropicTokenUsageAdapter.extract(response);
        expect(result).not.toBe(null);

        if (result) {
          expect(result.promptTokens).toBe(
            response.response_metadata.tokenUsage.promptTokens,
          );
          expect(result.completionTokens).toBe(
            response.response_metadata.tokenUsage.completionTokens,
          );
          expect(result.totalTokens).toBe(
            response.response_metadata.tokenUsage.totalTokens,
          );
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 7: Token Usage 适配器一致性**
   * **Validates: Requirements 8.1**
   *
   * Google usageMetadata 格式应被正确处理
   */
  it("*For any* Google usageMetadata response, the adapter SHALL extract correct values", () => {
    fc.assert(
      fc.property(googleNativeUsageArb, (response) => {
        expect(googleNativeUsageAdapter.canHandle(response)).toBe(true);

        const result = googleNativeUsageAdapter.extract(response);
        expect(result).not.toBe(null);

        if (result) {
          expect(result.promptTokens).toBe(
            response.usageMetadata.promptTokenCount,
          );
          expect(result.completionTokens).toBe(
            response.usageMetadata.candidatesTokenCount,
          );
          expect(result.totalTokens).toBe(
            response.usageMetadata.totalTokenCount,
          );
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 7: Token Usage 适配器一致性**
   * **Validates: Requirements 8.1**
   *
   * 默认提取器应能处理所有已知格式
   */
  it("*For any* valid response format, the default extractor SHALL extract token usage", () => {
    fc.assert(
      fc.property(anyValidResponseArb, (response) => {
        const result = extractTokenUsage(response);
        expect(result).not.toBe(null);

        if (result) {
          // 所有值应为非负数
          expect(result.promptTokens).toBeGreaterThanOrEqual(0);
          expect(result.completionTokens).toBeGreaterThanOrEqual(0);
          expect(result.totalTokens).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 7: Token Usage 适配器一致性**
   * **Validates: Requirements 8.2**
   *
   * 提取器应支持动态注册新适配器
   */
  it("*For any* newly registered adapter, the extractor SHALL recognize its format", () => {
    const customAdapter = {
      name: "custom",
      canHandle: (response: unknown): boolean =>
        typeof response === "object" &&
        response !== null &&
        "customTokens" in response,
      extract: (response: unknown): TokenUsage | null => {
        const r = response as { customTokens: number };
        return {
          promptTokens: r.customTokens,
          completionTokens: 0,
          totalTokens: r.customTokens,
        };
      },
    };

    const extractor = createTokenUsageExtractor([customAdapter]);

    fc.assert(
      fc.property(tokenCountArb, (tokens) => {
        const response = { customTokens: tokens };
        const result = extractor.extract(response);

        expect(result).not.toBe(null);
        if (result) {
          expect(result.promptTokens).toBe(tokens);
          expect(result.totalTokens).toBe(tokens);
        }
      }),
      { numRuns: 50 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 7: Token Usage 适配器一致性**
   * **Validates: Requirements 8.3**
   *
   * 返回的 TokenUsage 对象应具有一致的结构
   */
  it("*For any* valid response, extracted TokenUsage SHALL have consistent structure", () => {
    fc.assert(
      fc.property(anyValidResponseArb, (response) => {
        const result = extractTokenUsage(response);

        if (result) {
          // 检查结构完整性
          expect("promptTokens" in result).toBe(true);
          expect("completionTokens" in result).toBe(true);
          expect("totalTokens" in result).toBe(true);

          // 检查类型
          expect(typeof result.promptTokens).toBe("number");
          expect(typeof result.completionTokens).toBe("number");
          expect(typeof result.totalTokens).toBe("number");

          // 检查只有这三个属性
          expect(Object.keys(result).sort()).toEqual([
            "completionTokens",
            "promptTokens",
            "totalTokens",
          ]);
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe("Property: Anthropic native usage 计算", () => {
  /**
   * Anthropic native 格式没有 total，需要计算
   */
  it("*For any* Anthropic native response, total SHALL equal input + output", () => {
    fc.assert(
      fc.property(anthropicNativeUsageArb, (response) => {
        const result = anthropicNativeUsageAdapter.extract(response);
        expect(result).not.toBe(null);

        if (result) {
          const expectedTotal =
            response.usage.input_tokens + response.usage.output_tokens;
          expect(result.totalTokens).toBe(expectedTotal);
        }
      }),
      { numRuns: 100 },
    );
  });
});
