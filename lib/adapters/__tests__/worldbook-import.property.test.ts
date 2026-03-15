/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              WorldBook Import Property Tests                              ║
 * ║                                                                           ║
 * ║  **Feature: compatibility-debt-remediation**                              ║
 * ║  **Property 2: 导入格式规范化 Round-Trip (WorldBook 部分)**               ║
 * ║  **Validates: Requirements 3.3, 3.4, 3.5**                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  importWorldBookEntries,
  canImportWorldBook,
  normalizeWorldBookEntry,
  hasLegacyFields,
  type NormalizedWorldBookEntry,
} from "../import/worldbook-import";

/* ═══════════════════════════════════════════════════════════════════════════
   生成器定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成有效的关键词
 */
const keywordArb = fc.string({ minLength: 1, maxLength: 20 });

/**
 * 生成关键词数组
 */
const keywordsArb = fc.array(keywordArb, { minLength: 1, maxLength: 5 });

/**
 * 生成 WorldBook 内容
 */
const contentArb = fc.string({ minLength: 0, maxLength: 200 });

/**
 * 生成使用旧格式字段的条目
 */
const legacyEntryArb = fc.record({
  key: keywordsArb,
  keysecondary: fc.option(keywordsArb, { nil: undefined }),
  content: contentArb,
  disable: fc.option(fc.boolean(), { nil: undefined }),
  order: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  position: fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }),
  depth: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
  selective: fc.option(fc.boolean(), { nil: undefined }),
  constant: fc.option(fc.boolean(), { nil: undefined }),
});

/**
 * 生成使用新格式字段的条目
 */
const modernEntryArb = fc.record({
  keys: keywordsArb,
  secondary_keys: fc.option(keywordsArb, { nil: undefined }),
  content: contentArb,
  enabled: fc.option(fc.boolean(), { nil: undefined }),
  insertion_order: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  position: fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }),
  depth: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
  selective: fc.option(fc.boolean(), { nil: undefined }),
  constant: fc.option(fc.boolean(), { nil: undefined }),
});

/**
 * 生成 SillyTavern entries 对象格式
 */
const entriesWrapperArb = fc
  .array(legacyEntryArb, { minLength: 1, maxLength: 5 })
  .map((entries) => ({
    entries: Object.fromEntries(entries.map((e, i) => [String(i), e])),
  }));

/**
 * 生成数组格式
 */
const arrayFormatArb = fc.array(modernEntryArb, { minLength: 1, maxLength: 5 });

/**
 * 生成 worldBook 包装格式
 */
const worldBookWrapperArb = fc
  .array(modernEntryArb, { minLength: 1, maxLength: 5 })
  .map((entries) => ({ worldBook: entries }));

/* ═══════════════════════════════════════════════════════════════════════════
   属性测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 2: WorldBook 导入格式规范化", () => {
  /**
   * **Feature: compatibility-debt-remediation, Property 2**
   * **Validates: Requirements 3.3**
   *
   * 旧字段名应该被转换为新字段名
   */
  it("*For any* entry with legacy field names, normalization SHALL convert them to modern names", () => {
    fc.assert(
      fc.property(legacyEntryArb, (entry) => {
        const result = normalizeWorldBookEntry(entry);

        // 结果应该使用新格式字段名
        expect(result).toHaveProperty("keys");
        expect(result).toHaveProperty("secondary_keys");
        expect(result).toHaveProperty("enabled");
        expect(result).toHaveProperty("insertion_order");

        // 不应该有旧格式字段名
        expect(result).not.toHaveProperty("key");
        expect(result).not.toHaveProperty("keysecondary");
        expect(result).not.toHaveProperty("disable");
        expect(result).not.toHaveProperty("order");

        // 值应该被正确转换
        expect(result.keys).toEqual(entry.key.filter((k) => k.trim() !== ""));
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 2**
   * **Validates: Requirements 3.3**
   *
   * disable 字段应该被正确转换为 enabled
   */
  it("*For any* entry with disable field, normalization SHALL convert it to enabled (inverted)", () => {
    fc.assert(
      fc.property(
        fc.record({
          key: keywordsArb,
          content: contentArb,
          disable: fc.boolean(),
        }),
        (entry) => {
          const result = normalizeWorldBookEntry(entry);

          // enabled 应该是 disable 的反值
          expect(result.enabled).toBe(!entry.disable);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 2**
   * **Validates: Requirements 3.3**
   *
   * order 字段应该被转换为 insertion_order
   */
  it("*For any* entry with order field, normalization SHALL convert it to insertion_order", () => {
    fc.assert(
      fc.property(
        fc.record({
          key: keywordsArb,
          content: contentArb,
          order: fc.integer({ min: 0, max: 100 }),
        }),
        (entry) => {
          const result = normalizeWorldBookEntry(entry);

          // insertion_order 应该等于 order
          expect(result.insertion_order).toBe(entry.order);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 2**
   * **Validates: Requirements 3.3**
   *
   * 新格式字段应该优先于旧格式字段
   */
  it("*For any* entry with both legacy and modern fields, modern fields SHALL take precedence", () => {
    fc.assert(
      fc.property(
        fc.record({
          key: keywordsArb,
          keys: keywordsArb,
          keysecondary: keywordsArb,
          secondary_keys: keywordsArb,
          content: contentArb,
          disable: fc.boolean(),
          enabled: fc.boolean(),
          order: fc.integer({ min: 0, max: 100 }),
          insertion_order: fc.integer({ min: 0, max: 100 }),
        }),
        (entry) => {
          const result = normalizeWorldBookEntry(entry);

          // 新格式字段应该优先
          expect(result.keys).toEqual(entry.keys.filter((k) => k.trim() !== ""));
          expect(result.secondary_keys).toEqual(entry.secondary_keys.filter((k) => k.trim() !== ""));
          expect(result.enabled).toBe(entry.enabled);
          expect(result.insertion_order).toBe(entry.insertion_order);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("WorldBook Import Pipeline", () => {
  /**
   * entries 对象格式应该被正确处理
   */
  it("*For any* entries wrapper format, pipeline SHALL normalize all entries", () => {
    fc.assert(
      fc.property(entriesWrapperArb, (input) => {
        const result = importWorldBookEntries(input);

        // 结果应该是数组
        expect(Array.isArray(result)).toBe(true);

        // 每个条目都应该有规范化的字段
        for (const entry of result) {
          expect(entry).toHaveProperty("keys");
          expect(entry).toHaveProperty("secondary_keys");
          expect(entry).toHaveProperty("enabled");
          expect(Array.isArray(entry.keys)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * 数组格式应该被正确处理
   */
  it("*For any* array format, pipeline SHALL normalize all entries", () => {
    fc.assert(
      fc.property(arrayFormatArb, (input) => {
        const result = importWorldBookEntries(input);

        expect(Array.isArray(result)).toBe(true);

        for (const entry of result) {
          expect(entry).toHaveProperty("keys");
          expect(entry).toHaveProperty("enabled");
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * worldBook 包装格式应该被正确处理
   */
  it("*For any* worldBook wrapper format, pipeline SHALL normalize all entries", () => {
    fc.assert(
      fc.property(worldBookWrapperArb, (input) => {
        const result = importWorldBookEntries(input);

        expect(Array.isArray(result)).toBe(true);

        for (const entry of result) {
          expect(entry).toHaveProperty("keys");
          expect(entry).toHaveProperty("enabled");
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * canImportWorldBook 应该正确检测格式
   */
  it("*For any* valid WorldBook format, canImportWorldBook SHALL return true", () => {
    fc.assert(
      fc.property(
        fc.oneof(entriesWrapperArb, arrayFormatArb, worldBookWrapperArb),
        (input) => {
          expect(canImportWorldBook(input)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * hasLegacyFields 应该正确检测旧格式字段
   */
  it("*For any* entry with legacy fields, hasLegacyFields SHALL return true", () => {
    fc.assert(
      fc.property(legacyEntryArb, (entry) => {
        // legacyEntryArb 总是有 key 字段
        expect(hasLegacyFields(entry)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * hasLegacyFields 应该为纯现代格式返回 false
   */
  it("*For any* entry with only modern fields, hasLegacyFields SHALL return false", () => {
    fc.assert(
      fc.property(modernEntryArb, (entry) => {
        expect(hasLegacyFields(entry)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

describe("WorldBook Entry Validation", () => {
  /**
   * 空条目应该被过滤
   */
  it("*For any* empty entry (no content and no keys), import SHALL filter it out", () => {
    const emptyEntries = [
      { content: "", keys: [] },
      { content: "   ", keys: [] },
      { content: "", key: [] },
    ];

    for (const entry of emptyEntries) {
      const result = importWorldBookEntries([entry]);
      expect(result.length).toBe(0);
    }
  });

  /**
   * 有内容的条目应该被保留
   */
  it("*For any* entry with non-whitespace content, import SHALL preserve it", () => {
    fc.assert(
      fc.property(
        fc.record({
          // 确保至少有一个非空白字符
          content: fc.stringMatching(/^[^\s].*$/),
          keys: fc.constant([]),
        }),
        (entry) => {
          const result = importWorldBookEntries([entry]);
          expect(result.length).toBe(1);
          expect(result[0].content).toBe(entry.content);
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * 有关键词的条目应该被保留
   */
  it("*For any* entry with keys, import SHALL preserve it", () => {
    fc.assert(
      fc.property(
        fc.record({
          content: fc.constant(""),
          keys: fc.array(
            fc.stringMatching(/.*\S.*/),
            { minLength: 1, maxLength: 5 },
          ),
        }),
        (entry) => {
          const result = importWorldBookEntries([entry]);
          expect(result.length).toBe(1);
          expect(result[0].keys.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 50 },
    );
  });
});
