/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              TrimString Filter Property Tests                             ║
 * ║                                                                           ║
 * ║  **Feature: regex-sillytavern-compat, Property 6: TrimStrings 过滤幂等性** ║
 * ║  **Validates: Requirements 5.1, 5.2**                                     ║
 * ║                                                                           ║
 * ║  验证 TrimStrings 过滤器的核心不变量：                                      ║
 * ║  *For any* text and non-empty trimStrings array, applying the filter     ║
 * ║  function twice should produce the same result as applying it once       ║
 * ║  (idempotence).                                                          ║
 * ║                                                                           ║
 * ║  哲学思考：                                                                ║
 * ║  - 幂等性是函数式编程的美学体现：f(f(x)) = f(x)                            ║
 * ║  - 过滤是"减法"的艺术，移除噪音，保留信号                                   ║
 * ║  - 好的过滤器应该是无状态的、可组合的                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { filterString } from "../trim-string-filter";

/* ═══════════════════════════════════════════════════════════════════════════
   生成器定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成包含多种字符的文本
 */
const textArb = fc.oneof(
  fc.string(),
  fc.constant("Hello World!"),
  fc.constant("Test123Test456"),
  fc.constant("A B C D E F"),
  fc.constant("Line1\nLine2\nLine3"),
  fc.constant("Tab\tSeparated\tValues"),
  fc.constant("Special!@#$%^&*()Chars"),
  fc.constant(""),
);

/**
 * 生成字符串字面量模式
 */
const literalPatternArb = fc.oneof(
  fc.constant("World"),
  fc.constant("123"),
  fc.constant(" "),
  fc.constant("\n"),
  fc.constant("Test"),
  fc.stringMatching(/^[a-zA-Z0-9]+$/).filter(s => s.length > 0 && s.length <= 10),
);

/**
 * 生成正则表达式模式
 */
const regexPatternArb = fc.oneof(
  fc.constant("/\\d+/g"),
  fc.constant("/\\s+/g"),
  fc.constant("/[A-Z]/g"),
  fc.constant("/[a-z]/g"),
  fc.constant("/\\w+/g"),
  fc.constant("/Test/gi"),
  fc.constant("/[!@#$%^&*()]/g"),
);

/**
 * 生成混合模式数组（字面量 + 正则）
 */
const trimStringsArb = fc.oneof(
  fc.array(literalPatternArb, { minLength: 1, maxLength: 5 }),
  fc.array(regexPatternArb, { minLength: 1, maxLength: 5 }),
  fc.tuple(literalPatternArb, regexPatternArb).map(([lit, reg]) => [lit, reg]),
  fc.constant(["World", "/\\d+/g"]),
  fc.constant([" ", "\n", "\t"]),
  fc.constant(["/\\s+/g"]),
);

/* ═══════════════════════════════════════════════════════════════════════════
   属性测试 - Property 6: TrimStrings 过滤幂等性
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 6: TrimStrings 过滤幂等性", () => {
  /**
   * **Feature: regex-sillytavern-compat, Property 6: TrimStrings 过滤幂等性**
   * **Validates: Requirements 5.1, 5.2**
   * 
   * 核心幂等性：应用两次过滤应该与应用一次产生相同结果
   * 
   * 哲学含义：
   * - 过滤器是"减法"操作，移除后就不存在了
   * - 对不存在的东西再次移除，结果不变
   * - 这是幂等性的本质：f(f(x)) = f(x)
   */
  it("*For any* text and trimStrings, filtering twice SHALL produce the same result as filtering once", () => {
    fc.assert(
      fc.property(
        textArb,
        trimStringsArb,
        (text, trimStrings) => {
          const once = filterString(text, trimStrings);
          const twice = filterString(once, trimStrings);
          
          // 幂等性：第二次应用不应该改变结果
          expect(twice).toBe(once);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 6: TrimStrings 过滤幂等性**
   * **Validates: Requirements 5.1**
   * 
   * 字面量模式应该移除所有匹配的子串
   */
  it("*For any* text containing a literal pattern, filter SHALL remove all occurrences", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }).filter(s => s !== "_"),
        fc.integer({ min: 2, max: 5 }),
        (pattern, count) => {
          // 构造包含多个相同模式的文本
          const text = Array(count).fill(pattern).join("_");
          const trimStrings = [pattern];
          
          const result = filterString(text, trimStrings);
          
          // 所有模式都应该被移除
          expect(result).not.toContain(pattern);
          
          // 只剩下分隔符
          expect(result).toBe(Array(count - 1).fill("_").join(""));
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 6: TrimStrings 过滤幂等性**
   * **Validates: Requirements 5.2**
   * 
   * 正则表达式模式应该移除所有匹配项
   */
  it("*For any* text with digits, /\\d+/g pattern SHALL remove all digits", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 10 }),
        (prefix, digits) => {
          const text = prefix + digits.join("");
          const trimStrings = ["/\\d+/g"];
          
          const result = filterString(text, trimStrings);
          
          // 所有数字都应该被移除
          expect(result).not.toMatch(/\d/);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 6: TrimStrings 过滤幂等性**
   * **Validates: Requirements 5.1, 5.2**
   * 
   * 空数组应该返回原始文本
   */
  it("*For any* text, empty trimStrings array SHALL return the text unchanged", () => {
    fc.assert(
      fc.property(
        textArb,
        (text) => {
          const result = filterString(text, []);
          
          // 空数组不应该修改文本
          expect(result).toBe(text);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 6: TrimStrings 过滤幂等性**
   * **Validates: Requirements 5.1, 5.2**
   * 
   * 多个模式应该按顺序应用
   */
  it("*For any* text, multiple patterns SHALL be applied sequentially", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 20 }),
        (text) => {
          const trimStrings = ["a", "e", "i", "o", "u"];
          
          const result = filterString(text, trimStrings);
          
          // 所有元音字母都应该被移除
          expect(result).not.toMatch(/[aeiou]/);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 6: TrimStrings 过滤幂等性**
   * **Validates: Requirements 5.1, 5.2**
   * 
   * 过滤结果的长度应该小于或等于原始文本
   */
  it("*For any* text and non-empty trimStrings, result length SHALL be <= original length", () => {
    fc.assert(
      fc.property(
        textArb,
        trimStringsArb,
        (text, trimStrings) => {
          const result = filterString(text, trimStrings);
          
          // 过滤只能减少或保持长度，不能增加
          expect(result.length).toBeLessThanOrEqual(text.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 6: TrimStrings 过滤幂等性**
   * **Validates: Requirements 5.1, 5.2**
   * 
   * 过滤操作应该是确定性的
   */
  it("*For any* text and trimStrings, filter SHALL be deterministic", () => {
    fc.assert(
      fc.property(
        textArb,
        trimStringsArb,
        (text, trimStrings) => {
          const result1 = filterString(text, trimStrings);
          const result2 = filterString(text, trimStrings);
          
          // 相同输入应该产生相同输出
          expect(result1).toBe(result2);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 6: TrimStrings 过滤幂等性**
   * **Validates: Requirements 5.2**
   * 
   * 正则表达式标志应该被正确处理
   */
  it("*For any* text, case-insensitive regex SHALL match both cases", () => {
    const text = "Hello HELLO hello";
    const trimStrings = ["/hello/gi"];
    
    const result = filterString(text, trimStrings);
    
    // 所有大小写的 hello 都应该被移除
    expect(result).not.toMatch(/hello/i);
    expect(result.trim()).toBe("");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   边界情况测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Edge Cases", () => {
  /**
   * 空文本应该返回空字符串
   */
  it("empty text SHALL return empty string", () => {
    const result = filterString("", ["test"]);
    expect(result).toBe("");
  });

  /**
   * 不匹配的模式应该保持文本不变
   */
  it("non-matching patterns SHALL leave text unchanged", () => {
    const text = "Hello World";
    const trimStrings = ["xyz", "/\\d+/g"];
    
    const result = filterString(text, trimStrings);
    
    expect(result).toBe(text);
  });

  /**
   * 无效的正则表达式应该被忽略
   */
  it("invalid regex patterns SHALL be ignored", () => {
    const text = "Hello World";
    const trimStrings = ["/[/g"]; // 无效正则
    
    const result = filterString(text, trimStrings);
    
    // 无效正则应该被忽略，文本保持不变
    expect(result).toBe(text);
  });

  /**
   * 字面量模式应该支持特殊字符
   */
  it("literal patterns SHALL support special characters", () => {
    const text = "A+B*C?D";
    const trimStrings = ["+", "*", "?"];
    
    const result = filterString(text, trimStrings);
    
    expect(result).toBe("ABCD");
  });

  /**
   * 正则模式应该支持复杂表达式
   */
  it("regex patterns SHALL support complex expressions", () => {
    const text = "Email: test@example.com";
    const trimStrings = ["/[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}/gi"];
    
    const result = filterString(text, trimStrings);
    
    expect(result).toBe("Email: ");
  });

  /**
   * 连续的空格应该可以被移除
   */
  it("consecutive spaces SHALL be removed", () => {
    const text = "A    B    C";
    const trimStrings = ["/\\s+/g"];
    
    const result = filterString(text, trimStrings);
    
    expect(result).toBe("ABC");
  });

  /**
   * 换行符应该可以被移除
   */
  it("newlines SHALL be removed", () => {
    const text = "Line1\nLine2\nLine3";
    const trimStrings = ["\n"];
    
    const result = filterString(text, trimStrings);
    
    expect(result).toBe("Line1Line2Line3");
  });

  /**
   * 制表符应该可以被移除
   */
  it("tabs SHALL be removed", () => {
    const text = "A\tB\tC";
    const trimStrings = ["\t"];
    
    const result = filterString(text, trimStrings);
    
    expect(result).toBe("ABC");
  });

  /**
   * 混合字面量和正则模式应该都生效
   */
  it("mixed literal and regex patterns SHALL both apply", () => {
    const text = "Hello123World456";
    const trimStrings = ["World", "/\\d+/g"];
    
    const result = filterString(text, trimStrings);
    
    expect(result).toBe("Hello");
  });

  /**
   * 重叠的模式应该正确处理
   */
  it("overlapping patterns SHALL be handled correctly", () => {
    const text = "ABCABC";
    const trimStrings = ["AB", "BC"];
    
    const result = filterString(text, trimStrings);
    
    // 第一次移除所有 AB: "ABCABC" -> "CC"
    // 第二次移除所有 BC: "CC" -> "CC" (没有 BC)
    expect(result).toBe("CC");
  });

  /**
   * 完全匹配的模式应该返回空字符串
   */
  it("pattern matching entire text SHALL return empty string", () => {
    const text = "test";
    const trimStrings = ["test"];
    
    const result = filterString(text, trimStrings);
    
    expect(result).toBe("");
  });

  /**
   * 正则模式不带 g 标志应该自动添加
   */
  it("regex without g flag SHALL have it added automatically", () => {
    const text = "test test test";
    const trimStrings = ["/test/"]; // 没有 g 标志
    
    const result = filterString(text, trimStrings);
    
    // 应该移除所有 test（因为自动添加了 g 标志）
    expect(result.trim()).toBe("");
  });

  /**
   * 多个正则标志应该被保留
   */
  it("multiple regex flags SHALL be preserved", () => {
    const text = "Test TEST test";
    const trimStrings = ["/test/gim"];
    
    const result = filterString(text, trimStrings);
    
    // i 标志使匹配不区分大小写
    // m 标志处理多行
    // g 标志全局匹配
    expect(result.trim()).toBe("");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   组合属性测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Composition Properties", () => {
  /**
   * 过滤器应该是可组合的
   * filter(text, [a, b]) === filter(filter(text, [a]), [b])
   */
  it("*For any* text and patterns, filter SHALL be composable", () => {
    fc.assert(
      fc.property(
        textArb,
        literalPatternArb,
        literalPatternArb,
        (text, pattern1, pattern2) => {
          const combined = filterString(text, [pattern1, pattern2]);
          const sequential = filterString(
            filterString(text, [pattern1]),
            [pattern2],
          );
          
          // 组合应用和顺序应用应该产生相同结果
          expect(combined).toBe(sequential);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 过滤顺序应该影响结果（非交换性）
   */
  it("filter order MAY affect the result (non-commutative)", () => {
    const text = "ABCABC";
    
    // 先移除 AB，再移除 BC
    const result1 = filterString(text, ["AB", "BC"]);
    
    // 先移除 BC，再移除 AB
    const result2 = filterString(text, ["BC", "AB"]);
    
    // 结果可能不同（取决于模式的重叠情况）
    // result1: ABCABC -> CC (移除所有AB) -> CC (没有BC)
    // result2: ABCABC -> AA (移除所有BC) -> "" (移除所有AB，但AA中没有AB)
    // 实际上 result2: ABCABC -> AA -> AA
    expect(result1).toBe("CC");
    expect(result2).toBe("AA");
  });

  /**
   * 空模式应该是单位元
   * filter(text, []) === text
   */
  it("*For any* text, empty pattern array SHALL be identity", () => {
    fc.assert(
      fc.property(
        textArb,
        (text) => {
          const result = filterString(text, []);
          
          // 空模式数组应该是单位元
          expect(result).toBe(text);
        },
      ),
      { numRuns: 100 },
    );
  });
});

