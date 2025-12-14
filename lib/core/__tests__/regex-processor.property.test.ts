/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              RegexProcessor Property Tests                                ║
 * ║                                                                           ║
 * ║  验证 RegexProcessor 的核心不变量：                                         ║
 * ║  - Property 5: Placement 过滤准确性                                        ║
 * ║  - Property 11: 标志位条件应用                                             ║
 * ║  - Property 12: 深度约束过滤                                               ║
 * ║                                                                           ║
 * ║  设计理念：                                                                 ║
 * ║  - 直接测试过滤函数，不依赖存储层                                            ║
 * ║  - 简洁、快速、可靠                                                         ║
 * ║  - 每个测试只验证一个不变量                                                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { shouldExecuteScript, RegexPlacement, RegexProcessorOptions } from "../regex-processor";
import type { RegexScript } from "../../models/regex-script-model";
import { SubstituteRegexMode } from "../../models/regex-script-model";

/* ═══════════════════════════════════════════════════════════════════════════
   生成器定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成 Placement 枚举值
 */
const placementArb = fc.constantFrom(
  RegexPlacement.USER_INPUT,
  RegexPlacement.AI_OUTPUT,
  RegexPlacement.SLASH_COMMAND,
  RegexPlacement.WORLD_INFO,
  RegexPlacement.REASONING,
);

/**
 * 生成 Placement 数组（支持多 placement）
 */
const placementArrayArb = fc.array(placementArb, { minLength: 1, maxLength: 3 })
  .map(arr => Array.from(new Set(arr))); // 去重

/**
 * 生成基础脚本
 */
const baseScriptArb = fc.record({
  scriptKey: fc.string({ minLength: 1, maxLength: 20 }),
  scriptName: fc.string({ minLength: 1, maxLength: 20 }),
  findRegex: fc.constant("test"),
  replaceString: fc.constant("replaced"),
  trimStrings: fc.constant([] as string[]),
  placement: placementArrayArb,
  disabled: fc.constant(false),
  substituteRegex: fc.constant(SubstituteRegexMode.NONE),
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 5: Placement 过滤准确性
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 5: Placement 过滤准确性", () => {
  /**
   * **Feature: regex-sillytavern-compat, Property 5: Placement 过滤准确性**
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6**
   * 
   * *For any* script with a set of placements and any processing context placement,
   * the script should be applied if and only if the context placement is in the script's placement set.
   */
  it("*For any* script placement set and context placement, script SHALL be applied iff context placement is in set", () => {
    fc.assert(
      fc.property(
        baseScriptArb,
        placementArb,
        (script, contextPlacement) => {
          const options: RegexProcessorOptions = {
            ownerId: "test",
            placement: contextPlacement,
          };
          
          const shouldExecute = shouldExecuteScript(script, options);
          const expectedResult = script.placement.includes(contextPlacement);
          
          // 脚本应该被执行当且仅当 contextPlacement 在 script.placement 中
          expect(shouldExecute).toBe(expectedResult);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 5: Placement 过滤准确性**
   * **Validates: Requirements 4.6**
   * 
   * *For any* script with multiple placements, it should pass filter for all specified placements
   */
  it("*For any* script with multiple placements, it SHALL pass filter for all specified placements", () => {
    fc.assert(
      fc.property(
        baseScriptArb,
        (script) => {
          // 测试所有 placement
          for (const placement of script.placement) {
            const options: RegexProcessorOptions = {
              ownerId: "test",
              placement,
            };
            
            const shouldExecute = shouldExecuteScript(script, options);
            
            // 脚本应该在所有指定的 placement 中通过过滤
            expect(shouldExecute).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 5: Placement 过滤准确性**
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
   * 
   * 禁用的脚本应该总是被过滤掉
   */
  it("*For any* disabled script, it SHALL always be filtered out", () => {
    fc.assert(
      fc.property(
        baseScriptArb,
        placementArb,
        (script, contextPlacement) => {
          const disabledScript: RegexScript = {
            ...script,
            disabled: true,
          };
          
          const options: RegexProcessorOptions = {
            ownerId: "test",
            placement: contextPlacement,
          };
          
          const shouldExecute = shouldExecuteScript(disabledScript, options);
          
          // 禁用的脚本应该总是被过滤掉
          expect(shouldExecute).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 11: 标志位条件应用
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 11: 标志位条件应用", () => {
  /**
   * **Feature: regex-sillytavern-compat, Property 11: 标志位条件应用**
   * **Validates: Requirements 9.2**
   * 
   * *For any* script with markdownOnly=true, it should only pass filter when isMarkdown=true
   */
  it("*For any* script with markdownOnly=true, it SHALL only pass filter when isMarkdown=true", () => {
    fc.assert(
      fc.property(
        baseScriptArb,
        fc.boolean(),
        (script, isMarkdown) => {
          const markdownScript: RegexScript = {
            ...script,
            markdownOnly: true,
          };
          
          const options: RegexProcessorOptions = {
            ownerId: "test",
            placement: script.placement[0], // 使用脚本的第一个 placement
            isMarkdown,
          };
          
          const shouldExecute = shouldExecuteScript(markdownScript, options);
          
          // markdownOnly 脚本应该只在 isMarkdown=true 时通过过滤
          expect(shouldExecute).toBe(isMarkdown);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 11: 标志位条件应用**
   * **Validates: Requirements 9.3**
   * 
   * *For any* script with promptOnly=true, it should only pass filter when isPrompt=true
   */
  it("*For any* script with promptOnly=true, it SHALL only pass filter when isPrompt=true", () => {
    fc.assert(
      fc.property(
        baseScriptArb,
        fc.boolean(),
        (script, isPrompt) => {
          const promptScript: RegexScript = {
            ...script,
            promptOnly: true,
          };
          
          const options: RegexProcessorOptions = {
            ownerId: "test",
            placement: script.placement[0],
            isPrompt,
          };
          
          const shouldExecute = shouldExecuteScript(promptScript, options);
          
          // promptOnly 脚本应该只在 isPrompt=true 时通过过滤
          expect(shouldExecute).toBe(isPrompt);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 11: 标志位条件应用**
   * **Validates: Requirements 9.2, 9.3**
   * 
   * *For any* script with both flags, it should require both conditions
   */
  it("*For any* script with both markdownOnly and promptOnly, it SHALL require both conditions", () => {
    fc.assert(
      fc.property(
        baseScriptArb,
        fc.boolean(),
        fc.boolean(),
        (script, isMarkdown, isPrompt) => {
          const bothFlagsScript: RegexScript = {
            ...script,
            markdownOnly: true,
            promptOnly: true,
          };
          
          const options: RegexProcessorOptions = {
            ownerId: "test",
            placement: script.placement[0],
            isMarkdown,
            isPrompt,
          };
          
          const shouldExecute = shouldExecuteScript(bothFlagsScript, options);
          
          // 两个标志都为 true 时，需要两个条件都满足
          expect(shouldExecute).toBe(isMarkdown && isPrompt);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 11: 标志位条件应用**
   * **Validates: Requirements 9.2, 9.3**
   * 
   * *For any* script without flags, it should pass filter regardless of context flags
   */
  it("*For any* script without flags, it SHALL pass filter regardless of context flags", () => {
    fc.assert(
      fc.property(
        baseScriptArb,
        fc.boolean(),
        fc.boolean(),
        (script, isMarkdown, isPrompt) => {
          const noFlagsScript: RegexScript = {
            ...script,
            markdownOnly: false,
            promptOnly: false,
          };
          
          const options: RegexProcessorOptions = {
            ownerId: "test",
            placement: script.placement[0],
            isMarkdown,
            isPrompt,
          };
          
          const shouldExecute = shouldExecuteScript(noFlagsScript, options);
          
          // 没有标志的脚本应该总是通过过滤（假设 placement 匹配）
          expect(shouldExecute).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 12: 深度约束过滤
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 12: 深度约束过滤", () => {
  /**
   * **Feature: regex-sillytavern-compat, Property 12: 深度约束过滤**
   * **Validates: Requirements 9.4**
   * 
   * *For any* script with minDepth and maxDepth constraints and any message depth,
   * the script should pass filter if and only if minDepth <= depth <= maxDepth
   */
  it("*For any* script with depth constraints, it SHALL pass filter iff minDepth <= depth <= maxDepth", () => {
    fc.assert(
      fc.property(
        baseScriptArb,
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (script, minDepth, maxDepth, testDepth) => {
          // 确保 minDepth <= maxDepth
          const [min, max] = minDepth <= maxDepth ? [minDepth, maxDepth] : [maxDepth, minDepth];
          
          const depthScript: RegexScript = {
            ...script,
            minDepth: min,
            maxDepth: max,
          };
          
          const options: RegexProcessorOptions = {
            ownerId: "test",
            placement: script.placement[0],
            depth: testDepth,
          };
          
          const shouldExecute = shouldExecuteScript(depthScript, options);
          const expectedResult = testDepth >= min && testDepth <= max;
          
          // 脚本应该通过过滤当且仅当 min <= testDepth <= max
          expect(shouldExecute).toBe(expectedResult);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 12: 深度约束过滤**
   * **Validates: Requirements 9.4**
   * 
   * *For any* script with only minDepth, it should pass filter for all depths >= minDepth
   */
  it("*For any* script with only minDepth, it SHALL pass filter for all depths >= minDepth", () => {
    fc.assert(
      fc.property(
        baseScriptArb,
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 100 }),
        (script, minDepth, testDepth) => {
          const minDepthScript: RegexScript = {
            ...script,
            minDepth,
            maxDepth: undefined,
          };
          
          const options: RegexProcessorOptions = {
            ownerId: "test",
            placement: script.placement[0],
            depth: testDepth,
          };
          
          const shouldExecute = shouldExecuteScript(minDepthScript, options);
          const expectedResult = testDepth >= minDepth;
          
          // 脚本应该通过过滤当且仅当 testDepth >= minDepth
          expect(shouldExecute).toBe(expectedResult);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 12: 深度约束过滤**
   * **Validates: Requirements 9.4**
   * 
   * *For any* script with only maxDepth, it should pass filter for all depths <= maxDepth
   */
  it("*For any* script with only maxDepth, it SHALL pass filter for all depths <= maxDepth", () => {
    fc.assert(
      fc.property(
        baseScriptArb,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (script, maxDepth, testDepth) => {
          const maxDepthScript: RegexScript = {
            ...script,
            minDepth: undefined,
            maxDepth,
          };
          
          const options: RegexProcessorOptions = {
            ownerId: "test",
            placement: script.placement[0],
            depth: testDepth,
          };
          
          const shouldExecute = shouldExecuteScript(maxDepthScript, options);
          const expectedResult = testDepth <= maxDepth;
          
          // 脚本应该通过过滤当且仅当 testDepth <= maxDepth
          expect(shouldExecute).toBe(expectedResult);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 12: 深度约束过滤**
   * **Validates: Requirements 9.4**
   * 
   * *For any* script without depth constraints, it should pass filter at all depths
   */
  it("*For any* script without depth constraints, it SHALL pass filter at all depths", () => {
    fc.assert(
      fc.property(
        baseScriptArb,
        fc.integer({ min: 0, max: 100 }),
        (script, testDepth) => {
          const noDepthScript: RegexScript = {
            ...script,
            minDepth: undefined,
            maxDepth: undefined,
          };
          
          const options: RegexProcessorOptions = {
            ownerId: "test",
            placement: script.placement[0],
            depth: testDepth,
          };
          
          const shouldExecute = shouldExecuteScript(noDepthScript, options);
          
          // 没有深度约束的脚本应该总是通过过滤（假设其他条件满足）
          expect(shouldExecute).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 12: 深度约束过滤**
   * **Validates: Requirements 9.4**
   * 
   * *For any* script, when depth is undefined, depth constraints should be ignored
   */
  it("*For any* script with depth constraints, when depth is undefined, constraints SHALL be ignored", () => {
    fc.assert(
      fc.property(
        baseScriptArb,
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 100 }),
        (script, minDepth, maxDepth) => {
          const [min, max] = minDepth <= maxDepth ? [minDepth, maxDepth] : [maxDepth, minDepth];
          
          const depthScript: RegexScript = {
            ...script,
            minDepth: min,
            maxDepth: max,
          };
          
          const options: RegexProcessorOptions = {
            ownerId: "test",
            placement: script.placement[0],
            depth: undefined, // 深度未定义
          };
          
          const shouldExecute = shouldExecuteScript(depthScript, options);
          
          // 当深度未定义时，深度约束应该被忽略
          expect(shouldExecute).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
