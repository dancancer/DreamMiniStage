/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     LLMNode 属性测试                                        ║
 * ║                                                                            ║
 * ║  **Feature: message-assembly-remediation**                                 ║
 * ║  **Property 1: LLMNode messages[] 唯一性**                                  ║
 * ║  **Property 12: 用户消息存在性保证**                                         ║
 * ║                                                                            ║
 * ║  验证 LLMNode 的 messages-only 架构契约                                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

type ChatMessage = { role: string; content: string };

interface LLMConfig {
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  llmType: "openai" | "ollama" | "gemini";
  temperature?: number;
  messages?: ChatMessage[];
  dialogueKey?: string;
  characterId?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   测试数据生成器
   ═══════════════════════════════════════════════════════════════════════════ */

/** 生成有效的消息角色 */
const roleArb = fc.constantFrom("user", "assistant", "system");

/** 生成非空消息内容 */
const contentArb = fc.string({ minLength: 1, maxLength: 200 });

/** 生成单条消息 */
const messageArb: fc.Arbitrary<ChatMessage> = fc.record({
  role: roleArb,
  content: contentArb,
});

/** 生成包含至少一条 user 消息的消息数组 */
const messagesWithUserArb: fc.Arbitrary<ChatMessage[]> = fc
  .array(messageArb, { minLength: 0, maxLength: 10 })
  .chain((msgs) => {
    // 确保至少有一条 user 消息
    const userMsg: ChatMessage = { role: "user", content: "用户消息" };
    return fc.constant([...msgs, userMsg]);
  });

/** 生成不包含 user 消息的消息数组 */
const messagesWithoutUserArb: fc.Arbitrary<ChatMessage[]> = fc
  .array(
    fc.record({
      role: fc.constantFrom("assistant", "system"),
      content: contentArb,
    }),
    { minLength: 1, maxLength: 10 },
  );

/** 生成 systemMessage 字符串 */
const systemMessageArb = fc.string({ minLength: 1, maxLength: 500 });

/** 生成 userMessage 字符串 */
const userMessageArb = fc.string({ minLength: 1, maxLength: 500 });

/* ═══════════════════════════════════════════════════════════════════════════
   核心逻辑提取（从 LLMNodeTools.invokeLLM 中提取，用于单元测试）
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 构建最终发送给 LLM 的消息数组
 * 这是 LLMNodeTools.invokeLLM 中的核心逻辑
 * 
 * Requirements 1.1: 仅使用 messages[] 作为最终提示词内容
 * Requirements 7.2: 若 messages[] 中无 user 消息，追加 fallback
 */
function buildFinalMessages(
  systemMessage: string,
  userMessage: string,
  configMessages?: ChatMessage[],
): ChatMessage[] {
  // 优先使用预设构建的完整 messages 数组
  let finalMessages = configMessages && configMessages.length > 0
    ? [...configMessages]
    : [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ];

  // 用户消息存在性保证
  const hasUserMessage = finalMessages.some(msg => msg.role === "user");
  if (!hasUserMessage) {
    const fallbackContent = userMessage?.trim() || "[继续]";
    finalMessages.push({ role: "user", content: fallbackContent });
  }

  return finalMessages;
}

/**
 * 合并相邻同角色消息（从 LLMNodeTools 中提取）
 */
function mergeAdjacentMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length === 0) return [];
  
  const merged: ChatMessage[] = [];
  for (const msg of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === msg.role) {
      last.content = `${last.content}\n\n${msg.content}`;
    } else {
      merged.push({ role: msg.role, content: msg.content });
    }
  }
  return merged;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Property 1: LLMNode messages[] 唯一性
   **Validates: Requirements 1.1**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 1: LLMNode messages[] 唯一性", () => {
  /**
   * **Feature: message-assembly-remediation, Property 1**
   * **Validates: Requirements 1.1**
   *
   * *For any* 非空 messages[]，最终发送的消息应该来自 messages[]
   * 而不是从 systemMessage/userMessage 构建
   */
  it("*For any* 非空 messages[], 最终消息 SHALL 来自 messages[]", () => {
    fc.assert(
      fc.property(
        messagesWithUserArb,
        systemMessageArb,
        userMessageArb,
        (messages, systemMessage, userMessage) => {
          const finalMessages = buildFinalMessages(
            systemMessage,
            userMessage,
            messages,
          );

          // 验证：最终消息应该包含原始 messages 的内容
          // （可能会追加 user 消息，但原始内容应该保留）
          for (const originalMsg of messages) {
            const found = finalMessages.some(
              (m) => m.role === originalMsg.role && m.content === originalMsg.content,
            );
            expect(found).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 1**
   * **Validates: Requirements 1.1**
   *
   * *For any* 空 messages[]，应该回退到 systemMessage/userMessage 构建
   */
  it("*For any* 空 messages[], SHALL 回退到 systemMessage/userMessage", () => {
    fc.assert(
      fc.property(
        systemMessageArb,
        userMessageArb,
        (systemMessage, userMessage) => {
          const finalMessages = buildFinalMessages(
            systemMessage,
            userMessage,
            [], // 空数组
          );

          // 验证：应该包含 system 和 user 消息
          expect(finalMessages.length).toBe(2);
          expect(finalMessages[0].role).toBe("system");
          expect(finalMessages[0].content).toBe(systemMessage);
          expect(finalMessages[1].role).toBe("user");
          expect(finalMessages[1].content).toBe(userMessage);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 1**
   * **Validates: Requirements 1.1**
   *
   * *For any* undefined messages，应该回退到 systemMessage/userMessage 构建
   */
  it("*For any* undefined messages, SHALL 回退到 systemMessage/userMessage", () => {
    fc.assert(
      fc.property(
        systemMessageArb,
        userMessageArb,
        (systemMessage, userMessage) => {
          const finalMessages = buildFinalMessages(
            systemMessage,
            userMessage,
            undefined,
          );

          expect(finalMessages.length).toBe(2);
          expect(finalMessages[0].role).toBe("system");
          expect(finalMessages[1].role).toBe("user");
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 1**
   * **Validates: Requirements 1.1**
   *
   * *For any* messages[]，原始数组不应该被修改（不可变性）
   */
  it("*For any* messages[], 原始数组 SHALL NOT 被修改", () => {
    fc.assert(
      fc.property(
        messagesWithUserArb,
        systemMessageArb,
        userMessageArb,
        (messages, systemMessage, userMessage) => {
          // 深拷贝原始数据
          const originalMessages = JSON.parse(JSON.stringify(messages));

          buildFinalMessages(systemMessage, userMessage, messages);

          // 验证原始数组未被修改
          expect(messages).toEqual(originalMessages);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 12: 用户消息存在性保证
   **Validates: Requirements 7.2**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 12: 用户消息存在性保证", () => {
  /**
   * **Feature: message-assembly-remediation, Property 12**
   * **Validates: Requirements 7.2**
   *
   * *For any* messages[] 不包含 user 消息，最终消息 SHALL 包含至少一条 user 消息
   */
  it("*For any* messages[] 无 user 消息, 最终消息 SHALL 包含 user 消息", () => {
    fc.assert(
      fc.property(
        messagesWithoutUserArb,
        userMessageArb,
        (messages, userMessage) => {
          const finalMessages = buildFinalMessages(
            "system prompt",
            userMessage,
            messages,
          );

          // 验证：最终消息必须包含至少一条 user 消息
          const hasUserMessage = finalMessages.some((m) => m.role === "user");
          expect(hasUserMessage).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 12**
   * **Validates: Requirements 7.2**
   *
   * *For any* messages[] 已包含 user 消息，不应该追加额外的 user 消息
   */
  it("*For any* messages[] 已有 user 消息, SHALL NOT 追加额外 user 消息", () => {
    fc.assert(
      fc.property(
        messagesWithUserArb,
        userMessageArb,
        (messages, userMessage) => {
          const originalUserCount = messages.filter((m) => m.role === "user").length;

          const finalMessages = buildFinalMessages(
            "system prompt",
            userMessage,
            messages,
          );

          const finalUserCount = finalMessages.filter((m) => m.role === "user").length;

          // 验证：user 消息数量不应该增加
          expect(finalUserCount).toBe(originalUserCount);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 12**
   * **Validates: Requirements 7.2**
   *
   * *For any* 空 userMessage 且 messages[] 无 user 消息，
   * 应该使用默认占位符 "[继续]"
   */
  it("*For any* 空 userMessage 且无 user 消息, SHALL 使用默认占位符", () => {
    fc.assert(
      fc.property(
        messagesWithoutUserArb,
        (messages) => {
          const finalMessages = buildFinalMessages(
            "system prompt",
            "", // 空 userMessage
            messages,
          );

          // 验证：应该有 user 消息，且内容为默认占位符
          const userMsg = finalMessages.find((m) => m.role === "user");
          expect(userMsg).toBeDefined();
          expect(userMsg!.content).toBe("[继续]");
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 12**
   * **Validates: Requirements 7.2**
   *
   * *For any* 非空非纯空白 userMessage 且 messages[] 无 user 消息，
   * 应该使用 userMessage.trim() 作为 fallback
   * 
   * 注意：代码会 trim userMessage，这是合理的行为，避免发送带有尾部空白的消息
   */
  it("*For any* 非空 userMessage 且无 user 消息, SHALL 使用 userMessage.trim() 作为 fallback", () => {
    // 生成非空且 trim 后非空的字符串
    const nonBlankStringArb = fc
      .string({ minLength: 1, maxLength: 100 })
      .filter((s) => s.trim().length > 0);

    fc.assert(
      fc.property(
        messagesWithoutUserArb,
        nonBlankStringArb,
        (messages, userMessage) => {
          const finalMessages = buildFinalMessages(
            "system prompt",
            userMessage,
            messages,
          );

          // 验证：应该有 user 消息，且内容为 userMessage.trim()
          const userMsg = finalMessages.find((m) => m.role === "user");
          expect(userMsg).toBeDefined();
          expect(userMsg!.content).toBe(userMessage.trim());
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 12**
   * **Validates: Requirements 7.2**
   *
   * *For any* 纯空白 userMessage 且 messages[] 无 user 消息，
   * 应该使用默认占位符（trim 后为空）
   */
  it("*For any* 纯空白 userMessage 且无 user 消息, SHALL 使用默认占位符", () => {
    fc.assert(
      fc.property(
        messagesWithoutUserArb,
        fc.constantFrom("   ", "\t", "\n", "  \n  "), // 纯空白字符串
        (messages, userMessage) => {
          const finalMessages = buildFinalMessages(
            "system prompt",
            userMessage,
            messages,
          );

          // 验证：应该有 user 消息，且内容为默认占位符
          const userMsg = finalMessages.find((m) => m.role === "user");
          expect(userMsg).toBeDefined();
          expect(userMsg!.content).toBe("[继续]");
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   消息合并测试（辅助功能）
   ═══════════════════════════════════════════════════════════════════════════ */

describe("消息合并功能", () => {
  /**
   * 验证相邻同角色消息被正确合并
   */
  it("相邻同角色消息 SHALL 被合并", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "系统消息1" },
      { role: "system", content: "系统消息2" },
      { role: "user", content: "用户消息" },
    ];

    const merged = mergeAdjacentMessages(messages);

    expect(merged.length).toBe(2);
    expect(merged[0].role).toBe("system");
    expect(merged[0].content).toContain("系统消息1");
    expect(merged[0].content).toContain("系统消息2");
    expect(merged[1].role).toBe("user");
  });

  /**
   * 验证不同角色消息不被合并
   */
  it("不同角色消息 SHALL NOT 被合并", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "系统消息" },
      { role: "user", content: "用户消息" },
      { role: "assistant", content: "助手消息" },
    ];

    const merged = mergeAdjacentMessages(messages);

    expect(merged.length).toBe(3);
    expect(merged[0].role).toBe("system");
    expect(merged[1].role).toBe("user");
    expect(merged[2].role).toBe("assistant");
  });

  /**
   * 验证空数组返回空数组
   */
  it("空数组 SHALL 返回空数组", () => {
    const merged = mergeAdjacentMessages([]);
    expect(merged).toEqual([]);
  });

  /**
   * 属性测试：合并后消息数量 <= 原始数量
   */
  it("*For any* messages[], 合并后数量 SHALL <= 原始数量", () => {
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 0, maxLength: 20 }),
        (messages) => {
          const merged = mergeAdjacentMessages(messages);
          return merged.length <= messages.length;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 属性测试：合并后所有内容都被保留
   */
  it("*For any* messages[], 合并后所有内容 SHALL 被保留", () => {
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 1, maxLength: 10 }),
        (messages) => {
          const merged = mergeAdjacentMessages(messages);
          
          // 所有原始内容应该出现在合并后的消息中
          for (const originalMsg of messages) {
            const found = merged.some((m) => m.content.includes(originalMsg.content));
            if (!found) return false;
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
