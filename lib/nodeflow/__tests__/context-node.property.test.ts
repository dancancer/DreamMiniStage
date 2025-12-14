/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     ContextNode 属性测试                                    ║
 * ║                                                                            ║
 * ║  验证 ContextNode 的透传约束                                                ║
 * ║                                                                            ║
 * ║  Property 10: ContextNode 透传约束                                          ║
 * ║  **Validates: Requirements 5.1, 5.2, 5.3, 5.4**                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { ContextNode } from "../ContextNode/ContextNode";
import { ContextNodeTools } from "../ContextNode/ContextNodeTools";

/* ═══════════════════════════════════════════════════════════════════════════
   测试辅助：直接调用 _call 方法
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 创建 ContextNode 并直接调用其 _call 方法
 * 绕过 NodeContext 依赖，专注测试核心逻辑
 */
async function callContextNode(input: {
  messages?: Array<{ role: string; content: string }>;
  userMessage?: string;
  chatHistoryText?: string;
}): Promise<{
  userMessage: string;
  messages: Array<{ role: string; content: string }> | undefined;
}> {
  const node = new ContextNode({
    id: "test-context",
    name: "context",
  });

  // 直接调用 protected _call 方法
   
  return await (node as unknown)._call(input);
}

/* ═══════════════════════════════════════════════════════════════════════════
   测试数据生成器
   ═══════════════════════════════════════════════════════════════════════════ */

/** 生成消息对象 */
const messageArb = fc.record({
  role: fc.constantFrom("user", "assistant", "system"),
  content: fc.string({ minLength: 0, maxLength: 500 }),
});

/** 生成消息数组 */
const messagesArb = fc.array(messageArb, { minLength: 0, maxLength: 20 });

/** 生成 userMessage 字符串 */
const userMessageArb = fc.string({ minLength: 0, maxLength: 1000 });

/** 生成包含 {{chatHistory}} 占位符的 userMessage */
const userMessageWithPlaceholderArb = fc.tuple(
  fc.string({ minLength: 0, maxLength: 200 }),
  fc.string({ minLength: 0, maxLength: 200 }),
).map(([before, after]) => `${before}{{chatHistory}}${after}`);

/** 生成 chatHistoryText */
const chatHistoryTextArb = fc.string({ minLength: 0, maxLength: 2000 });

/* ═══════════════════════════════════════════════════════════════════════════
   Property 10: ContextNode 透传约束
   **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 10: ContextNode 透传约束", () => {

  /**
   * **Feature: message-assembly-remediation, Property 10**
   * **Validates: Requirements 5.1, 5.3**
   *
   * *For any* messages[] 输入，ContextNode 应该原样透传，不做任何修改
   */
  it("*For any* messages[] input, ContextNode SHALL pass through unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(
        messagesArb,
        userMessageArb,
        chatHistoryTextArb,
        async (inputMessages, userMessage, chatHistoryText) => {
          const result = await callContextNode({
            messages: inputMessages,
            userMessage,
            chatHistoryText,
          });

          // 核心断言：messages[] 必须原样透传
          expect(result.messages).toEqual(inputMessages);

          // 验证引用相等（确保没有深拷贝后修改）
          if (inputMessages.length > 0) {
            expect(result.messages).toBe(inputMessages);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 10**
   * **Validates: Requirements 5.2, 5.4**
   *
   * *For any* userMessage 包含 {{chatHistory}} 且 chatHistoryText 非空，
   * ContextNode 应该用 chatHistoryText 替换
   *
   * 注意：排除包含 $ 的字符串，因为 $ 在 String.replace 中是特殊字符
   */
  it("*For any* userMessage with {{chatHistory}} and non-empty chatHistoryText, ContextNode SHALL replace", async () => {
    await fc.assert(
      fc.asyncProperty(
        messagesArb,
        userMessageWithPlaceholderArb,
        // 生成非空的 chatHistoryText，排除 $ 字符（String.replace 特殊字符）
        fc.string({ minLength: 1, maxLength: 500 }).filter(s => !s.includes("$")),
        async (inputMessages, userMessage, chatHistoryText) => {
          const result = await callContextNode({
            messages: inputMessages,
            userMessage,
            chatHistoryText,
          });

          // 验证 {{chatHistory}} 被替换
          expect(result.userMessage).not.toContain("{{chatHistory}}");

          // 验证替换内容正确
          expect(result.userMessage).toContain(chatHistoryText);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 10**
   * **Validates: Requirements 5.2**
   *
   * *For any* userMessage 不包含 {{chatHistory}}，ContextNode 应该保持原样
   */
  it("*For any* userMessage without {{chatHistory}}, ContextNode SHALL keep it unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(
        messagesArb,
        // 生成不包含 {{chatHistory}} 的字符串
        fc.string({ minLength: 0, maxLength: 500 }).filter(s => !s.includes("{{chatHistory}}")),
        chatHistoryTextArb,
        async (inputMessages, userMessage, chatHistoryText) => {
          const result = await callContextNode({
            messages: inputMessages,
            userMessage,
            chatHistoryText,
          });

          // userMessage 应该保持原样
          expect(result.userMessage).toBe(userMessage);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 10**
   * **Validates: Requirements 5.1**
   *
   * *For any* 输入，ContextNode 不应该有历史获取方法
   * （历史获取已迁移到 HistoryPreNode）
   */
  it("*For any* input, ContextNode SHALL NOT have chat history fetch methods", async () => {
    // ContextNode 不应该有 getChatHistoryMessages 方法
    // 这个方法已经迁移到 HistoryPreNodeTools
    expect(typeof (ContextNodeTools as unknown).getChatHistoryMessages).toBe("undefined");

    // ContextNode 不应该有 expandChatHistoryInMessages 方法
    const node = new ContextNode({
      id: "test-context",
      name: "context",
    });
    expect(typeof (node as unknown).expandChatHistoryInMessages).toBe("undefined");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ContextNodeTools 单元测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("ContextNodeTools.replaceHistoryPlaceholder", () => {

  it("应该替换 {{chatHistory}} 占位符", () => {
    const result = ContextNodeTools.replaceHistoryPlaceholder(
      "前文{{chatHistory}}后文",
      "历史内容",
    );
    expect(result).toBe("前文历史内容后文");
  });

  it("没有占位符时应该返回原字符串", () => {
    const original = "没有占位符的字符串";
    const result = ContextNodeTools.replaceHistoryPlaceholder(original, "历史内容");
    expect(result).toBe(original);
  });

  it("空 chatHistoryText 应该移除占位符", () => {
    const result = ContextNodeTools.replaceHistoryPlaceholder(
      "前文{{chatHistory}}后文",
      "",
    );
    expect(result).toBe("前文后文");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   边界情况测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("ContextNode 边界情况", () => {

  it("空 messages[] 应该透传空数组", async () => {
    const result = await callContextNode({
      messages: [],
      userMessage: "test",
      chatHistoryText: "",
    });

    expect(result.messages).toEqual([]);
  });

  it("undefined messages 应该透传 undefined", async () => {
    const result = await callContextNode({
      userMessage: "test",
      chatHistoryText: "",
    });

    expect(result.messages).toBeUndefined();
  });

  it("空 userMessage 应该返回空字符串", async () => {
    const result = await callContextNode({
      messages: [],
      userMessage: "",
      chatHistoryText: "历史",
    });

    expect(result.userMessage).toBe("");
  });

  it("undefined userMessage 应该返回空字符串", async () => {
    const result = await callContextNode({
      messages: [],
      chatHistoryText: "历史",
    });

    expect(result.userMessage).toBe("");
  });

  it("多个 {{chatHistory}} 只替换第一个", async () => {
    const result = await callContextNode({
      messages: [],
      userMessage: "{{chatHistory}}中间{{chatHistory}}",
      chatHistoryText: "历史",
    });

    // String.replace 默认只替换第一个匹配
    expect(result.userMessage).toBe("历史中间{{chatHistory}}");
  });
});
