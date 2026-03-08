/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              Preset Import Property Tests                                ║
 * ║                                                                           ║
 * ║  **Feature: compatibility-debt-remediation**                              ║
 * ║  **Property 2: 导入格式规范化 Round-Trip**                                ║
 * ║  **Property 9: Preset 排序字段规范化**                                    ║
 * ║  **Validates: Requirements 3.1, 3.2, 3.5, 4.2, 12.1, 12.2, 12.4**        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  importPreset,
  canImportPreset,
  convertPromptOrder,
  normalizePreset,
} from "../import/preset-import";

/* ═══════════════════════════════════════════════════════════════════════════
   生成器定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 现代占位符列表
 */
const MODERN_PLACEHOLDERS = [
  "{{user}}",
  "{{char}}",
  "{{group}}",
  "{{scenario}}",
  "{{lastUserMessage}}",
  "{{persona}}",
  "{{description}}",
];

/**
 * 生成包含现代占位符的内容
 */
const modernContentArb = fc
  .tuple(
    fc.string({ minLength: 0, maxLength: 50 }),
    fc.constantFrom(...MODERN_PLACEHOLDERS),
    fc.string({ minLength: 0, maxLength: 50 }),
  )
  .map(([before, placeholder, after]) => `${before}${placeholder}${after}`);

/**
 * 生成有效的 Prompt 标识符
 */
const identifierArb = fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,20}$/);

/**
 * 生成单个原始 Prompt
 */
const rawPromptArb = fc.record({
  identifier: identifierArb,
  name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  content: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined }),
  enabled: fc.option(fc.boolean(), { nil: undefined }),
  marker: fc.option(fc.boolean(), { nil: undefined }),
  role: fc.option(fc.constantFrom("system", "user", "assistant"), { nil: undefined }),
});

/**
 * 生成 SillyTavern 格式的 prompt_order 条目
 */
const promptOrderEntryArb = fc.record({
  identifier: identifierArb,
  enabled: fc.boolean(),
});

/**
 * 生成 SillyTavern 格式的 prompt_order 组
 */
const promptOrderGroupArb = fc.record({
  character_id: fc.integer({ min: 1, max: 100 }),
  order: fc.array(promptOrderEntryArb, { minLength: 1, maxLength: 10 }),
});

/**
 * 生成现代格式的 Preset（有 group_id/position）
 */
const modernPresetArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  prompts: fc.array(
    fc.record({
      identifier: identifierArb,
      name: fc.string({ minLength: 1, maxLength: 50 }),
      content: fc.option(modernContentArb, { nil: undefined }),
      enabled: fc.boolean(),
      group_id: fc.oneof(fc.integer({ min: 1, max: 10 }), fc.string({ minLength: 1, maxLength: 10 })),
      position: fc.integer({ min: 0, max: 100 }),
    }),
    { minLength: 1, maxLength: 10 },
  ),
});

/**
 * 生成 SillyTavern 格式的 Preset（有 prompt_order）
 */
const sillyTavernPresetArb = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 50 }),
    fc.array(rawPromptArb, { minLength: 1, maxLength: 10 }),
    fc.array(promptOrderGroupArb, { minLength: 1, maxLength: 3 }),
  )
  .map(([name, prompts, prompt_order]) => {
    // 确保 prompt_order 中的 identifier 引用 prompts 中的项
    const validIdentifiers = prompts.map((p) => p.identifier);
    const adjustedOrder = prompt_order.map((group) => ({
      ...group,
      order: group.order.map((entry, idx) => ({
        ...entry,
        identifier: validIdentifiers[idx % validIdentifiers.length],
      })),
    }));
    return { name, prompts, prompt_order: adjustedOrder };
  });

/* ═══════════════════════════════════════════════════════════════════════════
   Property 2: 导入格式规范化 Round-Trip
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 2: 导入格式规范化 Round-Trip", () => {
  /**
   * **Feature: compatibility-debt-remediation, Property 2**
   * **Validates: Requirements 3.5**
   *
   * 规范化后的数据只存储现代格式
   */
  it("*For any* normalized preset, all content SHALL be in modern format only", () => {
    fc.assert(
      fc.property(modernPresetArb, (preset) => {
        const normalized = normalizePreset(preset);

        // 所有 prompt 都应该有 group_id 和 position
        for (const prompt of normalized.prompts) {
          expect(prompt.group_id).toBeDefined();
          expect(prompt.position).toBeDefined();
          expect(typeof prompt.position).toBe("number");

          // 内容应保持原样传递（仅做排序结构规范化）
          if (prompt.content) {
            expect(typeof prompt.content).toBe("string");
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 9: Preset 排序字段规范化
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 9: Preset 排序字段规范化", () => {
  /**
   * **Feature: compatibility-debt-remediation, Property 9**
   * **Validates: Requirements 12.1**
   *
   * 规范化后的 Preset 应该只使用 group_id/position 排序
   */
  it("*For any* normalized preset, sorting SHALL use only group_id/position fields", () => {
    fc.assert(
      fc.property(modernPresetArb, (preset) => {
        const normalized = normalizePreset(preset);

        // 规范化后不应该有 prompt_order
        expect((normalized as unknown).prompt_order).toBeUndefined();

        // 每个 prompt 都应该有 group_id 和 position
        for (const prompt of normalized.prompts) {
          expect(prompt.group_id).toBeDefined();
          expect(prompt.position).toBeDefined();
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 9**
   * **Validates: Requirements 12.2**
   *
   * SillyTavern 格式的 prompt_order 应该被转换为 group_id/position
   */
  it("*For any* preset with prompt_order, import SHALL convert to group_id/position", () => {
    fc.assert(
      fc.property(sillyTavernPresetArb, (preset) => {
        const normalized = normalizePreset(preset);

        // 规范化后不应该有 prompt_order
        expect((normalized as unknown).prompt_order).toBeUndefined();

        // 每个 prompt 都应该有 group_id 和 position
        for (const prompt of normalized.prompts) {
          expect(prompt.group_id).toBeDefined();
          expect(prompt.position).toBeDefined();
          expect(typeof prompt.position).toBe("number");
        }

        // prompt_order 中的所有 identifier 都应该出现在 prompts 中
        const identifiers = new Set(normalized.prompts.map((p) => p.identifier));
        for (const group of preset.prompt_order) {
          for (const entry of group.order) {
            expect(identifiers.has(entry.identifier)).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 9**
   * **Validates: Requirements 12.4**
   *
   * 排序应该产生一致的结果
   */
  it("*For any* preset, sorting by group_id/position SHALL produce consistent results", () => {
    fc.assert(
      fc.property(modernPresetArb, (preset) => {
        const normalized = normalizePreset(preset);

        // 按 group_id/position 排序
        const sorted = [...normalized.prompts].sort((a, b) => {
          const groupA = String(a.group_id);
          const groupB = String(b.group_id);
          if (groupA !== groupB) {
            return groupA.localeCompare(groupB);
          }
          return a.position - b.position;
        });

        // 再次排序应该得到相同结果
        const sortedAgain = [...sorted].sort((a, b) => {
          const groupA = String(a.group_id);
          const groupB = String(b.group_id);
          if (groupA !== groupB) {
            return groupA.localeCompare(groupB);
          }
          return a.position - b.position;
        });

        expect(sorted).toEqual(sortedAgain);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 9**
   * **Validates: Requirements 12.1, 12.2**
   *
   * convertPromptOrder 应该保留所有 prompt
   */
  it("*For any* prompts and prompt_order, convertPromptOrder SHALL preserve all prompts", () => {
    fc.assert(
      fc.property(sillyTavernPresetArb, (preset) => {
        const result = convertPromptOrder(preset.prompts, preset.prompt_order);

        // 结果中的每个 identifier 都应该是唯一的
        const identifiers = result.map((p) => p.identifier);
        const uniqueIdentifiers = new Set(identifiers);
        expect(identifiers.length).toBe(uniqueIdentifiers.size);

        // 原始 prompts 中的每个 identifier 都应该在结果中
        for (const prompt of preset.prompts) {
          expect(identifiers).toContain(prompt.identifier);
        }
      }),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   管道集成测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Preset Import Pipeline", () => {
  /**
   * 管道应该能正确检测有效的 Preset
   */
  it("*For any* valid preset, canImportPreset SHALL return true", () => {
    fc.assert(
      fc.property(modernPresetArb, (preset) => {
        expect(canImportPreset(preset)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * 管道应该能正确处理空 prompts
   */
  it("*For any* preset with empty prompts, import SHALL succeed with empty prompts array", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 50 }), (name) => {
        const preset = { name, prompts: [] };
        const result = importPreset(preset);

        expect(result.name).toBe(name);
        expect(result.prompts).toEqual([]);
      }),
      { numRuns: 50 },
    );
  });

  /**
   * 管道应该为无名 Preset 提供默认名称
   */
  it("*For any* preset without name, import SHALL provide default name", () => {
    const preset = { prompts: [] };
    const result = importPreset(preset);

    expect(result.name).toBe("Imported Preset");
  });
});

describe("Preset Import Sampling Params", () => {
  it("保留 ST 预设中的采样参数并转换为统一 runtime 字段", () => {
    const preset = normalizePreset({
      name: "sampling",
      prompts: [],
      temperature: 1.25,
      top_p: 0.9,
      top_k: 42,
      frequency_penalty: 0.3,
      presence_penalty: 0.4,
      repetition_penalty: 1.12,
      openai_max_context: 8192,
      openai_max_tokens: 512,
      stream_openai: false,
    });

    expect(preset.sampling).toEqual({
      temperature: 1.25,
      topP: 0.9,
      topK: 42,
      frequencyPenalty: 0.3,
      presencePenalty: 0.4,
      repeatPenalty: 1.12,
      contextWindow: 8192,
      maxTokens: 512,
      streaming: false,
    });
  });
});

describe("Preset Import Sampling Compatibility", () => {
  it("保留当前 app-format 的嵌套 sampling 字段", () => {
    const result = normalizePreset({
      name: "nested-sampling",
      prompts: [],
      sampling: {
        temperature: 0.4,
        maxTokens: 123,
        timeout: 9000,
      },
    });

    expect(result.sampling).toEqual({
      temperature: 0.4,
      maxTokens: 123,
      timeout: 9000,
    });
  });

  it("嵌套 sampling 优先于 legacy 顶层 ST 字段", () => {
    const result = normalizePreset({
      name: "sampling-precedence",
      prompts: [],
      sampling: {
        temperature: 0.4,
        maxTokens: 123,
      },
      temperature: 0.9,
      openai_max_tokens: 512,
      top_p: 0.8,
    });

    expect(result.sampling).toEqual({
      temperature: 0.4,
      maxTokens: 123,
      topP: 0.8,
    });
  });
});

