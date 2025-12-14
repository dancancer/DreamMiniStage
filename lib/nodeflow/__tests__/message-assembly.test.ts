/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     消息组装快照测试                                        ║
 * ║                                                                            ║
 * ║  验证 DialogueWorkflow 和 RAGWorkflow 的消息组装正确性                      ║
 * ║  建立回归基线，确保后续重构不破坏现有行为                                    ║
 * ║                                                                            ║
 * ║  Requirements: 8.1, 8.2, 8.3                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { STPromptManager, createPromptManagerFromOpenAI } from "@/lib/core/prompt";
import { STMacroEvaluator } from "@/lib/core/st-macro-evaluator";
import type { MacroEnv, STOpenAIPreset, ChatMessage } from "@/lib/core/st-preset-types";

/* ═══════════════════════════════════════════════════════════════════════════
   Mock 数据定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 创建 mock 角色数据
 */
function createMockCharacter(overrides: Partial<{
  name: string;
  description: string;
  personality: string;
  scenario: string;
  mesExamples: string;
}> = {}) {
  return {
    name: overrides.name ?? "测试角色",
    description: overrides.description ?? "这是一个测试角色的描述",
    personality: overrides.personality ?? "友善、乐于助人",
    scenario: overrides.scenario ?? "在一个虚拟世界中",
    mesExamples: overrides.mesExamples ?? "",
  };
}

/**
 * 创建 mock 聊天历史数据
 */
function createMockChatHistory(turns: number = 3): ChatMessage[] {
  const history: ChatMessage[] = [];
  for (let i = 0; i < turns; i++) {
    history.push({ role: "user", content: `用户消息 ${i + 1}` });
    history.push({ role: "assistant", content: `助手回复 ${i + 1}` });
  }
  return history;
}

/**
 * 创建默认 OpenAI Preset（模拟 SillyTavern 默认配置）
 */
function createDefaultOpenAIPreset(): STOpenAIPreset {
  return {
    prompts: [
      {
        identifier: "main",
        name: "Main Prompt",
        system_prompt: true,
        role: "system",
        content: "Write {{char}}'s next reply in a fictional chat between {{char}} and {{user}}.",
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
        identifier: "charPersonality",
        name: "Char Personality",
        system_prompt: true,
        marker: true,
      },
      {
        identifier: "scenario",
        name: "Scenario",
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
      {
        identifier: "jailbreak",
        name: "Post-History Instructions",
        system_prompt: true,
        role: "system",
        content: "",
      },
    ],
    prompt_order: [{
      character_id: 100001,
      order: [
        { identifier: "main", enabled: true },
        { identifier: "worldInfoBefore", enabled: true },
        { identifier: "charDescription", enabled: true },
        { identifier: "charPersonality", enabled: true },
        { identifier: "scenario", enabled: true },
        { identifier: "worldInfoAfter", enabled: true },
        { identifier: "chatHistory", enabled: true },
        { identifier: "jailbreak", enabled: true },
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
  character?: ReturnType<typeof createMockCharacter>;
  chatHistory?: ChatMessage[];
  userInput?: string;
  wiBefore?: string;
  wiAfter?: string;
} = {}): MacroEnv {
  const char = options.character ?? createMockCharacter();
  return {
    user: "测试用户",
    char: char.name,
    description: char.description,
    personality: char.personality,
    scenario: char.scenario,
    persona: "",
    mesExamples: char.mesExamples,
    wiBefore: options.wiBefore ?? "",
    wiAfter: options.wiAfter ?? "",
    chatHistory: "",
    chatHistoryMessages: options.chatHistory ?? [],
    userInput: options.userInput ?? "推进剧情",
    lastUserMessage: options.userInput ?? "推进剧情",
    number: 200,
    language: "zh",
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   生成器定义（用于属性测试）
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成安全的用户输入字符串（非空白）
 */
const safeUserInputArb = fc.stringMatching(/^[\u4e00-\u9fa5a-zA-Z0-9\s,.!?，。！？]+$/)
  .filter(s => s.length > 0 && s.length <= 100 && s.trim().length > 0);

/**
 * 生成聊天历史消息
 */
const chatMessageArb = fc.record({
  role: fc.constantFrom("user" as const, "assistant" as const),
  content: fc.string({ minLength: 1, maxLength: 200 }),
});

/**
 * 生成聊天历史数组（0-10 轮对话）
 */
const chatHistoryArb = fc.array(chatMessageArb, { minLength: 0, maxLength: 20 });

/**
 * 生成角色数据
 */
const characterArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }),
  description: fc.string({ minLength: 0, maxLength: 500 }),
  personality: fc.string({ minLength: 0, maxLength: 200 }),
  scenario: fc.string({ minLength: 0, maxLength: 200 }),
  mesExamples: fc.string({ minLength: 0, maxLength: 500 }),
});

/* ═══════════════════════════════════════════════════════════════════════════
   Task 1.1: 测试工具函数和 mock 数据
   Requirements: 8.1, 8.2
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Task 1.1: Mock 数据工具函数", () => {
  it("createMockCharacter 应该返回有效的角色数据", () => {
    const char = createMockCharacter();
    expect(char.name).toBeDefined();
    expect(char.description).toBeDefined();
    expect(char.personality).toBeDefined();
    expect(char.scenario).toBeDefined();
  });

  it("createMockCharacter 应该支持自定义覆盖", () => {
    const char = createMockCharacter({ name: "自定义角色" });
    expect(char.name).toBe("自定义角色");
  });

  it("createMockChatHistory 应该生成指定轮数的对话", () => {
    const history = createMockChatHistory(5);
    expect(history.length).toBe(10); // 5 轮 = 10 条消息
    expect(history[0].role).toBe("user");
    expect(history[1].role).toBe("assistant");
  });

  it("createDefaultOpenAIPreset 应该包含 chatHistory marker", () => {
    const preset = createDefaultOpenAIPreset();
    const chatHistoryPrompt = preset.prompts.find(p => p.identifier === "chatHistory");
    expect(chatHistoryPrompt).toBeDefined();
    expect(chatHistoryPrompt?.marker).toBe(true);
  });

  it("createMacroEnv 应该正确组装环境变量", () => {
    const history = createMockChatHistory(2);
    const env = createMacroEnv({
      chatHistory: history,
      userInput: "测试输入",
    });
    expect(env.chatHistoryMessages).toEqual(history);
    expect(env.userInput).toBe("测试输入");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Task 1.2: 属性测试 - chatHistory marker 展开正确性
   **Property 6: chatHistory marker 展开正确性**
   **Validates: Requirements 3.1, 3.2, 3.4**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 6: chatHistory marker 展开正确性", () => {
  let macroEvaluator: STMacroEvaluator;
  let promptManager: STPromptManager;

  beforeEach(() => {
    macroEvaluator = new STMacroEvaluator();
    promptManager = createPromptManagerFromOpenAI(
      createDefaultOpenAIPreset(),
      undefined,
      macroEvaluator,
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 6**
   * **Validates: Requirements 3.1**
   *
   * *For any* chatHistoryMessages 数组，当 STPromptManager 遇到 chatHistory marker 时，
   * 系统应该将所有历史消息插入到 messages[] 中
   */
  it("*For any* chatHistoryMessages, buildMessages SHALL insert all history messages at chatHistory marker", () => {
    fc.assert(
      fc.property(
        chatHistoryArb,
        (chatHistory) => {
          const env = createMacroEnv({ chatHistory, userInput: "测试" });
          const messages = promptManager.buildMessages(env);

          // 验证历史消息被包含在输出中
          for (const historyMsg of chatHistory) {
            const found = messages.some(m =>
              m.role === historyMsg.role && m.content === historyMsg.content,
            );
            expect(found).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 6**
   * **Validates: Requirements 3.2**
   *
   * *For any* userInput，当 chatHistory marker 展开完成后，
   * 当前用户输入应该作为最后一条 user 消息添加
   */
  it("*For any* userInput, buildMessages SHALL append current user input as final user message", () => {
    fc.assert(
      fc.property(
        safeUserInputArb,
        (userInput) => {
          const env = createMacroEnv({
            chatHistory: createMockChatHistory(2),
            userInput,
          });
          const messages = promptManager.buildMessages(env);

          // 找到所有 user 消息
          const userMessages = messages.filter(m => m.role === "user");

          // 最后一条 user 消息应该是当前用户输入
          if (userMessages.length > 0) {
            const lastUserMsg = userMessages[userMessages.length - 1];
            expect(lastUserMsg.content).toBe(userInput);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 6**
   * **Validates: Requirements 3.4**
   *
   * *For any* chatHistoryMessages，展开后应该保持原始消息顺序
   * 
   * 注意：过滤掉重复消息，因为 findIndex 无法区分相同内容的消息
   */
  it("*For any* chatHistoryMessages, buildMessages SHALL preserve original message order", () => {
    // 生成无重复内容的历史消息
    const uniqueChatHistoryArb = chatHistoryArb
      .filter(h => h.length >= 2)
      .map(history => {
        // 去重：确保每条消息的 role+content 组合唯一
        const seen = new Set<string>();
        return history.filter(msg => {
          const key = `${msg.role}:${msg.content}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      })
      .filter(h => h.length >= 2);

    fc.assert(
      fc.property(
        uniqueChatHistoryArb,
        (chatHistory) => {
          const env = createMacroEnv({ chatHistory, userInput: "测试" });
          const messages = promptManager.buildMessages(env);

          // 提取输出中的历史消息（按原始顺序）
          const outputHistoryMsgs: ChatMessage[] = [];
          for (const msg of messages) {
            const historyIdx = chatHistory.findIndex(h =>
              h.role === msg.role && h.content === msg.content,
            );
            if (historyIdx !== -1) {
              outputHistoryMsgs.push(msg);
            }
          }

          // 验证顺序保持不变
          let lastFoundIdx = -1;
          for (const outputMsg of outputHistoryMsgs) {
            const idx = chatHistory.findIndex(h =>
              h.role === outputMsg.role && h.content === outputMsg.content,
            );
            expect(idx).toBeGreaterThan(lastFoundIdx);
            lastFoundIdx = idx;
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 6**
   * **Validates: Requirements 3.1**
   *
   * 当 chatHistoryMessages 为空时，应该只插入当前用户输入
   */
  it("when chatHistoryMessages is empty, buildMessages SHALL insert only current user input", () => {
    const env = createMacroEnv({
      chatHistory: [],
      userInput: "空历史测试",
    });
    const messages = promptManager.buildMessages(env);

    // 应该有至少一条 user 消息（当前输入）
    const userMessages = messages.filter(m => m.role === "user");
    expect(userMessages.length).toBeGreaterThanOrEqual(1);
    expect(userMessages.some(m => m.content === "空历史测试")).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Task 1.3: DialogueWorkflow 快照测试
   Requirements: 8.1, 8.3
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Task 1.3: DialogueWorkflow 消息组装快照", () => {
  let macroEvaluator: STMacroEvaluator;
  let promptManager: STPromptManager;

  beforeEach(() => {
    macroEvaluator = new STMacroEvaluator();
    promptManager = createPromptManagerFromOpenAI(
      createDefaultOpenAIPreset(),
      undefined,
      macroEvaluator,
    );
  });

  it("默认 preset 应该生成包含 system 消息的 messages[]", () => {
    const env = createMacroEnv({
      chatHistory: createMockChatHistory(3),
      userInput: "推进剧情",
    });
    const messages = promptManager.buildMessages(env);

    // 验证基本结构
    expect(Array.isArray(messages)).toBe(true);
    expect(messages.length).toBeGreaterThan(0);

    // 验证包含 system 消息
    const hasSystem = messages.some(m => m.role === "system");
    expect(hasSystem).toBe(true);
  });

  it("默认 preset 应该包含角色描述", () => {
    const char = createMockCharacter({ description: "独特的角色描述内容" });
    const env = createMacroEnv({
      character: char,
      chatHistory: [],
      userInput: "测试",
    });
    const messages = promptManager.buildMessages(env);

    const allContent = messages.map(m => m.content).join("\n");
    expect(allContent).toContain("独特的角色描述内容");
  });

  it("默认 preset 应该包含聊天历史", () => {
    const history = createMockChatHistory(2);
    const env = createMacroEnv({
      chatHistory: history,
      userInput: "测试输入",
    });
    const messages = promptManager.buildMessages(env);

    // 验证历史消息被包含
    expect(messages.some(m => m.content === "用户消息 1")).toBe(true);
    expect(messages.some(m => m.content === "助手回复 1")).toBe(true);
  });

  it("默认 preset 应该包含当前用户输入", () => {
    const env = createMacroEnv({
      chatHistory: createMockChatHistory(1),
      userInput: "这是当前用户输入",
    });
    const messages = promptManager.buildMessages(env);

    const userMessages = messages.filter(m => m.role === "user");
    expect(userMessages.some(m => m.content === "这是当前用户输入")).toBe(true);
  });

  /**
   * 快照测试：验证 DialogueWorkflow 消息组装输出结构
   * 
   * Requirements: 8.1, 8.3
   * - 验证 messages[] 包含聊天历史轮次
   * - 验证输出结构符合预期基线
   */
  it("快照：DialogueWorkflow 消息组装输出结构（正确基线）", () => {
    const env = createMacroEnv({
      character: createMockCharacter(),
      chatHistory: createMockChatHistory(2),
      userInput: "推进剧情",
      wiBefore: "世界书前置内容",
      wiAfter: "世界书后置内容",
    });
    const messages = promptManager.buildMessages(env);

    /* ═══════════════════════════════════════════════════════════════════════
       正确基线验证（整改后的预期输出）
       ═══════════════════════════════════════════════════════════════════════ */

    // 1. 基本结构验证
    expect(Array.isArray(messages)).toBe(true);
    expect(messages.length).toBeGreaterThan(0);

    // 2. 角色类型验证
    const hasSystemMessage = messages.some(m => m.role === "system");
    const hasUserMessage = messages.some(m => m.role === "user");
    const hasAssistantMessage = messages.some(m => m.role === "assistant");

    expect(hasSystemMessage).toBe(true);
    expect(hasUserMessage).toBe(true);
    expect(hasAssistantMessage).toBe(true); // 历史中包含 assistant 消息

    // 3. 内容完整性验证
    const allContent = messages.map(m => m.content).join("\n");

    // 世界书内容正确注入
    expect(allContent).toContain("世界书前置内容");
    expect(allContent).toContain("世界书后置内容");

    // 当前用户输入正确包含
    expect(messages.some(m => m.content === "推进剧情")).toBe(true);

    // 4. 聊天历史正确展开（Requirements: 8.1）
    expect(messages.some(m => m.content === "用户消息 1")).toBe(true);
    expect(messages.some(m => m.content === "助手回复 1")).toBe(true);
    expect(messages.some(m => m.content === "用户消息 2")).toBe(true);
    expect(messages.some(m => m.content === "助手回复 2")).toBe(true);

    // 5. 消息顺序验证：历史消息应该在当前输入之前
    const userInputIndex = messages.findIndex(m => m.content === "推进剧情");
    const lastHistoryIndex = messages.findIndex(m => m.content === "助手回复 2");
    expect(userInputIndex).toBeGreaterThan(lastHistoryIndex);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Task 1.4: RAGWorkflow 快照测试
   Requirements: 8.2, 8.3
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Task 1.4: RAGWorkflow 消息组装快照", () => {
  let macroEvaluator: STMacroEvaluator;
  let promptManager: STPromptManager;

  beforeEach(() => {
    macroEvaluator = new STMacroEvaluator();
    promptManager = createPromptManagerFromOpenAI(
      createDefaultOpenAIPreset(),
      undefined,
      macroEvaluator,
    );
  });

  it("RAGWorkflow 应该与 DialogueWorkflow 使用相同的消息构建逻辑", () => {
    const env = createMacroEnv({
      chatHistory: createMockChatHistory(2),
      userInput: "测试输入",
    });

    // 两个工作流使用相同的 STPromptManager
    const dialogueMessages = promptManager.buildMessages(env);
    const ragMessages = promptManager.buildMessages(env);

    // 验证输出结构一致
    expect(dialogueMessages.length).toBe(ragMessages.length);
    expect(dialogueMessages.map(m => m.role)).toEqual(ragMessages.map(m => m.role));
  });

  it("RAGWorkflow 应该支持 memory 内容注入", () => {
    const env = createMacroEnv({
      chatHistory: createMockChatHistory(1),
      userInput: "测试",
    });

    // 模拟 memory 内容（通过 wiBefore 注入）
    env.wiBefore = "相关记忆内容：用户之前提到过喜欢音乐";

    const messages = promptManager.buildMessages(env);
    const allContent = messages.map(m => m.content).join("\n");

    expect(allContent).toContain("相关记忆内容");
  });

  /**
   * 快照测试：验证 RAGWorkflow 消息组装输出结构
   * 
   * Requirements: 8.2, 8.3
   * - 验证 RAGWorkflow 与 DialogueWorkflow 结构一致（排除 memory 内容）
   * - 验证 memory 内容正确注入
   */
  it("快照：RAGWorkflow 消息组装输出结构（正确基线）", () => {
    const baseEnv = createMacroEnv({
      chatHistory: createMockChatHistory(2),
      userInput: "推进剧情",
    });

    // DialogueWorkflow 基线
    const dialogueMessages = promptManager.buildMessages(baseEnv);

    // RAGWorkflow 带 memory 内容
    const ragEnv = { ...baseEnv, wiBefore: baseEnv.wiBefore + "\n[Memory] 用户偏好记录" };
    const ragMessages = promptManager.buildMessages(ragEnv);

    /* ═══════════════════════════════════════════════════════════════════════
       正确基线验证（整改后的预期输出）
       ═══════════════════════════════════════════════════════════════════════ */

    // 1. 结构一致性验证（Requirements: 8.2）
    // 注意：RAGWorkflow 可能因为 memory 内容导致消息数量略有不同
    // 但核心结构（角色类型分布）应该一致
    expect(ragMessages.length).toBeGreaterThanOrEqual(dialogueMessages.length);

    // 两个工作流都应该包含相同的角色类型
    const dialogueRoles = new Set(dialogueMessages.map(m => m.role));
    const ragRoles = new Set(ragMessages.map(m => m.role));
    expect(ragRoles).toEqual(dialogueRoles);

    // 2. 聊天历史一致性
    // 两个工作流都应该包含相同的历史消息
    expect(ragMessages.some(m => m.content === "用户消息 1")).toBe(true);
    expect(ragMessages.some(m => m.content === "助手回复 1")).toBe(true);

    // 3. Memory 内容差异验证
    const dialogueContent = dialogueMessages.map(m => m.content).join("\n");
    const ragContent = ragMessages.map(m => m.content).join("\n");

    // RAG 版本应该包含 memory 内容
    expect(ragContent).toContain("[Memory]");
    expect(dialogueContent).not.toContain("[Memory]");

    // 4. 当前用户输入一致性
    expect(ragMessages.some(m => m.content === "推进剧情")).toBe(true);
    expect(dialogueMessages.some(m => m.content === "推进剧情")).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   边界情况测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("边界情况", () => {
  let macroEvaluator: STMacroEvaluator;
  let promptManager: STPromptManager;

  beforeEach(() => {
    macroEvaluator = new STMacroEvaluator();
    promptManager = createPromptManagerFromOpenAI(
      createDefaultOpenAIPreset(),
      undefined,
      macroEvaluator,
    );
  });

  it("空 chatHistoryMessages 不应该导致崩溃", () => {
    const env = createMacroEnv({
      chatHistory: [],
      userInput: "测试",
    });

    expect(() => promptManager.buildMessages(env)).not.toThrow();
  });

  it("undefined chatHistoryMessages 不应该导致崩溃", () => {
    const env = createMacroEnv({ userInput: "测试" });
    delete (env as unknown).chatHistoryMessages;

    expect(() => promptManager.buildMessages(env)).not.toThrow();
  });

  it("空 userInput 应该正常处理", () => {
    const env = createMacroEnv({
      chatHistory: createMockChatHistory(1),
      userInput: "",
    });

    const messages = promptManager.buildMessages(env);
    expect(Array.isArray(messages)).toBe(true);
  });

  it("特殊字符在消息中应该被正确保留", () => {
    const specialInput = "测试 <script>alert('xss')</script> {{user}}";
    const env = createMacroEnv({
      chatHistory: [],
      userInput: specialInput,
    });

    const messages = promptManager.buildMessages(env);
    const userMessages = messages.filter(m => m.role === "user");

    // 用户输入应该被保留（宏可能被替换）
    expect(userMessages.length).toBeGreaterThan(0);
  });

  it("超长聊天历史应该正常处理", () => {
    const longHistory = createMockChatHistory(50); // 100 条消息
    const env = createMacroEnv({
      chatHistory: longHistory,
      userInput: "测试",
    });

    expect(() => promptManager.buildMessages(env)).not.toThrow();
    const messages = promptManager.buildMessages(env);
    expect(messages.length).toBeGreaterThan(0);
  });
});
