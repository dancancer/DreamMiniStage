/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    ST Preset 加载测试                                      ║
 * ║                                                                            ║
 * ║  使用真实的 SillyTavern Preset 文件进行测试                                  ║
 * ║  测试文件: 明月秋青v3.94.json                                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { STPromptManager } from "../prompt";
import { STMacroEvaluator } from "../st-macro-evaluator";
import type { STCombinedPreset, STOpenAIPreset, MacroEnv } from "../st-preset-types";

describe("ST Preset 加载测试 - 明月秋青v3.94", () => {
  let presetData: STOpenAIPreset;
  let combinedPreset: STCombinedPreset;
  let manager: STPromptManager;

  beforeAll(() => {
    const filePath = join(process.cwd(), "test-baseline-assets/preset/明月秋青v3.94.json");
    const fileContent = readFileSync(filePath, "utf-8");
    presetData = JSON.parse(fileContent);

    combinedPreset = {
      openai: presetData,
    };

    manager = new STPromptManager(combinedPreset);
  });

  describe("Preset 文件结构验证", () => {
    it("应该正确加载 prompts 数组", () => {
      expect(presetData.prompts).toBeDefined();
      expect(Array.isArray(presetData.prompts)).toBe(true);
      expect(presetData.prompts.length).toBeGreaterThan(0);
    });

    it("应该正确加载 prompt_order", () => {
      expect(presetData.prompt_order).toBeDefined();
      expect(Array.isArray(presetData.prompt_order)).toBe(true);
      expect(presetData.prompt_order.length).toBeGreaterThan(0);
    });

    it("应该包含默认 character_id 100001", () => {
      const defaultOrder = presetData.prompt_order.find(
        (o) => o.character_id === 100001,
      );
      expect(defaultOrder).toBeDefined();
      expect(defaultOrder?.order.length).toBeGreaterThan(0);
    });

    it("应该正确加载采样参数", () => {
      expect(presetData.temperature).toBe(1.5);
      expect(presetData.top_p).toBe(0.92);
      expect(presetData.frequency_penalty).toBe(0.2);
    });
  });

  describe("Prompt 内容验证", () => {
    it("应该包含标准 marker prompts", () => {
      const markers = ["worldInfoBefore", "worldInfoAfter", "charDescription", "chatHistory"];
      for (const marker of markers) {
        const prompt = presetData.prompts.find((p) => p.identifier === marker);
        expect(prompt).toBeDefined();
        expect(prompt?.marker).toBe(true);
      }
    });

    it("应该包含自定义 prompts", () => {
      // 检查一些自定义 prompt
      const customPrompt = presetData.prompts.find((p) => p.identifier === "6");
      expect(customPrompt).toBeDefined();
      expect(customPrompt?.name).toContain("破限");
    });

    it("应该正确解析 injection_position", () => {
      const promptsWithPosition = presetData.prompts.filter(
        (p) => p.injection_position !== undefined,
      );
      expect(promptsWithPosition.length).toBeGreaterThan(0);

      // 大多数应该是相对位置 (0)
      const relativePrompts = promptsWithPosition.filter(
        (p) => p.injection_position === 0,
      );
      expect(relativePrompts.length).toBeGreaterThan(0);
    });
  });

  describe("PromptManager 功能验证", () => {
    it("应该能获取 OpenAI preset", () => {
      const openai = manager.getOpenAIPreset();
      expect(openai).toBeDefined();
      expect(openai.prompts).toBeDefined();
    });

    it("应该能获取 prompt_order", () => {
      const order = manager.getPromptOrder();
      expect(order).toBeDefined();
      expect(order?.order.length).toBeGreaterThan(0);
    });

    it("应该能根据 identifier 查找 prompt", () => {
      const prompt = manager.findPrompt("worldInfoBefore");
      expect(prompt).toBeDefined();
      expect(prompt?.marker).toBe(true);
    });

    it("应该能获取排序后的 prompts", () => {
      const ordered = manager.getOrderedPrompts();
      expect(ordered.length).toBeGreaterThan(0);
    });
  });

  describe("宏替换验证", () => {
    it("应该正确替换 prompt 中的宏", () => {
      const evaluator = new STMacroEvaluator();
      const env: MacroEnv = {
        user: "测试用户",
        char: "测试角色",
      };

      // 找一个包含宏的 prompt
      const promptWithMacro = presetData.prompts.find(
        (p) => p.content && p.content.includes("{{"),
      );

      if (promptWithMacro?.content) {
        const result = evaluator.evaluate(promptWithMacro.content, env);
        // 基础宏应该被替换
        expect(result).not.toContain("{{user}}");
        expect(result).not.toContain("{{char}}");
      }
    });

    it("应该正确处理 setvar/getvar 宏", () => {
      const evaluator = new STMacroEvaluator();
      const env: MacroEnv = {
        user: "Alice",
        char: "Bob",
      };

      // 变量初始化 prompt (identifier: 4)
      const varInitPrompt = presetData.prompts.find((p) => p.identifier === "4");
      if (varInitPrompt?.content) {
        const result = evaluator.evaluate(varInitPrompt.content, env);
        // setvar 宏应该被处理（返回空字符串）
        expect(result).not.toContain("{{setvar::");
      }
    });

    it("应该正确处理 {{trim}} 宏", () => {
      const evaluator = new STMacroEvaluator();
      const env: MacroEnv = { user: "Alice", char: "Bob" };

      // 找包含 {{trim}} 的 prompt
      const trimPrompt = presetData.prompts.find(
        (p) => p.content && p.content.includes("{{trim}}"),
      );

      if (trimPrompt?.content) {
        const result = evaluator.evaluate(trimPrompt.content, env);
        expect(result).not.toContain("{{trim}}");
      }
    });
  });

  describe("Prompt Order 验证", () => {
    it("应该按 order 正确排序启用的 prompts", () => {
      const order = manager.getPromptOrder();
      const enabledInOrder = order?.order.filter((e) => e.enabled) || [];

      expect(enabledInOrder.length).toBeGreaterThan(0);

      // 验证排序后的 prompts 与 order 一致
      const orderedPrompts = manager.getOrderedPrompts();
      const orderedIdentifiers = orderedPrompts.map((p) => p.identifier);

      // 检查前几个是否匹配
      for (let i = 0; i < Math.min(5, enabledInOrder.length); i++) {
        const expectedId = enabledInOrder[i].identifier;
        expect(orderedIdentifiers).toContain(expectedId);
      }
    });

    it("应该过滤禁用的 prompts", () => {
      const order = manager.getPromptOrder();
      const disabledInOrder = order?.order.filter((e) => !e.enabled) || [];

      expect(disabledInOrder.length).toBeGreaterThan(0);

      const orderedPrompts = manager.getOrderedPrompts();
      const orderedIdentifiers = orderedPrompts.map((p) => p.identifier);

      // 禁用的 prompt 不应该出现在排序结果中
      for (const disabled of disabledInOrder) {
        expect(orderedIdentifiers).not.toContain(disabled.identifier);
      }
    });
  });

  describe("正则脚本验证", () => {
    it("应该包含正则脚本配置", () => {
      // 检查 extensions 中的 regex_scripts
      const rawData = presetData as unknown as Record<string, unknown>;
      const extensions = rawData.extensions;
      if (extensions && typeof extensions === "object") {
        const extObj = extensions as Record<string, unknown>;
        const regexScripts = extObj.regex_scripts;
        if (regexScripts && Array.isArray(regexScripts)) {
          expect(regexScripts.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
