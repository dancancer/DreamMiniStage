/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              Claude 转换器 - 属性测试                                       ║
 * ║                                                                            ║
 * ║  Property 13: Claude 转换完整性                                            ║
 * ║  Validates: Requirements 7.1, 7.2, 7.3, 7.5                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { convertForClaude } from "../../prompt/converters/claude";
import type { ExtendedChatMessage } from "../../st-preset-types";
import { roleArb, contentArb, toolCallArb } from "./generators";

/* ═══════════════════════════════════════════════════════════════════════════
   Claude 专用生成器
   ═══════════════════════════════════════════════════════════════════════════ */

/** 基础消息生成器 */
const basicMessageArb = fc.record({
  role: roleArb,
  content: contentArb,
});

/** 带 tool_calls 的 assistant 消息 */
const assistantWithToolsArb = fc.record({
  role: fc.constant("assistant" as const),
  content: contentArb,
  tool_calls: fc.array(toolCallArb, { minLength: 1, maxLength: 3 }),
});

/** tool 消息 */
const toolMessageArb = fc.record({
  role: fc.constant("tool" as const),
  content: contentArb,
  tool_call_id: fc.string({ minLength: 1, maxLength: 20 }),
});

/** 混合消息数组（含工具） */
const messagesWithToolsArb = fc.array(
  fc.oneof(basicMessageArb, assistantWithToolsArb, toolMessageArb),
  { minLength: 0, maxLength: 20 },
) as fc.Arbitrary<ExtendedChatMessage[]>;

/** 纯基础消息数组 */
const basicMessagesArb = fc.array(basicMessageArb, {
  minLength: 0,
  maxLength: 20,
}) as fc.Arbitrary<ExtendedChatMessage[]>;

/* ═══════════════════════════════════════════════════════════════════════════
   辅助函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 计算前置 system 消息数量
 */
function countLeadingSystem(messages: ExtendedChatMessage[]): number {
  let count = 0;
  for (const msg of messages) {
    if (msg.role === "system") {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * 检查是否有连续同角色消息
 */
function hasConsecutiveSameRole(messages: Array<{ role: string }>): boolean {
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].role === messages[i - 1].role) {
      return true;
    }
  }
  return false;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Property 13: Claude 转换完整性
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 13: Claude 转换完整性", () => {
  /**
   * **Feature: message-post-processing, Property 13: Claude 转换完整性**
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.5**
   *
   * 子属性 13.1: 前置 system 消息应该在 systemPrompt 中
   */
  it("7.1: *For any* messages, leading system SHALL be in systemPrompt", () => {
    fc.assert(
      fc.property(basicMessagesArb, (messages) => {
        const result = convertForClaude(messages);
        const leadingSystemCount = countLeadingSystem(messages);

        // 前置 system 消息数量应该等于 systemPrompt 长度
        // 注意：空内容的 system 消息不会被添加到 systemPrompt
        const nonEmptyLeadingSystem = messages
          .slice(0, leadingSystemCount)
          .filter((msg) => {
            const text =
              typeof msg.content === "string"
                ? msg.content
                : msg.content
                  .filter((p) => p.type === "text")
                  .map((p) => (p as { text: string }).text)
                  .join("");
            return text.trim().length > 0;
          });

        expect(result.systemPrompt.length).toBe(nonEmptyLeadingSystem.length);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 13: Claude 转换完整性**
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.5**
   *
   * 子属性 13.2: 输出消息中不应有 system 角色
   */
  it("7.2: *For any* messages, output SHALL have no system role", () => {
    fc.assert(
      fc.property(basicMessagesArb, (messages) => {
        const result = convertForClaude(messages);

        // 所有输出消息的角色应该是 user 或 assistant
        for (const msg of result.messages) {
          expect(["user", "assistant"]).toContain(msg.role);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 13: Claude 转换完整性**
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.5**
   *
   * 子属性 13.3: 不应有连续同角色消息
   */
  it("7.3: *For any* messages, output SHALL have no consecutive same-role", () => {
    fc.assert(
      fc.property(basicMessagesArb, (messages) => {
        const result = convertForClaude(messages);

        // 不应有连续同角色
        expect(hasConsecutiveSameRole(result.messages)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 13: Claude 转换完整性**
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.5**
   *
   * 子属性 13.4: 空输入应返回占位符消息
   */
  it("7.5: empty input SHALL return placeholder message", () => {
    const result = convertForClaude([]);

    expect(result.messages.length).toBe(1);
    expect(result.messages[0].role).toBe("user");
    expect(result.systemPrompt.length).toBe(0);
  });

  /**
   * **Feature: message-post-processing, Property 13: Claude 转换完整性**
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.5**
   *
   * 子属性 13.5: 全 system 输入应提取到 systemPrompt 并返回占位符
   */
  it("7.5: *For any* all-system input, SHALL extract to systemPrompt and return placeholder", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            role: fc.constant("system" as const),
            content: contentArb,
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (messages) => {
          const result = convertForClaude(messages as ExtendedChatMessage[]);

          // systemPrompt 应该包含所有非空 system 消息
          const nonEmptyCount = messages.filter((m) => m.content.trim()).length;
          expect(result.systemPrompt.length).toBe(nonEmptyCount);

          // messages 应该有占位符
          expect(result.messages.length).toBe(1);
          expect(result.messages[0].role).toBe("user");
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 13: Claude 转换完整性**
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.5**
   *
   * 子属性 13.6: 工具调用转换（useTools=true）
   */
  it("4.4, 4.5: *For any* messages with tools, tool_calls SHALL be converted when useTools=true", () => {
    fc.assert(
      fc.property(messagesWithToolsArb, (messages) => {
        const result = convertForClaude(messages, { useTools: true });

        // 输出消息中不应有 tool_calls 字段
        for (const msg of result.messages) {
          expect((msg as ExtendedChatMessage).tool_calls).toBeUndefined();
        }

        // 不应有 tool 角色
        for (const msg of result.messages) {
          expect(msg.role).not.toBe("tool");
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * 子属性 13.7: 输出至少有一条消息
   */
  it("7.5: *For any* input, output SHALL have at least one message", () => {
    fc.assert(
      fc.property(basicMessagesArb, (messages) => {
        const result = convertForClaude(messages);
        expect(result.messages.length).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: 100 },
    );
  });
});
