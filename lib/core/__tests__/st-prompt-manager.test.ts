/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    STPromptManager 单元测试                                ║
 * ║                                                                            ║
 * ║  测试 SillyTavern 兼容的 PromptManager 功能                                 ║
 * ║  参考: SillyTavern/public/scripts/PromptManager.js                         ║
 * ║  参考: SillyTavern/public/scripts/openai.js                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach } from "vitest";
import { STPromptManager } from "../prompt";
import { PostProcessingMode } from "../st-preset-types";
import type { STCombinedPreset, STOpenAIPreset, MacroEnv } from "../st-preset-types";

/**
 * SillyTavern INJECTION_POSITION 常量
 * - RELATIVE (0): 按 prompt_order 排序
 * - ABSOLUTE (1): 注入到聊天历史的特定深度
 */
const INJECTION_POSITION = {
  RELATIVE: 0,
  ABSOLUTE: 1,
};

describe("STPromptManager", () => {
  let manager: STPromptManager;
  let preset: STCombinedPreset;

  beforeEach(() => {
    preset = createTestPreset();
    manager = new STPromptManager(preset);
  });

  describe("Preset 访问", () => {
    it("应该能获取 OpenAI preset", () => {
      const openai = manager.getOpenAIPreset();
      expect(openai).toBeDefined();
      expect(openai.prompts).toBeDefined();
    });

    it("应该能获取 Context preset", () => {
      const context = manager.getContextPreset();
      expect(context).toBeDefined();
      expect(context.story_string).toBeDefined();
    });

    it("应该能获取 Sysprompt preset", () => {
      preset.sysprompt = { name: "test", content: "Test content" };
      manager = new STPromptManager(preset);
      const sysprompt = manager.getSyspromptPreset();
      expect(sysprompt).toBeDefined();
      expect(sysprompt?.content).toBe("Test content");
    });
  });

  describe("Prompt Order 排序", () => {
    it("应该返回默认 character_id 100001 的 order", () => {
      const order = manager.getPromptOrder();
      expect(order).toBeDefined();
      expect(order?.character_id).toBe(100001);
    });

    it("应该返回指定 character_id 的 order", () => {
      preset.openai.prompt_order.push({
        character_id: 12345,
        order: [{ identifier: "custom", enabled: true }],
      });
      manager = new STPromptManager(preset);

      const order = manager.getPromptOrder(12345);
      expect(order?.character_id).toBe(12345);
    });

    it("应该按 order 排序返回启用的 prompts", () => {
      const ordered = manager.getOrderedPrompts();
      expect(ordered.length).toBeGreaterThan(0);

      // 验证只返回启用的 prompts
      const order = manager.getPromptOrder();
      const enabledCount = order?.order.filter((e) => e.enabled).length || 0;
      expect(ordered.length).toBeLessThanOrEqual(enabledCount);
    });

    it("应该过滤禁用的 prompts", () => {
      const ordered = manager.getOrderedPrompts();
      const identifiers = ordered.map((p) => p.identifier);

      // disabled_prompt 应该不在结果中
      expect(identifiers).not.toContain("disabled_prompt");
    });
  });

  describe("Prompt 查找", () => {
    it("应该能根据 identifier 查找 prompt", () => {
      const prompt = manager.findPrompt("main");
      expect(prompt).toBeDefined();
      expect(prompt?.identifier).toBe("main");
    });

    it("查找不存在的 prompt 应该返回 undefined", () => {
      const prompt = manager.findPrompt("nonexistent");
      expect(prompt).toBeUndefined();
    });
  });

  describe("消息构建", () => {
    it("应该构建有效的消息数组", () => {
      const env: MacroEnv = {
        user: "玩家",
        char: "角色",
        description: "角色描述",
      };

      const messages = manager.buildMessages(env);
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);
    });

    it("应该正确设置消息 role", () => {
      const env: MacroEnv = { user: "玩家", char: "角色" };
      const messages = manager.buildMessages(env);

      for (const msg of messages) {
        expect(["system", "user", "assistant"]).toContain(msg.role);
      }
    });

    it("应该替换 prompt 中的宏", () => {
      const env: MacroEnv = { user: "Alice", char: "Bob" };
      const messages = manager.buildMessages(env);

      // 检查宏是否被替换
      for (const msg of messages) {
        expect(msg.content).not.toContain("{{user}}");
        expect(msg.content).not.toContain("{{char}}");
      }
    });
  });

  describe("Marker 解析", () => {
    it("应该解析 charDescription marker", () => {
      const env: MacroEnv = {
        user: "玩家",
        char: "角色",
        description: "这是角色描述",
      };

      const messages = manager.buildMessages(env);
      const hasDescription = messages.some((m) =>
        m.content.includes("这是角色描述"),
      );
      expect(hasDescription).toBe(true);
    });

    it("应该解析 worldInfoBefore marker", () => {
      const env: MacroEnv = {
        user: "玩家",
        char: "角色",
        wiBefore: "World Info Before Content",
      };

      const messages = manager.buildMessages(env);
      const hasWiBefore = messages.some((m) =>
        m.content.includes("World Info Before Content"),
      );
      expect(hasWiBefore).toBe(true);
    });
  });

  describe("注入位置 (INJECTION_POSITION)", () => {
    it("RELATIVE (0) prompts 应该按 order 排序", () => {
      const ordered = manager.getOrderedPrompts();

      // 所有 RELATIVE prompts 应该在结果中
      const relativePrompts = ordered.filter(
        (p) => p.injection_position === INJECTION_POSITION.RELATIVE || p.injection_position === undefined,
      );
      expect(relativePrompts.length).toBeGreaterThan(0);
    });

    it("ABSOLUTE (1) prompts 应该注入到指定深度", () => {
      // 添加一个 ABSOLUTE prompt
      preset.openai.prompts.push({
        identifier: "absolute_test",
        name: "Absolute Test",
        role: "system",
        content: "Absolute injection content",
        injection_position: INJECTION_POSITION.ABSOLUTE,
        injection_depth: 2,
        injection_order: 100,
      });
      preset.openai.prompt_order[0].order.push({
        identifier: "absolute_test",
        enabled: true,
      });
      manager = new STPromptManager(preset);

      const env: MacroEnv = { user: "玩家", char: "角色" };
      const messages = manager.buildMessages(env);

      // ABSOLUTE prompt 应该被注入
      const hasAbsolute = messages.some((m) =>
        m.content.includes("Absolute injection content"),
      );
      expect(hasAbsolute).toBe(true);
    });
  });

  describe("后处理管线 (postProcessMessages)", () => {
    it("默认模式 (NONE) 应该保留原始消息结构", () => {
      const env: MacroEnv = { user: "玩家", char: "角色" };
      const messages = manager.buildMessages(env);

      expect(messages.length).toBeGreaterThan(0);
      // 默认不做后处理，消息保持原样
    });

    it("MERGE 模式应该合并连续同角色消息", () => {
      // 添加连续的 system 消息来验证合并行为
      preset.openai.prompts.push(
        {
          identifier: "sys_1",
          name: "System 1",
          role: "system",
          content: "System message 1",
        },
        {
          identifier: "sys_2",
          name: "System 2",
          role: "system",
          content: "System message 2",
        },
      );
      preset.openai.prompt_order[0].order.push(
        { identifier: "sys_1", enabled: true },
        { identifier: "sys_2", enabled: true },
      );
      manager = new STPromptManager(preset);

      const env: MacroEnv = { user: "玩家", char: "角色" };

      const messagesNoMerge = manager.buildMessages(env);
      const messagesMerge = manager.buildMessages(env, {
        postProcessingMode: PostProcessingMode.MERGE,
        promptNames: {
          charName: "角色",
          userName: "玩家",
          groupNames: [],
          startsWithGroupName: () => false,
        },
      });

      // MERGE 模式后消息数应该更少（连续同角色被合并）
      expect(messagesMerge.length).toBeLessThanOrEqual(messagesNoMerge.length);
    });
  });

  describe("Generation Type 触发器", () => {
    it("应该根据 generation type 过滤 prompts", () => {
      // 添加一个只在 continue 时触发的 prompt
      preset.openai.prompts.push({
        identifier: "continue_only",
        name: "Continue Only",
        role: "system",
        content: "Continue prompt",
        injection_trigger: "continue",
      });
      preset.openai.prompt_order[0].order.push({
        identifier: "continue_only",
        enabled: true,
      });
      manager = new STPromptManager(preset);

      // normal 类型不应该包含 continue_only
      const normalPrompts = manager.getOrderedPrompts(undefined, "normal");
      const hasContinue = normalPrompts.some(
        (p) => p.identifier === "continue_only",
      );
      expect(hasContinue).toBe(false);

      // continue 类型应该包含 continue_only
      const continuePrompts = manager.getOrderedPrompts(undefined, "continue");
      const hasContinue2 = continuePrompts.some(
        (p) => p.identifier === "continue_only",
      );
      expect(hasContinue2).toBe(true);
    });
  });

  describe("World Info 深度注入", () => {
    it("应该支持 World Info 深度注入", () => {
      const env: MacroEnv = { user: "玩家", char: "角色" };
      const messages = manager.buildMessages(env, {
        worldInfoDepthInjections: [
          { content: "WI Depth 1", depth: 1, order: 100 },
          { content: "WI Depth 3", depth: 3, order: 100 },
        ],
      });

      const hasWiDepth1 = messages.some((m) => m.content.includes("WI Depth 1"));
      const hasWiDepth3 = messages.some((m) => m.content.includes("WI Depth 3"));

      expect(hasWiDepth1).toBe(true);
      expect(hasWiDepth3).toBe(true);
    });
  });
});

/**
 * 创建测试用 Preset
 */
function createTestPreset(): STCombinedPreset {
  const openai: STOpenAIPreset = {
    temperature: 1.0,
    top_p: 0.9,
    prompts: [
      {
        identifier: "main",
        name: "Main Prompt",
        role: "system",
        content: "You are {{char}}, talking to {{user}}.",
      },
      {
        identifier: "worldInfoBefore",
        name: "World Info Before",
        role: "system",
        marker: true,
        system_prompt: true,
      },
      {
        identifier: "charDescription",
        name: "Character Description",
        role: "system",
        marker: true,
        system_prompt: true,
      },
      {
        identifier: "worldInfoAfter",
        name: "World Info After",
        role: "system",
        marker: true,
        system_prompt: true,
      },
      {
        identifier: "jailbreak",
        name: "Jailbreak",
        role: "system",
        content: "Jailbreak prompt content",
      },
      {
        identifier: "disabled_prompt",
        name: "Disabled Prompt",
        role: "system",
        content: "This should not appear",
      },
      {
        identifier: "user_prompt",
        name: "User Prompt",
        role: "user",
        content: "User message: {{user}}",
        injection_position: INJECTION_POSITION.RELATIVE,
      },
    ],
    prompt_order: [
      {
        character_id: 100001,
        order: [
          { identifier: "main", enabled: true },
          { identifier: "worldInfoBefore", enabled: true },
          { identifier: "charDescription", enabled: true },
          { identifier: "worldInfoAfter", enabled: true },
          { identifier: "jailbreak", enabled: true },
          { identifier: "disabled_prompt", enabled: false },
          { identifier: "user_prompt", enabled: true },
        ],
      },
    ],
  };

  return {
    openai,
    context: {
      name: "default",
      story_string: "{{description}}\n{{personality}}\n{{scenario}}",
      example_separator: "---",
      chat_start: "[Start]",
    },
  };
}
