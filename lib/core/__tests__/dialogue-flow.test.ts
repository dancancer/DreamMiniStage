/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    完整对话流程集成测试                                     ║
 * ║                                                                            ║
 * ║  测试从 Preset 加载到消息构建的完整流程                                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { STPromptManager } from "../prompt";
import { STMacroEvaluator } from "../st-macro-evaluator";
import { WorldBookAdvancedManager } from "../world-book-advanced";
import type { STCombinedPreset, STOpenAIPreset, MacroEnv } from "../st-preset-types";

describe("完整对话流程集成测试", () => {
  let presetData: STOpenAIPreset;
  let combinedPreset: STCombinedPreset;
  let manager: STPromptManager;
  let macroEvaluator: STMacroEvaluator;
  let worldBookManager: WorldBookAdvancedManager;

  beforeAll(() => {
    // 加载真实 Preset
    const filePath = join(process.cwd(), "明月秋青v3.94.json");
    const fileContent = readFileSync(filePath, "utf-8");
    presetData = JSON.parse(fileContent);

    combinedPreset = { openai: presetData };
    macroEvaluator = new STMacroEvaluator();
    manager = new STPromptManager(combinedPreset, macroEvaluator);
    worldBookManager = new WorldBookAdvancedManager();
  });

  describe("端到端流程", () => {
    it("应该能完成从 Preset 到消息的完整流程", () => {
      // 1. 准备环境变量
      const env: MacroEnv = {
        user: "玩家",
        char: "秋青子",
        description: "秋青子是一位温柔的蛇娘秘书",
        personality: "温柔、聪慧、忠诚",
        scenario: "在办公室中",
        persona: "我是一名普通上班族",
      };

      // 2. 获取排序后的 prompts
      const orderedPrompts = manager.getOrderedPrompts();
      expect(orderedPrompts.length).toBeGreaterThan(0);

      // 3. 构建消息
      const messages = manager.buildMessages(env);
      expect(Array.isArray(messages)).toBe(true);
    });

    it("应该正确处理宏替换", () => {
      const env: MacroEnv = {
        user: "测试用户",
        char: "测试角色",
      };

      // 测试基础宏
      const result1 = macroEvaluator.evaluate("Hello {{user}}, I am {{char}}", env);
      expect(result1).toBe("Hello 测试用户, I am 测试角色");

      // 测试变量宏
      const result2 = macroEvaluator.evaluate(
        "{{setvar::test::hello}}Value: {{getvar::test}}",
        env,
      );
      expect(result2).toContain("hello");

      // 测试 trim 宏
      const result3 = macroEvaluator.evaluate("line1\n{{trim}}\nline2", env);
      expect(result3).toBe("line1line2");
    });

    it("应该正确处理 World Info 匹配", () => {
      // 添加测试条目
      worldBookManager.clearEntries();
      worldBookManager.addEntries(
        [
          {
            uid: 1,
            keys: ["秋青子", "蛇娘"],
            content: "秋青子是一位温柔的蛇娘秘书。",
            enabled: true,
          },
          {
            uid: 2,
            keys: ["办公室"],
            content: "这是一间现代化的办公室。",
            enabled: true,
          },
        ],
        "character",
      );

      // 测试匹配
      const matched = worldBookManager.getMatchingEntries(
        "秋青子在办公室里工作",
        [],
        { enableProbability: false },
      );

      expect(matched.length).toBe(2);
    });
  });

  describe("Preset 与宏系统集成", () => {
    it("应该正确处理 Preset 中的 setvar/getvar", () => {
      const env: MacroEnv = { user: "Alice", char: "Bob" };

      // 模拟变量初始化 prompt 的处理
      const varInitContent =
        "{{setvar::output_language::简体中文}}{{setvar::word_min::1500}}";
      const result = macroEvaluator.evaluate(varInitContent, env);

      // setvar 返回空字符串
      expect(result).toBe("");

      // 验证变量已设置
      const getResult = macroEvaluator.evaluate("{{getvar::output_language}}", env);
      expect(getResult).toBe("简体中文");
    });

    it("应该正确处理 addvar 宏", () => {
      const env: MacroEnv = { user: "Alice", char: "Bob" };

      // 先设置初始值
      macroEvaluator.evaluate("{{setvar::counter::10}}", env);

      // 使用 addvar 增加
      macroEvaluator.evaluate("{{addvar::counter::5}}", env);

      // 验证结果
      const result = macroEvaluator.evaluate("{{getvar::counter}}", env);
      expect(result).toBe("15");
    });

    it("应该正确处理 random 宏", () => {
      const env: MacroEnv = { user: "Alice", char: "Bob" };

      const result = macroEvaluator.evaluate("{{random::a::b::c}}", env);
      expect(["a", "b", "c"]).toContain(result);
    });

    it("应该正确处理 roll 宏", () => {
      const env: MacroEnv = { user: "Alice", char: "Bob" };

      // SillyTavern 格式: {{roll X}} 返回 1 到 X 的随机数
      const result = macroEvaluator.evaluate("{{roll 6}}", env);
      const num = parseInt(result, 10);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(6);
    });
  });

  describe("消息构建验证", () => {
    it("应该生成有效的消息数组", () => {
      const env: MacroEnv = {
        user: "玩家",
        char: "秋青子",
        description: "蛇娘秘书",
        personality: "温柔",
        scenario: "办公室",
      };

      const messages = manager.buildMessages(env);

      // 验证消息格式
      for (const msg of messages) {
        expect(msg).toHaveProperty("role");
        expect(msg).toHaveProperty("content");
        expect(["system", "user", "assistant"]).toContain(msg.role);
        expect(typeof msg.content).toBe("string");
      }
    });

    it("应该包含系统消息", () => {
      const env: MacroEnv = {
        user: "玩家",
        char: "秋青子",
      };

      const messages = manager.buildMessages(env);
      const systemMessages = messages.filter((m) => m.role === "system");

      expect(systemMessages.length).toBeGreaterThan(0);
    });
  });

  describe("错误处理", () => {
    it("应该优雅处理空环境", () => {
      const env: MacroEnv = { user: "", char: "" };

      // 不应该抛出错误
      expect(() => manager.buildMessages(env)).not.toThrow();
    });

    it("应该优雅处理未定义的宏", () => {
      const env: MacroEnv = { user: "Alice", char: "Bob" };

      // 未定义的变量应该返回空字符串
      const result = macroEvaluator.evaluate("{{getvar::undefined_var}}", env);
      expect(result).toBe("");
    });

    it("应该优雅处理无效的 roll 格式", () => {
      const env: MacroEnv = { user: "Alice", char: "Bob" };

      // 无效格式应该返回原始字符串或默认值
      const result = macroEvaluator.evaluate("{{roll::invalid}}", env);
      expect(typeof result).toBe("string");
    });
  });

  describe("性能验证", () => {
    it("应该在合理时间内完成消息构建", () => {
      const env: MacroEnv = {
        user: "玩家",
        char: "秋青子",
        description: "蛇娘秘书",
        personality: "温柔",
        scenario: "办公室",
      };

      const start = performance.now();

      // 执行 100 次
      for (let i = 0; i < 100; i++) {
        manager.buildMessages(env);
      }

      const duration = performance.now() - start;

      // 100 次应该在 1 秒内完成
      expect(duration).toBeLessThan(1000);
    });

    it("应该在合理时间内完成宏替换", () => {
      const env: MacroEnv = { user: "Alice", char: "Bob" };
      const template = "Hello {{user}}, I am {{char}}. {{random::a::b::c}}";

      const start = performance.now();

      // 执行 1000 次
      for (let i = 0; i < 1000; i++) {
        macroEvaluator.evaluate(template, env);
      }

      const duration = performance.now() - start;

      // 1000 次应该在 500ms 内完成
      expect(duration).toBeLessThan(500);
    });
  });
});
