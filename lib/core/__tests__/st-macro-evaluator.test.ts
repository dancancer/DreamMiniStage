/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    ST Macro Evaluator 单元测试                             ║
 * ║                                                                            ║
 * ║  测试 SillyTavern 兼容的宏替换引擎                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach } from "vitest";
import { STMacroEvaluator } from "../st-macro-evaluator";
import type { MacroEnv } from "../st-preset-types";

describe("STMacroEvaluator", () => {
  let evaluator: STMacroEvaluator;
  let env: MacroEnv;

  beforeEach(() => {
    evaluator = new STMacroEvaluator();
    env = {
      user: "Alice",
      char: "Bob",
      description: "A friendly AI assistant",
      personality: "Helpful and kind",
      scenario: "A casual conversation",
      persona: "I am Alice",
      mesExamples: "Example dialogue here",
      wiBefore: "World info before",
      wiAfter: "World info after",
      lastMessage: "How are you?",
      lastUserMessage: "How are you?",
      lastCharMessage: "Hi there",
      lastMessageId: 2,
    };
  });

  describe("基础宏替换", () => {
    it("应该替换 {{user}} 宏", () => {
      const result = evaluator.evaluate("Hello {{user}}", env);
      expect(result).toBe("Hello Alice");
    });

    it("应该替换 {{char}} 宏", () => {
      const result = evaluator.evaluate("{{char}} says hi", env);
      expect(result).toBe("Bob says hi");
    });

    it("应该替换 {{description}} 宏", () => {
      const result = evaluator.evaluate("Desc: {{description}}", env);
      expect(result).toBe("Desc: A friendly AI assistant");
    });

    it("应该替换 {{personality}} 宏", () => {
      const result = evaluator.evaluate("Personality: {{personality}}", env);
      expect(result).toBe("Personality: Helpful and kind");
    });

    it("应该替换 {{scenario}} 宏", () => {
      const result = evaluator.evaluate("Scenario: {{scenario}}", env);
      expect(result).toBe("Scenario: A casual conversation");
    });

    it("应该同时替换多个宏", () => {
      const result = evaluator.evaluate("{{user}} talks to {{char}}", env);
      expect(result).toBe("Alice talks to Bob");
    });

    it("应该保留未知宏", () => {
      const result = evaluator.evaluate("{{unknown}} macro", env);
      expect(result).toBe("{{unknown}} macro");
    });
  });

  describe("变量宏", () => {
    it("应该设置并获取局部变量", () => {
      evaluator.evaluate("{{setvar::score::100}}", env);
      const result = evaluator.evaluate("Score: {{getvar::score}}", env);
      expect(result).toBe("Score: 100");
    });

    it("应该设置并获取全局变量", () => {
      evaluator.evaluate("{{setglobalvar::globalKey::globalValue}}", env);
      const result = evaluator.evaluate("Global: {{getglobalvar::globalKey}}", env);
      expect(result).toBe("Global: globalValue");
    });

    it("设置变量应该返回空字符串", () => {
      const result = evaluator.evaluate("{{setvar::newVar::hello}}", env);
      expect(result).toBe("");
    });

    it("未定义的变量应该返回空字符串", () => {
      const result = evaluator.evaluate("{{getvar::undefined}}", env);
      expect(result).toBe("");
    });
  });

  describe("工具宏", () => {
    it("{{trim}} 应该删除自身及周围换行符", () => {
      // SillyTavern: { regex: /(?:\r?\n)*{{trim}}(?:\r?\n)*/gi, replace: () => '' }
      const result = evaluator.evaluate("line1\n{{trim}}\nline2", env);
      // {{trim}} 删除自身和周围的换行符
      expect(result).toBe("line1line2");
    });

    it("{{newline}} 应该插入换行符", () => {
      const result = evaluator.evaluate("line1{{newline}}line2", env);
      expect(result).toBe("line1\nline2");
    });

    it("{{noop}} 应该返回空字符串", () => {
      const result = evaluator.evaluate("before{{noop}}after", env);
      expect(result).toBe("beforeafter");
    });
  });

  describe("随机宏", () => {
    it("{{random::a::b::c}} 应该返回其中一个选项", () => {
      const options = ["a", "b", "c"];
      const result = evaluator.evaluate("{{random::a::b::c}}", env);
      expect(options).toContain(result);
    });

    it("{{pick::a::b}} 应该返回其中一个选项", () => {
      const options = ["a", "b"];
      const result = evaluator.evaluate("{{pick::a::b}}", env);
      expect(options).toContain(result);
    });

    it("{{roll 6}} 应该返回 1-6 之间的数字", () => {
      const result = evaluator.evaluate("{{roll 6}}", env);
      const num = parseInt(result, 10);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(6);
    });
  });

  describe("时间宏", () => {
    it("{{time}} 应该返回时间字符串", () => {
      const result = evaluator.evaluate("{{time}}", env);
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it("{{date}} 应该返回本地化长日期格式", () => {
      // SillyTavern: moment().format('LL') -> "December 11, 2025"
      const result = evaluator.evaluate("{{date}}", env);
      expect(result.length).toBeGreaterThan(0);
      // 应该包含年份
      expect(result).toMatch(/\d{4}|20\d{2}/);
    });

    it("{{weekday}} 应该返回星期", () => {
      const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const result = evaluator.evaluate("{{weekday}}", env);
      expect(weekdays).toContain(result);
    });
  });

  describe("消息宏", () => {
    it("{{lastMessage}} 应该返回最后一条消息", () => {
      const result = evaluator.evaluate("{{lastMessage}}", env);
      expect(result).toBe("How are you?");
    });

    it("{{lastUserMessage}} 应该返回最后一条用户消息", () => {
      const result = evaluator.evaluate("{{lastUserMessage}}", env);
      expect(result).toBe("How are you?");
    });

    it("{{lastCharMessage}} 应该返回最后一条角色消息", () => {
      const result = evaluator.evaluate("{{lastCharMessage}}", env);
      expect(result).toBe("Hi there");
    });

    it("{{lastMessageId}} 应该返回最后消息的索引", () => {
      const result = evaluator.evaluate("{{lastMessageId}}", env);
      expect(result).toBe("2");
    });
  });

  describe("自定义宏注册", () => {
    it("应该能注册和使用自定义宏", () => {
      evaluator.registerMacro("custom", () => "custom value");
      const result = evaluator.evaluate("{{custom}}", env);
      expect(result).toBe("custom value");
    });

    it("自定义宏应该能访问环境", () => {
      evaluator.registerMacro("greeting", (_, e) => `Hello ${e.user}`);
      const result = evaluator.evaluate("{{greeting}}", env);
      expect(result).toBe("Hello Alice");
    });

    it("自定义宏只支持简单格式 {{macroName}}", () => {
      // SillyTavern 的 registerMacro 不支持带参数的宏
      // 只支持 {{macroName}} 格式，不支持 {{macroName::arg1::arg2}}
      evaluator.registerMacro("simpleValue", () => "simple result");
      const result = evaluator.evaluate("{{simpleValue}}", env);
      expect(result).toBe("simple result");
    });
  });

  describe("边界情况", () => {
    it("空字符串应该返回空字符串", () => {
      const result = evaluator.evaluate("", env);
      expect(result).toBe("");
    });

    it("没有宏的字符串应该原样返回", () => {
      const result = evaluator.evaluate("Hello World", env);
      expect(result).toBe("Hello World");
    });

    it("不完整的宏标记应该保留", () => {
      const result = evaluator.evaluate("{{user", env);
      expect(result).toBe("{{user");
    });

    it("嵌套的宏应该从内到外处理", () => {
      evaluator.evaluate("{{setvar::key::user}}", env);
      const result = evaluator.evaluate("{{getvar::key}}", env);
      expect(result).toBe("user");
    });

    it("空环境应该安全处理", () => {
      const emptyEnv: MacroEnv = {
        user: "",
        char: "",
      };
      const result = evaluator.evaluate("{{user}} and {{char}}", emptyEnv);
      expect(result).toBe(" and ");
    });
  });

  describe("性能", () => {
    it("应该能处理大量宏替换", () => {
      const template = "{{user}} ".repeat(1000);
      const start = performance.now();
      const result = evaluator.evaluate(template, env);
      const duration = performance.now() - start;

      expect(result).toBe("Alice ".repeat(1000));
      expect(duration).toBeLessThan(100); // 应该在 100ms 内完成
    });

    it("应该能处理长字符串", () => {
      const longText = "a".repeat(10000);
      const template = `${longText}{{user}}${longText}`;
      const result = evaluator.evaluate(template, env);

      expect(result).toBe(`${longText}Alice${longText}`);
    });
  });
});
