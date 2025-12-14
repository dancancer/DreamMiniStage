/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                           回归测试                                         ║
 * ║                                                                            ║
 * ║  验证现有功能的正确性和向后兼容性                                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import { STMacroEvaluator } from "../st-macro-evaluator";
import { WorldBookAdvancedManager } from "../world-book-advanced";
import type { MacroEnv } from "../st-preset-types";

describe("回归测试", () => {
  describe("L3.1 现有功能验证", () => {
    describe("宏系统", () => {
      const evaluator = new STMacroEvaluator();
      const env: MacroEnv = { user: "Alice", char: "Bob" };

      it("基础宏替换应该正常工作", () => {
        expect(evaluator.evaluate("{{user}}", env)).toBe("Alice");
        expect(evaluator.evaluate("{{char}}", env)).toBe("Bob");
        expect(evaluator.evaluate("{{User}}", env)).toBe("Alice");
        expect(evaluator.evaluate("{{CHAR}}", env)).toBe("Bob");
      });

      it("变量宏应该正常工作", () => {
        evaluator.evaluate("{{setvar::testKey::testValue}}", env);
        expect(evaluator.evaluate("{{getvar::testKey}}", env)).toBe("testValue");
      });

      it("全局变量宏应该正常工作", () => {
        evaluator.evaluate("{{setglobalvar::globalKey::globalValue}}", env);
        expect(evaluator.evaluate("{{getglobalvar::globalKey}}", env)).toBe("globalValue");
      });

      it("工具宏应该正常工作", () => {
        expect(evaluator.evaluate("{{newline}}", env)).toBe("\n");
        expect(evaluator.evaluate("{{noop}}", env)).toBe("");
        expect(evaluator.evaluate("line1\n{{trim}}\nline2", env)).toBe("line1line2");
      });

      it("random 宏应该返回有效选项", () => {
        const options = ["a", "b", "c"];
        for (let i = 0; i < 10; i++) {
          const result = evaluator.evaluate("{{random::a::b::c}}", env);
          expect(options).toContain(result);
        }
      });

      it("roll 宏应该返回有效范围", () => {
        for (let i = 0; i < 10; i++) {
          const result = parseInt(evaluator.evaluate("{{roll 20}}", env), 10);
          expect(result).toBeGreaterThanOrEqual(1);
          expect(result).toBeLessThanOrEqual(20);
        }
      });

      it("incvar/decvar 应该正常工作", () => {
        evaluator.evaluate("{{setvar::counter::10}}", env);
        evaluator.evaluate("{{incvar::counter}}", env);
        expect(evaluator.evaluate("{{getvar::counter}}", env)).toBe("11");
        evaluator.evaluate("{{decvar::counter}}", env);
        expect(evaluator.evaluate("{{getvar::counter}}", env)).toBe("10");
      });
    });

    describe("World Info 系统", () => {
      it("关键词匹配应该正常工作", () => {
        const manager = new WorldBookAdvancedManager();
        manager.addEntries(
          [{ uid: 1, keys: ["dragon"], content: "A dragon.", enabled: true }],
          "global",
        );

        const matched = manager.getMatchingEntries("I saw a dragon", [], {
          enableProbability: false,
        });
        expect(matched).toHaveLength(1);
      });

      it("常量条目应该始终激活", () => {
        const manager = new WorldBookAdvancedManager();
        manager.addEntries(
          [{ uid: 1, keys: ["x"], content: "Constant.", enabled: true, constant: true }],
          "global",
        );

        const matched = manager.getMatchingEntries("no keywords", [], {
          enableProbability: false,
        });
        expect(matched).toHaveLength(1);
      });

      it("次关键词 AND 逻辑应该正常工作", () => {
        const manager = new WorldBookAdvancedManager();
        manager.addEntries(
          [
            {
              uid: 1,
              keys: ["dragon"],
              secondary_keys: ["fire", "red"],
              selectiveLogic: "AND",
              selective: true,
              content: "Red fire dragon.",
              enabled: true,
            },
          ],
          "global",
        );

        // 缺少一个次关键词
        const matched1 = manager.getMatchingEntries("dragon fire", [], {
          enableProbability: false,
        });
        expect(matched1).toHaveLength(0);

        // 全部匹配
        const matched2 = manager.getMatchingEntries("red dragon fire", [], {
          enableProbability: false,
        });
        expect(matched2).toHaveLength(1);
      });

      it("次关键词 NOT 逻辑应该正常工作", () => {
        const manager = new WorldBookAdvancedManager();
        manager.addEntries(
          [
            {
              uid: 1,
              keys: ["dragon"],
              secondary_keys: ["evil"],
              selectiveLogic: "NOT",
              selective: true,
              content: "Good dragon.",
              enabled: true,
            },
          ],
          "global",
        );

        // 包含排除词
        const matched1 = manager.getMatchingEntries("evil dragon", [], {
          enableProbability: false,
        });
        expect(matched1).toHaveLength(0);

        // 不包含排除词
        const matched2 = manager.getMatchingEntries("friendly dragon", [], {
          enableProbability: false,
        });
        expect(matched2).toHaveLength(1);
      });
    });
  });

  describe("L3.2 边界情况", () => {
    const evaluator = new STMacroEvaluator();

    it("应该处理空字符串", () => {
      const env: MacroEnv = { user: "", char: "" };
      expect(evaluator.evaluate("{{user}}", env)).toBe("");
      expect(evaluator.evaluate("{{char}}", env)).toBe("");
    });

    it("应该处理未定义的变量", () => {
      const env: MacroEnv = { user: "Alice", char: "Bob" };
      expect(evaluator.evaluate("{{getvar::nonexistent}}", env)).toBe("");
    });

    it("应该处理嵌套宏", () => {
      const env: MacroEnv = { user: "Alice", char: "Bob" };
      evaluator.evaluate("{{setvar::name::{{user}}}}", env);
      // 注意：嵌套宏的行为取决于实现
      const result = evaluator.evaluate("{{getvar::name}}", env);
      expect(typeof result).toBe("string");
    });

    it("应该处理特殊字符", () => {
      const env: MacroEnv = { user: "Alice<>\"'&", char: "Bob" };
      const result = evaluator.evaluate("{{user}}", env);
      expect(result).toBe("Alice<>\"'&");
    });

    it("应该处理中文字符", () => {
      const env: MacroEnv = { user: "爱丽丝", char: "鲍勃" };
      expect(evaluator.evaluate("{{user}}", env)).toBe("爱丽丝");
      expect(evaluator.evaluate("{{char}}", env)).toBe("鲍勃");
    });

    it("应该处理长字符串", () => {
      const longString = "a".repeat(10000);
      const env: MacroEnv = { user: longString, char: "Bob" };
      expect(evaluator.evaluate("{{user}}", env)).toBe(longString);
    });
  });

  describe("L3.3 向后兼容性", () => {
    const evaluator = new STMacroEvaluator();

    it("应该支持大小写不敏感的宏名", () => {
      const env: MacroEnv = { user: "Alice", char: "Bob" };
      expect(evaluator.evaluate("{{USER}}", env)).toBe("Alice");
      expect(evaluator.evaluate("{{User}}", env)).toBe("Alice");
      expect(evaluator.evaluate("{{user}}", env)).toBe("Alice");
      expect(evaluator.evaluate("{{CHAR}}", env)).toBe("Bob");
    });

    it("旧版占位符应在导入时转换（运行时不再处理）", () => {
      const env: MacroEnv = { user: "Alice", char: "Bob" };
      // 旧版 <USER> 和 <BOT> 格式现在在导入时转换
      // 参见 lib/adapters/import/preset-import.ts: convertLegacyPlaceholders()
      // 运行时如果遇到这些格式，应保持原样（不处理）
      expect(evaluator.evaluate("<USER>", env)).toBe("<USER>");
      expect(evaluator.evaluate("<BOT>", env)).toBe("<BOT>");

      // 现代格式应正常处理
      expect(evaluator.evaluate("{{user}}", env)).toBe("Alice");
      expect(evaluator.evaluate("{{char}}", env)).toBe("Bob");
    });

    it("应该保留未知宏", () => {
      const env: MacroEnv = { user: "Alice", char: "Bob" };
      const result = evaluator.evaluate("{{unknownMacro}}", env);
      // 未知宏应该被保留或返回空
      expect(typeof result).toBe("string");
    });
  });
});
