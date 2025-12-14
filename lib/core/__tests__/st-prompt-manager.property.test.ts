/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              STPromptManager 属性测试 - chatHistory 展开                    ║
 * ║                                                                            ║
 * ║  **Feature: message-assembly-remediation, Property 6**                     ║
 * ║  **Validates: Requirements 3.1, 3.2, 3.4**                                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { STPromptManager, createPromptManagerFromOpenAI } from "@/lib/core/prompt";
import { STMacroEvaluator } from "@/lib/core/st-macro-evaluator";
import type { MacroEnv, STOpenAIPreset, ChatMessage } from "@/lib/core/st-preset-types";

/* ═══════════════════════════════════════════════════════════════════════════
   测试工具
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 创建包含 chatHistory marker 的标准 preset
 */
function createPresetWithChatHistoryMarker(): STOpenAIPreset {
  return {
    prompts: [
      {
        identifier: "main",
        name: "Main Prompt",
        system_prompt: true,
        role: "system",
        content: "You are {{char}}.",
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
        { identifier: "chatHistory", enabled: true },
      ],
    }],
    temperature: 1,
    squash_system_messages: false,
  };
}

/**
 * 创建基础 MacroEnv
 */
function createBaseEnv(overrides: Partial<MacroEnv> = {}): MacroEnv {
  return {
    user: "User",
    char: "Assistant",
    ...overrides,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   生成器定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成有效的聊天消息（非空内容）
 */
const validChatMessageArb = fc.record({
  role: fc.constantFrom("user" as const, "assistant" as const),
  content: fc.string({ minLength: 1, maxLength: 200 }),
});

/**
 * 生成聊天历史数组
 */
const chatHistoryArb = fc.array(validChatMessageArb, { minLength: 0, maxLength: 20 });

/**
 * 生成非空白用户输入
 */
const nonEmptyUserInputArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/* ═══════════════════════════════════════════════════════════════════════════
   Property 6: chatHistory marker 展开正确性
   **Validates: Requirements 3.1, 3.2, 3.4**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 6: chatHistory marker 展开正确性", () => {
  let macroEvaluator: STMacroEvaluator;
  let promptManager: STPromptManager;

  beforeEach(() => {
    macroEvaluator = new STMacroEvaluator();
    promptManager = createPromptManagerFromOpenAI(
      createPresetWithChatHistoryMarker(),
      undefined,
      macroEvaluator,
    );
  });

  /* ─────────────────────────────────────────────────────────────────────────
     Requirement 3.1: 插入所有历史消息
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * **Feature: message-assembly-remediation, Property 6**
   * **Validates: Requirements 3.1**
   *
   * *For any* chatHistoryMessages 数组，当 STPromptManager 遇到 chatHistory marker 时，
   * 系统应该将所有历史消息插入到 messages[] 中
   */
  it("3.1: *For any* chatHistoryMessages, SHALL insert all history messages", () => {
    fc.assert(
      fc.property(
        chatHistoryArb,
        nonEmptyUserInputArb,
        (chatHistory, userInput) => {
          const env = createBaseEnv({
            chatHistoryMessages: chatHistory,
            userInput,
          });
          const messages = promptManager.buildMessages(env);

          // 验证：每条历史消息都应该出现在输出中
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

  /* ─────────────────────────────────────────────────────────────────────────
     Requirement 3.2: 追加当前用户输入
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * **Feature: message-assembly-remediation, Property 6**
   * **Validates: Requirements 3.2**
   *
   * *For any* userInput，当 chatHistory marker 展开完成后，
   * 当前用户输入应该作为最后一条 user 消息添加
   */
  it("3.2: *For any* userInput, SHALL append as final user message", () => {
    fc.assert(
      fc.property(
        chatHistoryArb,
        nonEmptyUserInputArb,
        (chatHistory, userInput) => {
          const env = createBaseEnv({
            chatHistoryMessages: chatHistory,
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

  /* ─────────────────────────────────────────────────────────────────────────
     Requirement 3.3: 空历史时只插入用户输入
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * **Feature: message-assembly-remediation, Property 6**
   * **Validates: Requirements 3.3 (隐含)**
   *
   * *For any* userInput，当 chatHistoryMessages 为空时，
   * 应该只插入当前用户输入作为 user 消息
   */
  it("3.3: when chatHistoryMessages is empty, SHALL insert only userInput", () => {
    fc.assert(
      fc.property(
        nonEmptyUserInputArb,
        (userInput) => {
          const env = createBaseEnv({
            chatHistoryMessages: [],
            userInput,
          });
          const messages = promptManager.buildMessages(env);

          // 应该有且仅有一条 user 消息（当前输入）
          const userMessages = messages.filter(m => m.role === "user");
          expect(userMessages.length).toBe(1);
          expect(userMessages[0].content).toBe(userInput);
        },
      ),
      { numRuns: 100 },
    );
  });

  /* ─────────────────────────────────────────────────────────────────────────
     Requirement 3.4: 保持原始消息顺序
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * **Feature: message-assembly-remediation, Property 6**
   * **Validates: Requirements 3.4**
   *
   * *For any* chatHistoryMessages，展开后应该保持原始消息顺序
   *
   * 注意：过滤掉有重复消息的用例，因为 findIndex 无法正确处理重复消息的顺序验证
   */
  it("3.4: *For any* chatHistoryMessages, SHALL preserve original order", () => {
    // 辅助函数：检查数组是否有重复消息
    const hasNoDuplicates = (msgs: ChatMessage[]) => {
      const seen = new Set<string>();
      for (const m of msgs) {
        const key = `${m.role}:${m.content}`;
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return true;
    };

    fc.assert(
      fc.property(
        chatHistoryArb.filter(h => h.length >= 2 && hasNoDuplicates(h)),
        nonEmptyUserInputArb,
        (chatHistory, userInput) => {
          const env = createBaseEnv({
            chatHistoryMessages: chatHistory,
            userInput,
          });
          const messages = promptManager.buildMessages(env);

          // 提取输出中属于历史的消息（排除当前 userInput）
          const outputHistoryMsgs: ChatMessage[] = [];
          for (const msg of messages) {
            // 跳过当前用户输入
            if (msg.role === "user" && msg.content === userInput) continue;

            const isHistoryMsg = chatHistory.some(h =>
              h.role === msg.role && h.content === msg.content,
            );
            if (isHistoryMsg) {
              outputHistoryMsgs.push(msg);
            }
          }

          // 验证顺序：输出中的历史消息应该保持原始顺序
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

  /* ─────────────────────────────────────────────────────────────────────────
     边界情况
     ───────────────────────────────────────────────────────────────────────── */

  it("undefined chatHistoryMessages 应该被视为空数组", () => {
    const env = createBaseEnv({ userInput: "test input" });
    // 不设置 chatHistoryMessages

    const messages = promptManager.buildMessages(env);

    // 应该有 user 消息
    const userMessages = messages.filter(m => m.role === "user");
    expect(userMessages.length).toBeGreaterThanOrEqual(1);
  });

  it("空白 userInput 不应该产生 user 消息", () => {
    const env = createBaseEnv({
      chatHistoryMessages: [],
      userInput: "   ", // 纯空白
    });

    const messages = promptManager.buildMessages(env);

    // 纯空白输入不应该产生 user 消息
    const userMessages = messages.filter(m => m.role === "user");
    expect(userMessages.length).toBe(0);
  });
});
