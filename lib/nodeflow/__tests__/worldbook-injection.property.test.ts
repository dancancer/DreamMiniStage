/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     世界书 messages[] 注入属性测试                          ║
 * ║                                                                            ║
 * ║  **Feature: message-assembly-remediation, Property 7: 世界书 messages[] 注入**
 * ║  **Validates: Requirements 4.1**                                           ║
 * ║                                                                            ║
 * ║  验证 PresetNode 处理世界书 markers 时，内容正确注入到 messages[]            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { STPromptManager, createPromptManagerFromOpenAI } from "@/lib/core/prompt";
import { STMacroEvaluator } from "@/lib/core/st-macro-evaluator";
import type { MacroEnv, STOpenAIPreset, ChatMessage } from "@/lib/core/st-preset-types";

/* ═══════════════════════════════════════════════════════════════════════════
   测试数据生成器
   ═══════════════════════════════════════════════════════════════════════════ */

/** 生成世界书内容（非空，不含特殊字符） */
const worldBookContentArb = fc.string({ minLength: 1, maxLength: 200 })
  .filter(s => !s.includes("{{") && !s.includes("}}") && s.trim().length > 0);

/** 生成用户输入 */
const userInputArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/** 生成角色名 */
const charNameArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => s.trim().length > 0);

/** 生成聊天历史消息 */
const chatMessageArb: fc.Arbitrary<ChatMessage> = fc.record({
  role: fc.constantFrom("user", "assistant") as fc.Arbitrary<"user" | "assistant">,
  content: fc.string({ minLength: 1, maxLength: 100 }),
});

/** 生成聊天历史数组 */
const chatHistoryArb = fc.array(chatMessageArb, { minLength: 0, maxLength: 5 });

/* ═══════════════════════════════════════════════════════════════════════════
   测试辅助函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 创建包含世界书 markers 的默认 OpenAI Preset
 */
function createPresetWithWorldBookMarkers(): STOpenAIPreset {
  return {
    prompts: [
      {
        identifier: "main",
        name: "Main Prompt",
        system_prompt: true,
        role: "system",
        content: "Write {{char}}'s next reply.",
      },
      {
        identifier: "worldInfoBefore",
        name: "World Info (before)",
        system_prompt: true,
        marker: true,
      },
      {
        identifier: "charDescription",
        name: "Char Description",
        system_prompt: true,
        marker: true,
      },
      {
        identifier: "worldInfoAfter",
        name: "World Info (after)",
        system_prompt: true,
        marker: true,
      },
      {
        identifier: "chatHistory",
        name: "Chat History",
        system_prompt: true,
        marker: true,
      },
    ],
    prompt_order: [{
      character_id: 100001,
      order: [
        { identifier: "main", enabled: true },
        { identifier: "worldInfoBefore", enabled: true },
        { identifier: "charDescription", enabled: true },
        { identifier: "worldInfoAfter", enabled: true },
        { identifier: "chatHistory", enabled: true },
      ],
    }],
    temperature: 1,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    openai_max_context: 4095,
    openai_max_tokens: 300,
    stream_openai: true,
    squash_system_messages: false,
  };
}

/**
 * 创建 MacroEnv 环境
 */
function createMacroEnv(options: {
  wiBefore?: string;
  wiAfter?: string;
  userInput?: string;
  charName?: string;
  chatHistory?: ChatMessage[];
}): MacroEnv {
  return {
    user: "测试用户",
    char: options.charName ?? "测试角色",
    description: "角色描述",
    personality: "角色性格",
    scenario: "场景描述",
    persona: "",
    mesExamples: "",
    wiBefore: options.wiBefore ?? "",
    wiAfter: options.wiAfter ?? "",
    chatHistory: "",
    chatHistoryMessages: options.chatHistory ?? [],
    userInput: options.userInput ?? "测试输入",
    lastUserMessage: options.userInput ?? "测试输入",
    number: 200,
    language: "zh",
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Property 7: 世界书 messages[] 注入
   **Validates: Requirements 4.1**
   
   *For any* 世界书内容，当 PresetNode 处理 worldInfoBefore/worldInfoAfter markers 时，
   内容应该被注入到 messages[] 中
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 7: 世界书 messages[] 注入", () => {
  let macroEvaluator: STMacroEvaluator;
  let promptManager: STPromptManager;

  beforeEach(() => {
    macroEvaluator = new STMacroEvaluator();
    promptManager = createPromptManagerFromOpenAI(
      createPresetWithWorldBookMarkers(),
      undefined,
      macroEvaluator,
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 7**
   * **Validates: Requirements 4.1**
   *
   * *For any* wiBefore 内容，buildMessages SHALL 将其注入到 messages[]
   */
  it("*For any* wiBefore content, buildMessages SHALL inject into messages[]", () => {
    fc.assert(
      fc.property(
        worldBookContentArb,
        userInputArb,
        (wiBefore, userInput) => {
          const env = createMacroEnv({
            wiBefore,
            wiAfter: "",
            userInput,
          });

          const messages = promptManager.buildMessages(env);

          // 核心断言: wiBefore 内容出现在 messages[] 中
          const allContent = messages.map(m => m.content).join("\n");
          expect(allContent).toContain(wiBefore);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 7**
   * **Validates: Requirements 4.1**
   *
   * *For any* wiAfter 内容，buildMessages SHALL 将其注入到 messages[]
   */
  it("*For any* wiAfter content, buildMessages SHALL inject into messages[]", () => {
    fc.assert(
      fc.property(
        worldBookContentArb,
        userInputArb,
        (wiAfter, userInput) => {
          const env = createMacroEnv({
            wiBefore: "",
            wiAfter,
            userInput,
          });

          const messages = promptManager.buildMessages(env);

          // 核心断言: wiAfter 内容出现在 messages[] 中
          const allContent = messages.map(m => m.content).join("\n");
          expect(allContent).toContain(wiAfter);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 7**
   * **Validates: Requirements 4.1**
   *
   * *For any* wiBefore 和 wiAfter 内容，两者都应该被注入到 messages[]
   */
  it("*For any* wiBefore and wiAfter, both SHALL be injected into messages[]", () => {
    fc.assert(
      fc.property(
        worldBookContentArb,
        worldBookContentArb,
        userInputArb,
        (wiBefore, wiAfter, userInput) => {
          const env = createMacroEnv({
            wiBefore,
            wiAfter,
            userInput,
          });

          const messages = promptManager.buildMessages(env);
          const allContent = messages.map(m => m.content).join("\n");

          // 核心断言: 两者都出现在 messages[] 中
          expect(allContent).toContain(wiBefore);
          expect(allContent).toContain(wiAfter);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 7**
   * **Validates: Requirements 4.1**
   *
   * *For any* 空的世界书内容，messages[] 应该正常构建（不崩溃）
   */
  it("*For any* empty world book content, messages[] SHALL be built normally", () => {
    fc.assert(
      fc.property(
        userInputArb,
        chatHistoryArb,
        (userInput, chatHistory) => {
          const env = createMacroEnv({
            wiBefore: "",
            wiAfter: "",
            userInput,
            chatHistory,
          });

          // 不应该抛出异常
          expect(() => promptManager.buildMessages(env)).not.toThrow();

          const messages = promptManager.buildMessages(env);

          // 应该返回有效的消息数组
          expect(Array.isArray(messages)).toBe(true);
          expect(messages.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 7**
   * **Validates: Requirements 4.1**
   *
   * *For any* 世界书内容，注入后 messages[] 结构应该保持有效
   */
  it("*For any* world book content, messages[] structure SHALL remain valid", () => {
    fc.assert(
      fc.property(
        worldBookContentArb,
        worldBookContentArb,
        userInputArb,
        chatHistoryArb,
        (wiBefore, wiAfter, userInput, chatHistory) => {
          const env = createMacroEnv({
            wiBefore,
            wiAfter,
            userInput,
            chatHistory,
          });

          const messages = promptManager.buildMessages(env);

          // 核心断言 1: 每条消息都有有效的 role
          messages.forEach(msg => {
            expect(["system", "user", "assistant"]).toContain(msg.role);
          });

          // 核心断言 2: 每条消息都有 content
          messages.forEach(msg => {
            expect(typeof msg.content).toBe("string");
          });

          // 核心断言 3: 至少有一条 system 消息
          expect(messages.some(m => m.role === "system")).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   世界书注入位置验证
   ═══════════════════════════════════════════════════════════════════════════ */

describe("世界书注入位置验证", () => {
  let macroEvaluator: STMacroEvaluator;
  let promptManager: STPromptManager;

  beforeEach(() => {
    macroEvaluator = new STMacroEvaluator();
    promptManager = createPromptManagerFromOpenAI(
      createPresetWithWorldBookMarkers(),
      undefined,
      macroEvaluator,
    );
  });

  /**
   * 验证 wiBefore 在 chatHistory 之前
   */
  it("wiBefore SHALL appear before chatHistory in messages[]", () => {
    const env = createMacroEnv({
      wiBefore: "WORLD_INFO_BEFORE_MARKER",
      wiAfter: "",
      userInput: "USER_INPUT_MARKER",
      chatHistory: [
        { role: "user", content: "HISTORY_USER_MARKER" },
        { role: "assistant", content: "HISTORY_ASSISTANT_MARKER" },
      ],
    });

    const messages = promptManager.buildMessages(env);
    const allContent = messages.map(m => m.content).join("\n");

    const wiBeforeIndex = allContent.indexOf("WORLD_INFO_BEFORE_MARKER");
    const historyIndex = allContent.indexOf("HISTORY_USER_MARKER");

    // wiBefore 应该在历史消息之前
    expect(wiBeforeIndex).toBeLessThan(historyIndex);
  });

  /**
   * 验证 wiAfter 在 chatHistory 之前（根据 preset 配置）
   */
  it("wiAfter SHALL appear before chatHistory in messages[] (per preset order)", () => {
    const env = createMacroEnv({
      wiBefore: "",
      wiAfter: "WORLD_INFO_AFTER_MARKER",
      userInput: "USER_INPUT_MARKER",
      chatHistory: [
        { role: "user", content: "HISTORY_USER_MARKER" },
        { role: "assistant", content: "HISTORY_ASSISTANT_MARKER" },
      ],
    });

    const messages = promptManager.buildMessages(env);
    const allContent = messages.map(m => m.content).join("\n");

    const wiAfterIndex = allContent.indexOf("WORLD_INFO_AFTER_MARKER");
    const historyIndex = allContent.indexOf("HISTORY_USER_MARKER");

    // wiAfter 应该在历史消息之前（根据 preset 中的顺序）
    expect(wiAfterIndex).toBeLessThan(historyIndex);
  });

  /**
   * 验证世界书内容在 system 消息中
   */
  it("world book content SHALL be in system messages", () => {
    const env = createMacroEnv({
      wiBefore: "UNIQUE_WI_BEFORE_CONTENT",
      wiAfter: "UNIQUE_WI_AFTER_CONTENT",
      userInput: "测试输入",
    });

    const messages = promptManager.buildMessages(env);
    const systemMessages = messages.filter(m => m.role === "system");
    const systemContent = systemMessages.map(m => m.content).join("\n");

    // 世界书内容应该在 system 消息中
    expect(systemContent).toContain("UNIQUE_WI_BEFORE_CONTENT");
    expect(systemContent).toContain("UNIQUE_WI_AFTER_CONTENT");
  });
});
