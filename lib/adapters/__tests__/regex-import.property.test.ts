/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              Regex Import Adapter Property Tests                          ║
 * ║                                                                           ║
 * ║  **Feature: compatibility-debt-remediation, Property 5: 脚本导入格式统一** ║
 * ║  **Validates: Requirements 6.1, 6.2, 6.4**                               ║
 * ║                                                                           ║
 * ║  验证正则脚本导入的核心不变量：                                              ║
 * ║  *For any* of the four supported input formats (array, {scripts:[]},     ║
 * ║  {regexScripts:[]}, single object), the import pipeline SHALL produce    ║
 * ║  a normalized RegexScript[] array with all fields in canonical format.   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  regexImportPipeline,
  importRegexScripts,
  canImportRegexScripts,
  arrayAdapter,
  scriptsWrapperAdapter,
  regexScriptsWrapperAdapter,
  singleScriptAdapter,
} from "../import/regex-import";
import { NoAdapterMatchError } from "../import/types";
import { SubstituteRegexMode, RegexPlacement } from "@/lib/models/regex-script-model";

/* ═══════════════════════════════════════════════════════════════════════════
   生成器定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成有效的正则表达式字符串
 */
const validRegexArb = fc.oneof(
  fc.constant("\\d+"),
  fc.constant("[a-z]+"),
  fc.constant("{{user}}"),
  fc.constant("{{char}}"),
  fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
);

/**
 * 生成脚本名称
 */
const scriptNameArb = fc
  .stringMatching(/^[a-zA-Z0-9_-]+$/)
  .filter((s) => s.length > 0 && s.length <= 50);

/**
 * 生成 placement 值（可能是旧格式单数字或新格式数组）
 */
const placementArb = fc.oneof(
  fc.integer({ min: 1, max: 6 }),
  fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 3 }),
);

/**
 * 生成 substituteRegex 值（可能是数字或 undefined）
 */
const substituteRegexArb = fc.option(
  fc.oneof(fc.constant(0), fc.constant(1), fc.constant(2)),
  { nil: undefined },
);

/**
 * 生成原始脚本对象（可能包含旧格式字段）
 */
const rawScriptArb = fc.record({
  findRegex: validRegexArb,
  replaceString: fc.option(fc.string(), { nil: undefined }),
  scriptName: fc.option(scriptNameArb, { nil: undefined }),
  trimStrings: fc.option(fc.array(fc.string()), { nil: undefined }),
  placement: fc.option(placementArb, { nil: undefined }),
  disabled: fc.option(fc.boolean(), { nil: undefined }),
  substituteRegex: substituteRegexArb,
  markdownOnly: fc.option(fc.boolean(), { nil: undefined }),
  promptOnly: fc.option(fc.boolean(), { nil: undefined }),
  runOnEdit: fc.option(fc.boolean(), { nil: undefined }),
});

/**
 * 生成数组格式输入
 */
const arrayInputArb = fc.array(rawScriptArb, { minLength: 1, maxLength: 10 });

/**
 * 生成 scripts 包装格式输入
 */
const scriptsWrapperInputArb = fc.record({
  scripts: fc.array(rawScriptArb, { minLength: 1, maxLength: 10 }),
});

/**
 * 生成 regexScripts 包装格式输入
 */
const regexScriptsWrapperInputArb = fc.record({
  regexScripts: fc.array(rawScriptArb, { minLength: 1, maxLength: 10 }),
});

/**
 * 生成单对象格式输入
 */
const singleScriptInputArb = rawScriptArb;

/**
 * 生成任意有效格式输入
 */
const anyValidInputArb = fc.oneof(
  arrayInputArb,
  scriptsWrapperInputArb,
  regexScriptsWrapperInputArb,
  singleScriptInputArb,
);

/**
 * 生成无效输入
 */
const invalidInputArb = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.string(),
  fc.integer(),
  fc.boolean(),
  fc.array(fc.string()), // 字符串数组
  fc.record({ wrongField: fc.string() }),
  fc.record({ scripts: fc.string() }), // scripts 不是数组
);

/* ═══════════════════════════════════════════════════════════════════════════
   属性测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 5: 脚本导入格式统一", () => {
  /**
   * **Feature: compatibility-debt-remediation, Property 5: 脚本导入格式统一**
   * **Validates: Requirements 6.1**
   *
   * 所有四种格式都应该被正确识别和处理
   */
  it("*For any* valid input format, the pipeline SHALL produce a normalized array", () => {
    fc.assert(
      fc.property(anyValidInputArb, (input) => {
        const result = importRegexScripts(input);

        // 结果应该是数组
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);

        // 每个元素都应该是规范化的 RegexScript
        for (const script of result) {
          expect(typeof script.findRegex).toBe("string");
          expect(Array.isArray(script.placement)).toBe(true);
          expect(Array.isArray(script.trimStrings)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 5: 脚本导入格式统一**
   * **Validates: Requirements 6.2**
   *
   * 规范化后的脚本应该有统一的字段格式
   */
  it("*For any* imported script, placement SHALL be an array format", () => {
    fc.assert(
      fc.property(anyValidInputArb, (input) => {
        const result = importRegexScripts(input);

        for (const script of result) {
          // placement 应该总是数组
          expect(Array.isArray(script.placement)).toBe(true);
          expect(script.placement.length).toBeGreaterThan(0);

          // 每个元素应该是有效的数字
          for (const p of script.placement) {
            expect(typeof p).toBe("number");
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 5: 脚本导入格式统一**
   * **Validates: Requirements 6.2**
   *
   * 规范化后的脚本应该有有效的 substituteRegex 枚举值
   */
  it("*For any* imported script, substituteRegex SHALL be a valid enum value", () => {
    fc.assert(
      fc.property(anyValidInputArb, (input) => {
        const result = importRegexScripts(input);

        for (const script of result) {
          // substituteRegex 应该是有效的枚举值
          const validValues = [
            SubstituteRegexMode.NONE,
            SubstituteRegexMode.RAW,
            SubstituteRegexMode.ESCAPED,
          ];
          expect(validValues).toContain(script.substituteRegex);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 5: 脚本导入格式统一**
   * **Validates: Requirements 6.4**
   *
   * 规范化后的脚本应该保留原始的 findRegex 值
   */
  it("*For any* input, the normalized scripts SHALL preserve original findRegex values", () => {
    fc.assert(
      fc.property(arrayInputArb, (input) => {
        const result = importRegexScripts(input);

        expect(result.length).toBe(input.length);

        for (let i = 0; i < input.length; i++) {
          expect(result[i].findRegex).toBe(input[i].findRegex);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 5: 脚本导入格式统一**
   * **Validates: Requirements 6.1**
   *
   * 数组格式应该被正确处理
   */
  it("*For any* array input, the pipeline SHALL process all scripts", () => {
    fc.assert(
      fc.property(arrayInputArb, (input) => {
        expect(arrayAdapter.canHandle(input)).toBe(true);
        const result = arrayAdapter.normalize(input);

        expect(result.length).toBe(input.length);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 5: 脚本导入格式统一**
   * **Validates: Requirements 6.1**
   *
   * scripts 包装格式应该被正确处理
   */
  it("*For any* scripts-wrapper input, the pipeline SHALL unwrap and process", () => {
    fc.assert(
      fc.property(scriptsWrapperInputArb, (input) => {
        expect(scriptsWrapperAdapter.canHandle(input)).toBe(true);
        const result = scriptsWrapperAdapter.normalize(input);

        expect(result.length).toBe(input.scripts.length);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 5: 脚本导入格式统一**
   * **Validates: Requirements 6.1**
   *
   * regexScripts 包装格式应该被正确处理
   */
  it("*For any* regexScripts-wrapper input, the pipeline SHALL unwrap and process", () => {
    fc.assert(
      fc.property(regexScriptsWrapperInputArb, (input) => {
        expect(regexScriptsWrapperAdapter.canHandle(input)).toBe(true);
        const result = regexScriptsWrapperAdapter.normalize(input);

        expect(result.length).toBe(input.regexScripts.length);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 5: 脚本导入格式统一**
   * **Validates: Requirements 6.1**
   *
   * 单对象格式应该被正确处理
   */
  it("*For any* single-script input, the pipeline SHALL wrap in array", () => {
    fc.assert(
      fc.property(singleScriptInputArb, (input) => {
        expect(singleScriptAdapter.canHandle(input)).toBe(true);
        const result = singleScriptAdapter.normalize(input);

        expect(result.length).toBe(1);
        expect(result[0].findRegex).toBe(input.findRegex);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 5: 脚本导入格式统一**
   * **Validates: Requirements 6.1**
   *
   * 无效输入应该抛出错误
   */
  it("*For any* invalid input, the pipeline SHALL throw NoAdapterMatchError", () => {
    fc.assert(
      fc.property(invalidInputArb, (input) => {
        expect(() => importRegexScripts(input)).toThrow(NoAdapterMatchError);
        expect(canImportRegexScripts(input)).toBe(false);
      }),
      { numRuns: 50 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 5: 脚本导入格式统一**
   * **Validates: Requirements 6.2**
   *
   * 缺失字段应该被填充默认值
   */
  it("*For any* script with missing fields, normalization SHALL fill defaults", () => {
    fc.assert(
      fc.property(validRegexArb, (findRegex) => {
        const minimalScript = { findRegex };
        const result = importRegexScripts(minimalScript);

        expect(result.length).toBe(1);
        const script = result[0];

        // 检查默认值
        expect(Array.isArray(script.trimStrings)).toBe(true);
        expect(Array.isArray(script.placement)).toBe(true);
        expect(typeof script.disabled).toBe("boolean");
        expect(typeof script.markdownOnly).toBe("boolean");
        expect(typeof script.promptOnly).toBe("boolean");
        expect(typeof script.runOnEdit).toBe("boolean");
      }),
      { numRuns: 50 },
    );
  });
});

describe("Property: canImportRegexScripts 一致性", () => {
  /**
   * canImportRegexScripts 应该与实际导入结果一致
   */
  it("*For any* input, canImportRegexScripts SHALL predict import success correctly", () => {
    fc.assert(
      fc.property(anyValidInputArb, (input) => {
        const canImport = canImportRegexScripts(input);
        expect(canImport).toBe(true);

        // 如果 canImport 为 true，实际导入不应该抛出错误
        const result = importRegexScripts(input);
        expect(result.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 },
    );
  });
});
