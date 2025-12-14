/**
 * 调试 getvar 宏取值问题
 */

import { describe, it, expect } from "vitest";
import { STMacroEvaluator } from "../st-macro-evaluator";

describe("getvar 宏调试", () => {
  it("应该正确处理 setvar 和 getvar 的顺序", () => {
    const evaluator = new STMacroEvaluator();
    const env = { user: "test", char: "char" };

    // 模拟预设中的 setvar（注意：变量值是空格）
    const setvarContent = "{{setvar::output_language:: }}{{setvar::word_min:: }}{{setvar::word_max:: }}";
    const result1 = evaluator.evaluate(setvarContent, env);
    console.log("After setvar result:", JSON.stringify(result1));
    console.log("Variables after setvar:", evaluator.exportVariables());

    // 模拟预设中的 getvar
    const getvarContent = "字数不小于{{getvar::word_min}}，不大于{{getvar::word_max}}";
    const result2 = evaluator.evaluate(getvarContent, env);
    console.log("After getvar result:", JSON.stringify(result2));

    // 验证变量被正确设置
    expect(evaluator.getLocalVariable("word_min")).toBe(" ");
    expect(evaluator.getLocalVariable("word_max")).toBe(" ");

    // 验证 getvar 返回空格
    expect(result2).toBe("字数不小于 ，不大于 ");
  });

  it("应该验证变量名的精确匹配", () => {
    const evaluator = new STMacroEvaluator();
    const env = { user: "test", char: "char" };

    // 设置变量
    evaluator.evaluate("{{setvar::test_var::hello}}", env);
    console.log("Variables:", evaluator.exportVariables());

    // 获取变量
    const result = evaluator.evaluate("Value: {{getvar::test_var}}", env);
    console.log("Result:", result);

    expect(result).toBe("Value: hello");
  });

  it("应该检查 setvar 正则表达式的匹配", () => {
    const content = "{{setvar::word_min:: }}";
    const regex = /\{\{setvar::([^:}]+)::([^}]*)\}\}/gi;
    const matches = [...content.matchAll(regex)];
    
    console.log("Matches:", matches);
    console.log("Variable name:", matches[0]?.[1]);
    console.log("Variable value:", JSON.stringify(matches[0]?.[2]));

    expect(matches.length).toBe(1);
    expect(matches[0][1]).toBe("word_min");
    expect(matches[0][2]).toBe(" ");
  });

  it("应该正确处理 POV_rules 的 setvar + addvar + getvar 流程", () => {
    const evaluator = new STMacroEvaluator();
    const env = { user: "test", char: "char" };

    // 步骤1: identifier "4" - setvar 初始化为空格
    const step1 = "{{setvar::POV_rules:: }}{{trim}}";
    evaluator.evaluate(step1, env);
    console.log("Step1 - After setvar:", evaluator.exportVariables());

    // 步骤2: identifier "45" - addvar 追加内容
    const step2 = "{{addvar::POV_rules::使用第一人称视角扮演\"我\"}}{{trim}}";
    evaluator.evaluate(step2, env);
    console.log("Step2 - After addvar 45:", evaluator.exportVariables());

    // 步骤3: identifier "49" - addvar 再追加内容
    const step3 = "{{addvar::POV_rules::必须在叙述中自然的穿插内心想法}}{{trim}}";
    evaluator.evaluate(step3, env);
    console.log("Step3 - After addvar 49:", evaluator.exportVariables());

    // 步骤4: identifier "5076c354..." - getvar 获取值
    const step4 = "- {{getvar::POV_rules}}";
    const result = evaluator.evaluate(step4, env);
    console.log("Step4 - getvar result:", result);

    // 验证：POV_rules 应该是 " " + "使用第一人称..." + "必须在叙述中..."
    // 因为 addvar 对字符串会拼接
    expect(result).toContain("使用第一人称");
    expect(result).toContain("必须在叙述中");
  });

  it("应该验证 addvar 对空格初始值的行为", () => {
    const evaluator = new STMacroEvaluator();
    const env = { user: "test", char: "char" };

    // setvar 设置为空格
    evaluator.evaluate("{{setvar::test:: }}", env);
    console.log("After setvar ' ':", JSON.stringify(evaluator.getLocalVariable("test")));

    // addvar 追加字符串
    evaluator.evaluate("{{addvar::test::hello}}", env);
    console.log("After addvar 'hello':", JSON.stringify(evaluator.getLocalVariable("test")));

    // 预期：" " + "hello" = " hello"
    expect(evaluator.getLocalVariable("test")).toBe(" hello");
  });
});
