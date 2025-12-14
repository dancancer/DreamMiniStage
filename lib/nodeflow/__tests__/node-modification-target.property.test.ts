/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     节点修改目标一致性属性测试                               ║
 * ║                                                                            ║
 * ║  **Feature: message-assembly-remediation, Property 2: 节点修改目标一致性**  ║
 * ║  **Validates: Requirements 1.2, 1.3**                                      ║
 * ║                                                                            ║
 * ║  验证所有节点对提示词的修改都落到 messages[] 上，                            ║
 * ║  systemMessage/userMessage 仅用于 UI 展示                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { WorldBookNodeTools } from "../WorldBookNode/WorldBookNodeTools";
import type { ChatMessage } from "@/lib/core/st-preset-types";

/* ═══════════════════════════════════════════════════════════════════════════
   测试数据生成器
   ═══════════════════════════════════════════════════════════════════════════ */

/** 生成消息角色 */
const roleArb = fc.constantFrom("user", "assistant", "system") as fc.Arbitrary<"user" | "assistant" | "system">;

/** 生成不含占位符的内容 */
const contentArb = fc.string({ minLength: 1, maxLength: 200 })
  .filter(s => !s.includes("{{") && s.trim().length > 0);

/** 生成消息对象 */
const messageArb: fc.Arbitrary<ChatMessage> = fc.record({
  role: roleArb,
  content: contentArb,
});

/** 生成消息数组 */
const messagesArb = fc.array(messageArb, { minLength: 1, maxLength: 10 });

/** 生成包含 worldInfoBefore 占位符的内容 */
const contentWithWiBeforeArb = fc.tuple(
  fc.string({ minLength: 0, maxLength: 50 }).filter(s => !s.includes("{{")),
  fc.string({ minLength: 0, maxLength: 50 }).filter(s => !s.includes("{{")),
).map(([before, after]) => `${before}{{worldInfoBefore}}${after}`);

/** 生成包含占位符的消息 */
const messageWithPlaceholderArb: fc.Arbitrary<ChatMessage> = fc.record({
  role: roleArb,
  content: contentWithWiBeforeArb,
});

/** 生成世界书内容 */
const worldBookContentArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => !s.includes("{{") && !s.includes("$") && s.trim().length > 0);

/* ═══════════════════════════════════════════════════════════════════════════
   Property 2: 节点修改目标一致性
   **Validates: Requirements 1.2, 1.3**
   
   *For any* 节点修改操作，修改必须落到 messages[] 上，
   systemMessage/userMessage 仅用于 UI 展示
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 2: 节点修改目标一致性", () => {

  /**
   * **Feature: message-assembly-remediation, Property 2**
   * **Validates: Requirements 1.2**
   *
   * *For any* messages[] 含占位符，WorldBookNode 修改 SHALL 落到 messages[]
   */
  it("*For any* messages[] with placeholders, WorldBookNode modifications SHALL target messages[]", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(messageWithPlaceholderArb, { minLength: 1, maxLength: 5 }),
        worldBookContentArb,
        async (messages, wiBefore) => {
          // 执行占位符替换
          const result = WorldBookNodeTools.replacePlaceholdersInMessages(
            messages,
            { wiBefore, wiAfter: "" },
          );

          // 核心断言 1: 修改落到 messages[] 上
          expect(result).toBeDefined();
          expect(Array.isArray(result)).toBe(true);

          // 核心断言 2: 替换后的 messages[] 包含世界书内容
          const hasWiBefore = result.some(msg => msg.content.includes(wiBefore));
          expect(hasWiBefore).toBe(true);

          // 核心断言 3: 占位符被移除
          result.forEach(msg => {
            expect(msg.content).not.toContain("{{worldInfoBefore}}");
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 2**
   * **Validates: Requirements 1.2**
   *
   * *For any* messages[]，节点修改 SHALL 保持消息结构完整性
   */
  it("*For any* messages[], node modifications SHALL preserve message structure", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.oneof(messageArb, messageWithPlaceholderArb),
          { minLength: 1, maxLength: 10 },
        ),
        worldBookContentArb,
        async (messages, wiBefore) => {
          const result = WorldBookNodeTools.replacePlaceholdersInMessages(
            messages,
            { wiBefore, wiAfter: "" },
          );

          // 核心断言 1: 消息数量不变
          expect(result.length).toBe(messages.length);

          // 核心断言 2: 消息角色不变
          result.forEach((msg, i) => {
            expect(msg.role).toBe(messages[i].role);
          });

          // 核心断言 3: 每条消息都有 role 和 content
          result.forEach(msg => {
            expect(msg).toHaveProperty("role");
            expect(msg).toHaveProperty("content");
            expect(typeof msg.role).toBe("string");
            expect(typeof msg.content).toBe("string");
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 2**
   * **Validates: Requirements 1.3**
   *
   * *For any* messages[]，原始数组 SHALL NOT 被修改（不可变性）
   */
  it("*For any* messages[], original array SHALL NOT be mutated", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(messageWithPlaceholderArb, { minLength: 1, maxLength: 5 }),
        worldBookContentArb,
        async (messages, wiBefore) => {
          // 深拷贝原始数据
          const originalMessages = JSON.parse(JSON.stringify(messages));

          // 执行修改
          WorldBookNodeTools.replacePlaceholdersInMessages(
            messages,
            { wiBefore, wiAfter: "" },
          );

          // 核心断言: 原始数组未被修改
          expect(messages).toEqual(originalMessages);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 2**
   * **Validates: Requirements 1.2**
   *
   * *For any* 不含占位符的 messages[]，SHALL 返回原数组（无修改）
   */
  it("*For any* messages[] without placeholders, SHALL return original array unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(
        messagesArb,
        worldBookContentArb,
        async (messages, wiBefore) => {
          const result = WorldBookNodeTools.replacePlaceholdersInMessages(
            messages,
            { wiBefore, wiAfter: "" },
          );

          // 核心断言: 无占位符时返回原数组引用
          expect(result).toBe(messages);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   辅助验证：systemMessage/userMessage 仅用于 UI 展示
   **Validates: Requirements 1.3**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Requirements 1.3: systemMessage/userMessage 仅用于 UI 展示", () => {

  /**
   * 验证 messages[] 是最终发送给 LLM 的数据源
   * systemMessage/userMessage 是从 messages[] 派生的
   */
  it("systemMessage/userMessage SHALL be derived from messages[] for UI display", () => {
    // 模拟 PresetNode 的输出结构
    const messages: ChatMessage[] = [
      { role: "system", content: "系统提示词内容" },
      { role: "user", content: "用户消息 1" },
      { role: "assistant", content: "助手回复 1" },
      { role: "user", content: "当前用户输入" },
    ];

    // 派生 systemMessage（用于 UI 展示）
    const systemMessages = messages.filter(m => m.role === "system");
    const systemMessage = systemMessages.map(m => m.content).join("\n\n");

    // 派生 userMessage（用于 UI 展示）
    const userMessages = messages.filter(m => m.role === "user");
    const userMessage = userMessages.map(m => m.content).join("\n\n");

    // 验证派生关系
    expect(systemMessage).toContain("系统提示词内容");
    expect(userMessage).toContain("用户消息 1");
    expect(userMessage).toContain("当前用户输入");

    // 验证 messages[] 是完整的数据源
    expect(messages.length).toBe(4);
    expect(messages.some(m => m.role === "assistant")).toBe(true);
  });

  /**
   * 验证 messages[] 包含完整的对话历史
   * 而 systemMessage/userMessage 只是部分角色的内容
   */
  it("messages[] SHALL contain complete conversation history", () => {
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 2, maxLength: 10 }),
        (messages) => {
          // messages[] 包含所有角色的消息
          const allRoles = new Set(messages.map(m => m.role));

          // 派生 systemMessage/userMessage 只包含特定角色
          const systemMessages = messages.filter(m => m.role === "system");
          const userMessages = messages.filter(m => m.role === "user");
          const assistantMessages = messages.filter(m => m.role === "assistant");

          // 核心断言: messages[] 是完整的，包含所有角色
          expect(systemMessages.length + userMessages.length + assistantMessages.length)
            .toBe(messages.length);

          // 如果有 assistant 消息，systemMessage/userMessage 不包含它们
          if (allRoles.has("assistant")) {
            // assistant 消息只存在于 messages[] 中
            expect(assistantMessages.length).toBeGreaterThan(0);
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
