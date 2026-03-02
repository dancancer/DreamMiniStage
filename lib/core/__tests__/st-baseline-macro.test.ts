/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    宏替换系统基线测试（SillyTavern 对标）                   ║
 * ║                                                                            ║
 * ║  测试当前项目的宏替换引擎与 SillyTavern macros.js 的行为一致性。           ║
 * ║                                                                            ║
 * ║  覆盖范围：                                                                 ║
 * ║  1. 环境宏（{{user}}, {{char}}, {{description}}, etc.）                   ║
 * ║  2. 变量宏（{{setvar}}, {{getvar}}, {{incvar}}, etc.）                    ║
 * ║  3. 时间宏（{{time}}, {{date}}, {{datetimeformat}}, etc.）                ║
 * ║  4. 工具宏（{{random}}, {{pick}}, {{roll}}）                               ║
 * ║  5. 宏嵌套和边界情况                                                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { STMacroEvaluator } from "@/lib/core/st-macro-evaluator";
import type { MacroEnv } from "@/lib/core/st-preset-types";
import { setupDeterministicEnv, teardownDeterministicEnv } from "./baseline-helpers";

// ════════════════════════════════════════════════════════════════════════════
//   测试环境准备
// ════════════════════════════════════════════════════════════════════════════

describe("宏替换系统基线测试", () => {
  let evaluator: STMacroEvaluator;
  let testEnv: MacroEnv;

  beforeAll(() => {
    setupDeterministicEnv(vi);
  });

  afterAll(() => {
    teardownDeterministicEnv(vi);
  });

  beforeEach(() => {
    evaluator = new STMacroEvaluator();
    testEnv = {
      user: "用户",
      char: "角色",
      description: "角色描述",
      personality: "角色性格",
      scenario: "场景设定",
      persona: "用户人设",
      mesExamples: "对话示例",
      wiBefore: "世界书前置",
      wiAfter: "世界书后置",
      chatHistory: "聊天历史",
      userInput: "用户输入",
      lastUserMessage: "最后一条用户消息",
      number: 200,
      language: "zh",
    };
  });

  // ════════════════════════════════════════════════════════════════════════════
  //   第一组：环境宏（基础替换）
  // ════════════════════════════════════════════════════════════════════════════

  describe("环境宏替换", () => {
    it("应正确替换 {{user}} 宏", () => {
      const result = evaluator.evaluate("你好，{{user}}", testEnv);
      expect(result).toBe("你好，用户");
    });

    it("应正确替换 {{char}} 宏", () => {
      const result = evaluator.evaluate("我是{{char}}", testEnv);
      expect(result).toBe("我是角色");
    });

    it("应正确替换 {{description}} 宏", () => {
      const result = evaluator.evaluate("描述：{{description}}", testEnv);
      expect(result).toBe("描述：角色描述");
    });

    it("应正确替换 {{personality}} 宏", () => {
      const result = evaluator.evaluate("性格：{{personality}}", testEnv);
      expect(result).toBe("性格：角色性格");
    });

    it("应正确替换 {{scenario}} 宏", () => {
      const result = evaluator.evaluate("场景：{{scenario}}", testEnv);
      expect(result).toBe("场景：场景设定");
    });

    it("应正确替换 {{persona}} 宏", () => {
      const result = evaluator.evaluate("人设：{{persona}}", testEnv);
      expect(result).toBe("人设：用户人设");
    });

    it("应正确替换 {{mesExamples}} 宏", () => {
      const result = evaluator.evaluate("示例：{{mesExamples}}", testEnv);
      expect(result).toBe("示例：对话示例");
    });

    it("应正确替换 {{wiBefore}} 和 {{wiAfter}} 宏", () => {
      const result = evaluator.evaluate("{{wiBefore}} 核心 {{wiAfter}}", testEnv);
      expect(result).toBe("世界书前置 核心 世界书后置");
    });

    it("应正确替换 {{chatHistory}} 宏", () => {
      const result = evaluator.evaluate("历史：{{chatHistory}}", testEnv);
      expect(result).toBe("历史：聊天历史");
    });

    it("应在同一字符串中替换多个不同的宏", () => {
      const result = evaluator.evaluate(
        "{{user}}对{{char}}说：{{lastUserMessage}}",
        testEnv,
      );
      expect(result).toBe("用户对角色说：最后一条用户消息");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  //   第二组：变量宏（状态管理）
  // ════════════════════════════════════════════════════════════════════════════

  describe("局部变量宏", () => {
    it("应支持设置和读取局部变量", () => {
      const result = evaluator.evaluate(
        "{{setvar::name::张三}}你好，{{getvar::name}}",
        testEnv,
      );
      expect(result).toBe("你好，张三");
    });

    // ⚠️ 已知实现差异：变量操作宏需要分步执行
    // SillyTavern 行为：支持在同一次 evaluate 中混用 incvar/decvar/addvar 和 getvar
    // 当前实现：必须分开调用，否则 getvar 会在变量更新前执行
    // 原因：宏处理流水线中，变量操作宏和读取宏的执行时机问题

    it("应支持增量操作 {{incvar}}", () => {
      evaluator.evaluate("{{setvar::count::10}}", testEnv);
      evaluator.evaluate("{{incvar::count}}", testEnv);
      const result = evaluator.evaluate("当前值：{{getvar::count}}", testEnv);
      expect(result).toBe("当前值：11");

      // TODO: SillyTavern 期望支持但当前未实现的行为：
      // const result = evaluator.evaluate("{{incvar::count}}当前值：{{getvar::count}}", testEnv);
      // expect(result).toBe("当前值：11");
    });

    it("应支持递减操作 {{decvar}}", () => {
      evaluator.evaluate("{{setvar::count::10}}", testEnv);
      evaluator.evaluate("{{decvar::count}}", testEnv);
      const result = evaluator.evaluate("当前值：{{getvar::count}}", testEnv);
      expect(result).toBe("当前值：9");
    });

    it("应支持数值累加 {{addvar}}", () => {
      evaluator.evaluate("{{setvar::score::50}}", testEnv);
      evaluator.evaluate("{{addvar::score::30}}", testEnv);
      const result = evaluator.evaluate("得分：{{getvar::score}}", testEnv);
      expect(result).toBe("得分：80");
    });

    it("应支持字符串拼接 {{addvar}}", () => {
      evaluator.evaluate("{{setvar::name::张}}", testEnv);
      evaluator.evaluate("{{addvar::name::三}}", testEnv);
      const result = evaluator.evaluate("姓名：{{getvar::name}}", testEnv);
      expect(result).toBe("姓名：张三");
    });

    it("读取不存在的变量应返回空字符串", () => {
      const result = evaluator.evaluate("值：{{getvar::nonexistent}}", testEnv);
      expect(result).toBe("值：");
    });
  });

  describe("全局变量宏", () => {
    it("应支持设置和读取全局变量", () => {
      evaluator.evaluate("{{setglobalvar::appName::DreamMiniStage}}", testEnv);
      const result = evaluator.evaluate("应用：{{getglobalvar::appName}}", testEnv);
      expect(result).toBe("应用：DreamMiniStage");
    });

    it("应支持全局变量增量 {{incglobalvar}}", () => {
      evaluator.evaluate("{{setglobalvar::session::1}}", testEnv);
      evaluator.evaluate("{{incglobalvar::session}}", testEnv);
      const result = evaluator.evaluate("会话：{{getglobalvar::session}}", testEnv);
      expect(result).toBe("会话：2");
    });

    it("应支持全局变量递减 {{decglobalvar}}", () => {
      evaluator.evaluate("{{setglobalvar::count::5}}", testEnv);
      evaluator.evaluate("{{decglobalvar::count}}", testEnv);
      const result = evaluator.evaluate("计数：{{getglobalvar::count}}", testEnv);
      expect(result).toBe("计数：4");
    });

    it("全局变量应跨会话保持", () => {
      evaluator.evaluate("{{setglobalvar::persistent::42}}", testEnv);

      // 创建新的 evaluator，模拟新会话
      const newEvaluator = new STMacroEvaluator();
      const exported = evaluator.exportVariables();
      newEvaluator.importVariables(exported);

      const result = newEvaluator.evaluate(
        "值：{{getglobalvar::persistent}}",
        testEnv,
      );
      expect(result).toBe("值：42");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  //   第三组：时间宏（确定性测试）
  // ════════════════════════════════════════════════════════════════════════════

  describe("时间宏", () => {
    it("应正确替换 {{time}} 宏（固定时间）", () => {
      const result = evaluator.evaluate("当前时间：{{time}}", testEnv);
      // 由于我们固定了时间为 2024-01-01T00:00:00Z，输出格式依赖环境
      expect(result).toContain("当前时间：");
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it("应正确替换 {{date}} 宏（固定日期）", () => {
      const result = evaluator.evaluate("当前日期：{{date}}", testEnv);
      expect(result).toContain("当前日期：");
      expect(result).toMatch(/\d{4}/); // 应包含年份
    });

    it("应正确替换 {{isodate}} 宏", () => {
      const result = evaluator.evaluate("ISO 日期：{{isodate}}", testEnv);
      expect(result).toBe("ISO 日期：2024-01-01");
    });

    it("应正确替换 {{isotime}} 宏", () => {
      const result = evaluator.evaluate("ISO 时间：{{isotime}}", testEnv);
      expect(result).toMatch(/ISO 时间：\d{2}:\d{2}:\d{2}/);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  //   第四组：工具宏（随机和选择）
  // ════════════════════════════════════════════════════════════════════════════

  describe("工具宏", () => {
    it("{{random}} 应从选项中随机选择（固定随机种子）", () => {
      // Math.random() 固定为 0.25
      const result = evaluator.evaluate("{{random::A::B::C::D}}", testEnv);
      // 0.25 * 4 = 1，应选择第二个元素 "B"
      expect(result).toBe("B");
    });

    it("{{random}} 应支持空格分隔语法", () => {
      const result = evaluator.evaluate("{{random A,B,C,D}}", testEnv);
      expect(result).toBe("B"); // 固定随机数
    });

    it("{{pick}} 应根据内容哈希稳定选择", () => {
      const result1 = evaluator.evaluate("{{pick::A::B::C::D}}", testEnv);
      const result2 = evaluator.evaluate("{{pick::A::B::C::D}}", testEnv);
      // 相同输入应返回相同结果
      expect(result1).toBe(result2);
    });

    it("{{roll}} 应生成骰子结果", () => {
      // Math.random() 固定为 0.25
      const result = evaluator.evaluate("骰子：{{roll 6}}", testEnv);
      // floor(0.25 * 6) + 1 = 2
      expect(result).toBe("骰子：2");
    });

    it("{{roll}} 应支持不同的骰子面数", () => {
      const result = evaluator.evaluate("{{roll 20}}", testEnv);
      // floor(0.25 * 20) + 1 = 6
      expect(result).toBe("6");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  //   第五组：边界情况和复杂场景
  // ════════════════════════════════════════════════════════════════════════════

  describe("边界情况", () => {
    it("应处理空字符串输入", () => {
      const result = evaluator.evaluate("", testEnv);
      expect(result).toBe("");
    });

    it("应处理没有宏的普通文本", () => {
      const text = "这是一段普通文本，没有任何宏。";
      const result = evaluator.evaluate(text, testEnv);
      expect(result).toBe(text);
    });

    it("应处理未闭合的花括号", () => {
      const result = evaluator.evaluate("{{user", testEnv);
      expect(result).toBe("{{user");
    });

    it("应处理不存在的宏名", () => {
      const result = evaluator.evaluate("{{nonexistent}}", testEnv);
      expect(result).toBe("{{nonexistent}}");
    });

    it("应处理连续的宏", () => {
      const result = evaluator.evaluate("{{user}}{{char}}", testEnv);
      expect(result).toBe("用户角色");
    });

    it("应处理宏大小写不敏感", () => {
      const result1 = evaluator.evaluate("{{USER}}", testEnv);
      const result2 = evaluator.evaluate("{{User}}", testEnv);
      const result3 = evaluator.evaluate("{{user}}", testEnv);
      expect(result1).toBe("用户");
      expect(result2).toBe("用户");
      expect(result3).toBe("用户");
    });
  });

  describe("宏嵌套和组合", () => {
    it("应支持变量宏与环境宏的组合使用", () => {
      const result = evaluator.evaluate(
        "{{setvar::greeting::你好}}{{getvar::greeting}}，{{user}}",
        testEnv,
      );
      expect(result).toBe("你好，用户");
    });

    it("应支持多次读取同一变量", () => {
      evaluator.evaluate("{{setvar::name::张三}}", testEnv);
      const result = evaluator.evaluate(
        "{{getvar::name}}说：我是{{getvar::name}}",
        testEnv,
      );
      expect(result).toBe("张三说：我是张三");
    });

    it("应支持变量的链式操作", () => {
      evaluator.evaluate("{{setvar::x::1}}", testEnv);
      evaluator.evaluate("{{incvar::x}}", testEnv);
      evaluator.evaluate("{{incvar::x}}", testEnv);
      evaluator.evaluate("{{addvar::x::5}}", testEnv);
      const result = evaluator.evaluate("结果：{{getvar::x}}", testEnv);
      // 1 -> 2 -> 3 -> 8
      expect(result).toBe("结果：8");
    });

    it("应支持局部变量和全局变量同时使用", () => {
      const result = evaluator.evaluate(
        "{{setvar::local::A}}{{setglobalvar::global::B}}{{getvar::local}}-{{getglobalvar::global}}",
        testEnv,
      );
      expect(result).toBe("A-B");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  //   第六组：与 SillyTavern 的行为对齐验证
  // ════════════════════════════════════════════════════════════════════════════

  describe("SillyTavern 行为对齐", () => {
    it("变量初始化应从 undefined 开始", () => {
      // SillyTavern 的变量在首次使用前为 undefined
      const result = evaluator.evaluate("{{getvar::uninitialized}}", testEnv);
      expect(result).toBe("");
    });

    it("incvar 对 undefined 变量应视为 0", () => {
      evaluator.evaluate("{{incvar::newCounter}}", testEnv);
      const result = evaluator.evaluate("{{getvar::newCounter}}", testEnv);
      expect(result).toBe("1");
    });

    it("addvar 对数字字符串应进行数值相加", () => {
      evaluator.evaluate("{{setvar::num::10}}", testEnv);
      evaluator.evaluate("{{addvar::num::20}}", testEnv);
      const result = evaluator.evaluate("{{getvar::num}}", testEnv);
      expect(result).toBe("30");
    });

    it("addvar 对非数字应进行字符串拼接", () => {
      evaluator.evaluate("{{setvar::str::Hello}}", testEnv);
      evaluator.evaluate("{{addvar::str:: World}}", testEnv);
      const result = evaluator.evaluate("{{getvar::str}}", testEnv);
      expect(result).toBe("Hello World");
    });

    it("空白字符串不应被视为数字", () => {
      // 这是一个关键的边界情况，SillyTavern 也这样处理
      evaluator.evaluate("{{setvar::blank:: }}", testEnv);
      evaluator.evaluate("{{addvar::blank::test}}", testEnv);
      const result = evaluator.evaluate("{{getvar::blank}}", testEnv);
      expect(result).toBe(" test");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  //   第七组：变量导入导出（持久化）
  // ════════════════════════════════════════════════════════════════════════════

  describe("变量持久化", () => {
    it("应支持导出所有变量", () => {
      evaluator.evaluate("{{setvar::local::L1}}", testEnv);
      evaluator.evaluate("{{setglobalvar::global::G1}}", testEnv);

      const exported = evaluator.exportVariables();

      expect(exported.local).toEqual({ local: "L1" });
      expect(exported.global).toEqual({ global: "G1" });
    });

    it("应支持导入变量恢复状态", () => {
      const newEvaluator = new STMacroEvaluator();
      newEvaluator.importVariables({
        local: { count: 42 },
        global: { version: 1 },
      });

      const result = newEvaluator.evaluate(
        "{{getvar::count}}-{{getglobalvar::version}}",
        testEnv,
      );
      expect(result).toBe("42-1");
    });

    it("导入应覆盖现有变量", () => {
      evaluator.evaluate("{{setvar::x::old}}", testEnv);
      evaluator.importVariables({ local: { x: "new" } });

      const result = evaluator.evaluate("{{getvar::x}}", testEnv);
      expect(result).toBe("new");
    });
  });
});
