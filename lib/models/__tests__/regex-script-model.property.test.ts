/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              Regex Script Model Property Tests                            ║
 * ║                                                                           ║
 * ║  **Feature: regex-sillytavern-compat, Property 13: 向后兼容数据迁移**      ║
 * ║  **Validates: Requirements 10.1, 10.2, 10.3, 10.4**                       ║
 * ║                                                                           ║
 * ║  验证数据规范化的核心不变量：                                                ║
 * ║  *For any* existing RegexScript in old format (missing new fields,        ║
 * ║  numeric substituteRegex, single-number placement), loading and           ║
 * ║  normalizing it should:                                                   ║
 * ║  - Apply sensible defaults for missing fields                            ║
 * ║  - Convert numeric substituteRegex (0→NONE, 1→RAW)                       ║
 * ║  - Convert single-number placement to array format                       ║
 * ║  - Preserve all existing field values                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  normalizeRegexScript,
  RegexScript,
  SubstituteRegexMode,
  RegexPlacement,
  ScriptSource,
} from "../regex-script-model";

/* ═══════════════════════════════════════════════════════════════════════════
   生成器定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成安全的字符串（用于脚本名称、键等）
 */
const safeStringArb = fc.stringMatching(/^[a-zA-Z0-9_-]+$/)
  .filter(s => s.length > 0 && s.length <= 50);

/**
 * 生成正则表达式字符串
 */
const regexPatternArb = fc.oneof(
  fc.constant("\\d+"),
  fc.constant("[a-z]+"),
  fc.constant("{{user}}"),
  fc.constant("{{char}}"),
  safeStringArb,
);

/**
 * 生成旧格式的 RegexScript（可能缺少新字段）
 */
const oldFormatScriptArb = fc.record({
  scriptKey: safeStringArb,
  scriptName: safeStringArb,
  findRegex: regexPatternArb,
  replaceString: fc.option(fc.string(), { nil: null }),
  trimStrings: fc.option(fc.array(fc.string()), { nil: undefined }),
  placement: fc.oneof(
    // 旧格式：单个数字
    fc.integer({ min: 1, max: 6 }),
    // 新格式：数组
    fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 3 }),
  ),
  disabled: fc.option(fc.boolean(), { nil: undefined }),
  // substituteRegex 可能是 number 或 undefined
  substituteRegex: fc.option(
    fc.oneof(
      fc.constant(0),
      fc.constant(1),
      fc.constant(2),
    ),
    { nil: undefined },
  ),
  markdownOnly: fc.option(fc.boolean(), { nil: undefined }),
  promptOnly: fc.option(fc.boolean(), { nil: undefined }),
  runOnEdit: fc.option(fc.boolean(), { nil: undefined }),
  minDepth: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  maxDepth: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
});

/* ═══════════════════════════════════════════════════════════════════════════
   属性测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 13: 向后兼容数据迁移", () => {
  /**
   * **Feature: regex-sillytavern-compat, Property 13: 向后兼容数据迁移**
   * **Validates: Requirements 10.1**
   * 
   * 缺失字段应该被填充为合理的默认值
   */
  it("*For any* script with missing fields, normalization SHALL apply sensible defaults", () => {
    fc.assert(
      fc.property(oldFormatScriptArb, (script) => {
        const normalized = normalizeRegexScript(script);
        
        // 基础字段应该保留
        expect(normalized.scriptKey).toBe(script.scriptKey);
        expect(normalized.scriptName).toBe(script.scriptName);
        expect(normalized.findRegex).toBe(script.findRegex);
        
        // 缺失的字段应该有默认值
        expect(Array.isArray(normalized.trimStrings)).toBe(true);
        expect(Array.isArray(normalized.placement)).toBe(true);
        expect(typeof normalized.disabled).toBe("boolean");
        expect(typeof normalized.markdownOnly).toBe("boolean");
        expect(typeof normalized.promptOnly).toBe("boolean");
        expect(typeof normalized.runOnEdit).toBe("boolean");
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 13: 向后兼容数据迁移**
   * **Validates: Requirements 10.2**
   * 
   * 数字类型的 substituteRegex 应该被转换为枚举
   */
  it("*For any* script with numeric substituteRegex, normalization SHALL convert to enum (0→NONE, 1→RAW)", () => {
    fc.assert(
      fc.property(
        safeStringArb,
        safeStringArb,
        regexPatternArb,
        fc.integer({ min: 1, max: 6 }),
        fc.oneof(fc.constant(0), fc.constant(1), fc.constant(2)),
        (scriptKey, scriptName, findRegex, placement, numericSubstitute) => {
          const script = {
            scriptKey,
            scriptName,
            findRegex,
            placement,
            trimStrings: [],
            substituteRegex: numericSubstitute,
          };
          
          const normalized = normalizeRegexScript(script);
          
          // 验证转换逻辑
          if (numericSubstitute === 0) {
            expect(normalized.substituteRegex).toBe(SubstituteRegexMode.NONE);
          } else if (numericSubstitute === 1) {
            expect(normalized.substituteRegex).toBe(SubstituteRegexMode.RAW);
          } else {
            // 其他数字应该默认为 NONE
            expect(normalized.substituteRegex).toBe(SubstituteRegexMode.NONE);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 13: 向后兼容数据迁移**
   * **Validates: Requirements 10.3**
   * 
   * 单数字 placement 应该被转换为数组格式
   */
  it("*For any* script with single-number placement, normalization SHALL convert to array format", () => {
    fc.assert(
      fc.property(
        safeStringArb,
        safeStringArb,
        regexPatternArb,
        fc.integer({ min: 1, max: 6 }),
        (scriptKey, scriptName, findRegex, singlePlacement) => {
          const script = {
            scriptKey,
            scriptName,
            findRegex,
            placement: singlePlacement,
            trimStrings: [],
          };
          
          const normalized = normalizeRegexScript(script);
          
          // placement 应该是数组
          expect(Array.isArray(normalized.placement)).toBe(true);
          expect(normalized.placement).toHaveLength(1);
          expect(normalized.placement[0]).toBe(singlePlacement);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 13: 向后兼容数据迁移**
   * **Validates: Requirements 10.3**
   * 
   * 数组格式的 placement 应该保持不变
   */
  it("*For any* script with array placement, normalization SHALL preserve the array", () => {
    fc.assert(
      fc.property(
        safeStringArb,
        safeStringArb,
        regexPatternArb,
        fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 3 }),
        (scriptKey, scriptName, findRegex, arrayPlacement) => {
          const script = {
            scriptKey,
            scriptName,
            findRegex,
            placement: arrayPlacement,
            trimStrings: [],
          };
          
          const normalized = normalizeRegexScript(script);
          
          // placement 应该保持为数组且内容相同
          expect(Array.isArray(normalized.placement)).toBe(true);
          expect(normalized.placement).toEqual(arrayPlacement);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 13: 向后兼容数据迁移**
   * **Validates: Requirements 10.4**
   * 
   * 现有字段的值应该被完整保留
   */
  it("*For any* script with existing field values, normalization SHALL preserve all values", () => {
    fc.assert(
      fc.property(oldFormatScriptArb, (script) => {
        const normalized = normalizeRegexScript(script);
        
        // 基础字段必须保留
        expect(normalized.scriptKey).toBe(script.scriptKey);
        expect(normalized.scriptName).toBe(script.scriptName);
        expect(normalized.findRegex).toBe(script.findRegex);
        
        // 如果原始脚本有 replaceString，应该保留
        if (script.replaceString !== undefined) {
          expect(normalized.replaceString).toBe(script.replaceString);
        }
        
        // 如果原始脚本有 trimStrings，应该保留
        if (script.trimStrings !== undefined) {
          expect(normalized.trimStrings).toEqual(script.trimStrings);
        }
        
        // 如果原始脚本有 disabled，应该保留
        if (script.disabled !== undefined) {
          expect(normalized.disabled).toBe(script.disabled);
        }
        
        // 如果原始脚本有 markdownOnly，应该保留
        if (script.markdownOnly !== undefined) {
          expect(normalized.markdownOnly).toBe(script.markdownOnly);
        }
        
        // 如果原始脚本有 promptOnly，应该保留
        if (script.promptOnly !== undefined) {
          expect(normalized.promptOnly).toBe(script.promptOnly);
        }
        
        // 如果原始脚本有 runOnEdit，应该保留
        if (script.runOnEdit !== undefined) {
          expect(normalized.runOnEdit).toBe(script.runOnEdit);
        }
        
        // 如果原始脚本有 minDepth，应该保留
        if (script.minDepth !== undefined) {
          expect(normalized.minDepth).toBe(script.minDepth);
        }
        
        // 如果原始脚本有 maxDepth，应该保留
        if (script.maxDepth !== undefined) {
          expect(normalized.maxDepth).toBe(script.maxDepth);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 13: 向后兼容数据迁移**
   * **Validates: Requirements 10.1**
   * 
   * 完全缺失 placement 字段时应该使用默认值
   */
  it("*For any* script without placement field, normalization SHALL use default AI_OUTPUT", () => {
    fc.assert(
      fc.property(
        safeStringArb,
        safeStringArb,
        regexPatternArb,
        (scriptKey, scriptName, findRegex) => {
          const script = {
            scriptKey,
            scriptName,
            findRegex,
            trimStrings: [],
            // 故意不提供 placement
          };
          
          const normalized = normalizeRegexScript(script);
          
          // 应该使用默认值 AI_OUTPUT
          expect(Array.isArray(normalized.placement)).toBe(true);
          expect(normalized.placement).toHaveLength(1);
          expect(normalized.placement[0]).toBe(RegexPlacement.AI_OUTPUT);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 13: 向后兼容数据迁移**
   * **Validates: Requirements 10.1**
   * 
   * 完全缺失 substituteRegex 字段时应该使用默认值 NONE
   */
  it("*For any* script without substituteRegex field, normalization SHALL use default NONE", () => {
    fc.assert(
      fc.property(
        safeStringArb,
        safeStringArb,
        regexPatternArb,
        fc.integer({ min: 1, max: 6 }),
        (scriptKey, scriptName, findRegex, placement) => {
          const script = {
            scriptKey,
            scriptName,
            findRegex,
            placement,
            trimStrings: [],
            // 故意不提供 substituteRegex
          };
          
          const normalized = normalizeRegexScript(script);
          
          // 应该使用默认值 NONE
          expect(normalized.substituteRegex).toBe(SubstituteRegexMode.NONE);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 13: 向后兼容数据迁移**
   * **Validates: Requirements 10.4**
   * 
   * 规范化应该是幂等的（多次规范化结果相同）
   */
  it("*For any* script, normalizing twice SHALL produce the same result as normalizing once", () => {
    fc.assert(
      fc.property(oldFormatScriptArb, (script) => {
        const normalized1 = normalizeRegexScript(script);
        const normalized2 = normalizeRegexScript(normalized1);
        
        // 两次规范化的结果应该完全相同
        expect(normalized2).toEqual(normalized1);
      }),
      { numRuns: 100 },
    );
  });
});
