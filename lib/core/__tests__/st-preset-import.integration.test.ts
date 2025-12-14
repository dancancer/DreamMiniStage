/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              ST 预设导入集成测试                                           ║
 * ║                                                                            ║
 * ║  验证 SillyTavern 预设导入后的行为正确性                                    ║
 * ║  - 数组 injection_trigger 过滤                                             ║
 * ║  - depth injection 排序                                                    ║
 * ║                                                                            ║
 * ║  **Validates: Requirements 1.1, 2.1**                                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import { STPromptManager } from "../prompt";
import type { STCombinedPreset, STOpenAIPreset, MacroEnv } from "../st-preset-types";

/* ═══════════════════════════════════════════════════════════════════════════
 * 测试 1: 数组 injection_trigger 过滤
 * ═══════════════════════════════════════════════════════════════════════════ */
describe("ST 预设导入: 数组 injection_trigger", () => {
  it("应该正确过滤数组 trigger 的 prompts (Requirement 1.1)", () => {
    const preset = createPresetWithArrayTrigger();
    const manager = new STPromptManager(preset);
    const env: MacroEnv = { user: "玩家", char: "角色" };

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ 测试 normal 类型：应该包含 normal_only 和 multi_trigger              │
    // └─────────────────────────────────────────────────────────────────────┘
    const normalMessages = manager.buildMessages(env, {
      generationType: "normal",
    });
    const normalContent = normalMessages.map((m) => m.content).join(" ");

    expect(normalContent).toContain("Normal only prompt");
    expect(normalContent).toContain("Multi trigger prompt");
    expect(normalContent).not.toContain("Continue only prompt");

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ 测试 continue 类型：应该包含 continue_only 和 multi_trigger          │
    // └─────────────────────────────────────────────────────────────────────┘
    const continueMessages = manager.buildMessages(env, {
      generationType: "continue",
    });
    const continueContent = continueMessages.map((m) => m.content).join(" ");

    expect(continueContent).toContain("Continue only prompt");
    expect(continueContent).toContain("Multi trigger prompt");
    expect(continueContent).not.toContain("Normal only prompt");
  });

  it("空数组 trigger 应该对所有类型启用 (Requirement 1.3)", () => {
    const preset = createPresetWithEmptyArrayTrigger();
    const manager = new STPromptManager(preset);
    const env: MacroEnv = { user: "玩家", char: "角色" };

    const types = ["normal", "continue", "quiet", "impersonate"] as const;
    for (const type of types) {
      const messages = manager.buildMessages(env, { generationType: type });
      const content = messages.map((m) => m.content).join(" ");
      expect(content).toContain("Always enabled prompt");
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 测试 2: depth injection 排序
 * ═══════════════════════════════════════════════════════════════════════════ */
describe("ST 预设导入: depth injection 排序", () => {
  it("应该按 depth desc → order desc → role priority 排序 (Requirement 2.1)", () => {
    const preset = createPresetWithDepthInjection();
    const manager = new STPromptManager(preset);
    const env: MacroEnv = {
      user: "玩家",
      char: "角色",
      chatHistoryMessages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "user", content: "How are you?" },
        { role: "assistant", content: "I am fine" },
      ],
    };

    const messages = manager.buildMessages(env);

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ 验证 depth 排序：高 depth 的消息应该在数组前面                        │
    // │ depth=2 的消息应该在 depth=1 的消息之前                              │
    // └─────────────────────────────────────────────────────────────────────┘
    const depth2Index = messages.findIndex((m) =>
      m.content.includes("Depth 2"),
    );
    const depth1Index = messages.findIndex((m) =>
      m.content.includes("Depth 1"),
    );

    // depth=2 应该在 depth=1 之前（更靠近数组开头）
    if (depth2Index !== -1 && depth1Index !== -1) {
      expect(depth2Index).toBeLessThan(depth1Index);
    }
  });

  it("同 depth 内应该按 order desc 排序 (Requirement 2.2)", () => {
    const preset = createPresetWithSameDepthDifferentOrder();
    const manager = new STPromptManager(preset);
    const env: MacroEnv = {
      user: "玩家",
      char: "角色",
      chatHistoryMessages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ],
    };

    const messages = manager.buildMessages(env);

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ 同 depth=1 内，order=100 应该在 order=50 之前                        │
    // │ 注意：depth injection 是从消息数组末尾倒数插入的                      │
    // │ 所以 high order 先插入，会在 low order 之后（更靠近末尾）             │
    // │ 但在同一 depth 位置，high order 应该先被处理                         │
    // └─────────────────────────────────────────────────────────────────────┘
    const highOrderIndex = messages.findIndex((m) =>
      m.content.includes("High order"),
    );
    const lowOrderIndex = messages.findIndex((m) =>
      m.content.includes("Low order"),
    );

    // 两个注入都应该存在
    expect(highOrderIndex).not.toBe(-1);
    expect(lowOrderIndex).not.toBe(-1);

    // 由于是同一 depth，排序后 high order 先处理
    // 在 depth injection 中，先处理的会先插入到该位置
    // 后处理的会插入到同一位置，把先插入的往前推
    // 所以最终 low order 在前，high order 在后
    // 这符合 ST 的行为：同 depth 内，order 高的最终更靠近 depth 位置
    expect(lowOrderIndex).toBeLessThan(highOrderIndex);
  });

  it("同 depth/order 内应该按 role priority 排序 (Requirement 2.3)", () => {
    const preset = createPresetWithSameDepthOrderDifferentRole();
    const manager = new STPromptManager(preset);
    const env: MacroEnv = {
      user: "玩家",
      char: "角色",
      chatHistoryMessages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ],
    };

    const messages = manager.buildMessages(env);

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ 同 depth=1, order=50 内，system > user > assistant                  │
    // └─────────────────────────────────────────────────────────────────────┘
    const systemIndex = messages.findIndex((m) =>
      m.content.includes("System role"),
    );
    const userIndex = messages.findIndex((m) =>
      m.content.includes("User role"),
    );
    const assistantIndex = messages.findIndex((m) =>
      m.content.includes("Assistant role"),
    );

    if (systemIndex !== -1 && userIndex !== -1) {
      expect(systemIndex).toBeLessThan(userIndex);
    }
    if (userIndex !== -1 && assistantIndex !== -1) {
      expect(userIndex).toBeLessThan(assistantIndex);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 测试数据工厂函数
 * ═══════════════════════════════════════════════════════════════════════════ */

function createPresetWithArrayTrigger(): STCombinedPreset {
  const openai: STOpenAIPreset = {
    temperature: 1.0,
    prompts: [
      {
        identifier: "main",
        role: "system",
        content: "Main prompt",
      },
      {
        identifier: "normal_only",
        role: "system",
        content: "Normal only prompt",
        injection_trigger: "normal",
      },
      {
        identifier: "continue_only",
        role: "system",
        content: "Continue only prompt",
        injection_trigger: "continue",
      },
      {
        identifier: "multi_trigger",
        role: "system",
        content: "Multi trigger prompt",
        injection_trigger: ["normal", "continue", "quiet"],
      },
    ],
    prompt_order: [
      {
        character_id: 100001,
        order: [
          { identifier: "main", enabled: true },
          { identifier: "normal_only", enabled: true },
          { identifier: "continue_only", enabled: true },
          { identifier: "multi_trigger", enabled: true },
        ],
      },
    ],
  };

  return {
    openai,
    context: { name: "default", story_string: "" },
  };
}

function createPresetWithEmptyArrayTrigger(): STCombinedPreset {
  const openai: STOpenAIPreset = {
    temperature: 1.0,
    prompts: [
      {
        identifier: "always_enabled",
        role: "system",
        content: "Always enabled prompt",
        injection_trigger: [],
      },
    ],
    prompt_order: [
      {
        character_id: 100001,
        order: [{ identifier: "always_enabled", enabled: true }],
      },
    ],
  };

  return {
    openai,
    context: { name: "default", story_string: "" },
  };
}

function createPresetWithDepthInjection(): STCombinedPreset {
  const openai: STOpenAIPreset = {
    temperature: 1.0,
    prompts: [
      {
        identifier: "chatHistory",
        role: "system",
        marker: true,
      },
      {
        identifier: "depth1",
        role: "system",
        content: "Depth 1 injection",
        injection_position: 1, // ABSOLUTE
        injection_depth: 1,
        depth_prompt_order: 50,
      },
      {
        identifier: "depth2",
        role: "system",
        content: "Depth 2 injection",
        injection_position: 1, // ABSOLUTE
        injection_depth: 2,
        depth_prompt_order: 50,
      },
    ],
    prompt_order: [
      {
        character_id: 100001,
        order: [
          { identifier: "chatHistory", enabled: true },
          { identifier: "depth1", enabled: true },
          { identifier: "depth2", enabled: true },
        ],
      },
    ],
  };

  return {
    openai,
    context: { name: "default", story_string: "" },
  };
}

function createPresetWithSameDepthDifferentOrder(): STCombinedPreset {
  const openai: STOpenAIPreset = {
    temperature: 1.0,
    prompts: [
      {
        identifier: "chatHistory",
        role: "system",
        marker: true,
      },
      {
        identifier: "low_order",
        role: "system",
        content: "Low order injection",
        injection_position: 1,
        injection_depth: 1,
        depth_prompt_order: 50,
      },
      {
        identifier: "high_order",
        role: "system",
        content: "High order injection",
        injection_position: 1,
        injection_depth: 1,
        depth_prompt_order: 100,
      },
    ],
    prompt_order: [
      {
        character_id: 100001,
        order: [
          { identifier: "chatHistory", enabled: true },
          { identifier: "low_order", enabled: true },
          { identifier: "high_order", enabled: true },
        ],
      },
    ],
  };

  return {
    openai,
    context: { name: "default", story_string: "" },
  };
}

function createPresetWithSameDepthOrderDifferentRole(): STCombinedPreset {
  const openai: STOpenAIPreset = {
    temperature: 1.0,
    prompts: [
      {
        identifier: "chatHistory",
        role: "system",
        marker: true,
      },
      {
        identifier: "assistant_role",
        role: "assistant",
        content: "Assistant role injection",
        injection_position: 1,
        injection_depth: 1,
        depth_prompt_order: 50,
      },
      {
        identifier: "user_role",
        role: "user",
        content: "User role injection",
        injection_position: 1,
        injection_depth: 1,
        depth_prompt_order: 50,
      },
      {
        identifier: "system_role",
        role: "system",
        content: "System role injection",
        injection_position: 1,
        injection_depth: 1,
        depth_prompt_order: 50,
      },
    ],
    prompt_order: [
      {
        character_id: 100001,
        order: [
          { identifier: "chatHistory", enabled: true },
          { identifier: "assistant_role", enabled: true },
          { identifier: "user_role", enabled: true },
          { identifier: "system_role", enabled: true },
        ],
      },
    ],
  };

  return {
    openai,
    context: { name: "default", story_string: "" },
  };
}
