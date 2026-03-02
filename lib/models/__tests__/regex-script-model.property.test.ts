/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              Regex Script Model Property Tests                            ║
 * ║                                                                           ║
 * ║  验证 normalizeRegexScript 在当前契约下的核心不变量：                        ║
 * ║  - 缺失字段补默认值                                                        ║
 * ║  - placement 仅接受数组，非法输入降级到默认值                              ║
 * ║  - substituteRegex 仅接受枚举值                                            ║
 * ║  - 规范化操作幂等                                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  normalizeRegexScript,
  SubstituteRegexMode,
  RegexPlacement,
  ScriptSource,
} from "../regex-script-model";

const safeStringArb = fc.stringMatching(/^[a-zA-Z0-9_-]+$/)
  .filter((s) => s.length > 0 && s.length <= 50);

const regexPatternArb = fc.oneof(
  fc.constant("\\d+"),
  fc.constant("[a-z]+"),
  fc.constant("{{user}}"),
  fc.constant("{{char}}"),
  safeStringArb,
);

const currentFormatScriptArb = fc.record({
  scriptKey: safeStringArb,
  scriptName: safeStringArb,
  findRegex: regexPatternArb,
  replaceString: fc.option(fc.string(), { nil: null }),
  trimStrings: fc.option(fc.array(fc.string()), { nil: undefined }),
  placement: fc.option(
    fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 3 }),
    { nil: undefined },
  ),
  disabled: fc.option(fc.boolean(), { nil: undefined }),
  substituteRegex: fc.option(
    fc.oneof(
      fc.constant(SubstituteRegexMode.NONE),
      fc.constant(SubstituteRegexMode.RAW),
      fc.constant(SubstituteRegexMode.ESCAPED),
    ),
    { nil: undefined },
  ),
  markdownOnly: fc.option(fc.boolean(), { nil: undefined }),
  promptOnly: fc.option(fc.boolean(), { nil: undefined }),
  runOnEdit: fc.option(fc.boolean(), { nil: undefined }),
  minDepth: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  maxDepth: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  source: fc.option(
    fc.oneof(
      fc.constant(ScriptSource.GLOBAL),
      fc.constant(ScriptSource.CHARACTER),
      fc.constant(ScriptSource.PRESET),
    ),
    { nil: undefined },
  ),
  sourceId: fc.option(fc.string(), { nil: undefined }),
});

describe("RegexScript normalization invariants", () => {
  it("*For any* script, normalization SHALL fill defaults for optional fields", () => {
    fc.assert(
      fc.property(currentFormatScriptArb, (script) => {
        const normalized = normalizeRegexScript(script);

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

  it("*For any* script with array placement, normalization SHALL preserve placement", () => {
    fc.assert(
      fc.property(
        safeStringArb,
        safeStringArb,
        regexPatternArb,
        fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 3 }),
        (scriptKey, scriptName, findRegex, arrayPlacement) => {
          const normalized = normalizeRegexScript({
            scriptKey,
            scriptName,
            findRegex,
            placement: arrayPlacement,
            trimStrings: [],
          });

          expect(normalized.placement).toEqual(arrayPlacement);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("*For any* script with invalid placement type, normalization SHALL fallback to AI_OUTPUT", () => {
    fc.assert(
      fc.property(
        safeStringArb,
        safeStringArb,
        regexPatternArb,
        fc.oneof(fc.integer({ min: 1, max: 6 }), fc.string(), fc.boolean()),
        (scriptKey, scriptName, findRegex, invalidPlacement) => {
          const normalized = normalizeRegexScript({
            scriptKey,
            scriptName,
            findRegex,
            placement: invalidPlacement,
            trimStrings: [],
          });

          expect(normalized.placement).toEqual([RegexPlacement.AI_OUTPUT]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("*For any* script with valid substituteRegex enum, normalization SHALL preserve it", () => {
    fc.assert(
      fc.property(
        safeStringArb,
        safeStringArb,
        regexPatternArb,
        fc.constantFrom(
          SubstituteRegexMode.NONE,
          SubstituteRegexMode.RAW,
          SubstituteRegexMode.ESCAPED,
        ),
        (scriptKey, scriptName, findRegex, substituteRegex) => {
          const normalized = normalizeRegexScript({
            scriptKey,
            scriptName,
            findRegex,
            placement: [RegexPlacement.AI_OUTPUT],
            trimStrings: [],
            substituteRegex,
          });

          expect(normalized.substituteRegex).toBe(substituteRegex);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("*For any* script with invalid substituteRegex, normalization SHALL fallback to NONE", () => {
    fc.assert(
      fc.property(
        safeStringArb,
        safeStringArb,
        regexPatternArb,
        fc.oneof(fc.integer({ min: 3, max: 20 }), fc.string(), fc.boolean()),
        (scriptKey, scriptName, findRegex, invalidSubstitute) => {
          const normalized = normalizeRegexScript({
            scriptKey,
            scriptName,
            findRegex,
            placement: [RegexPlacement.AI_OUTPUT],
            trimStrings: [],
            substituteRegex: invalidSubstitute,
          });

          expect(normalized.substituteRegex).toBe(SubstituteRegexMode.NONE);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("*For any* script, normalizing twice SHALL equal normalizing once", () => {
    fc.assert(
      fc.property(currentFormatScriptArb, (script) => {
        const normalized1 = normalizeRegexScript(script);
        const normalized2 = normalizeRegexScript(normalized1);
        expect(normalized2).toEqual(normalized1);
      }),
      { numRuns: 100 },
    );
  });
});
