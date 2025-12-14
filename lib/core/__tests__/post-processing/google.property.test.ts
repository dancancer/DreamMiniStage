/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              Google 转换器 - 属性测试                                       ║
 * ║                                                                            ║
 * ║  Property 14: Google 转换完整性                                            ║
 * ║  Validates: Requirements 8.1, 8.2, 8.3, 8.4                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { convertForGoogle } from "../../prompt/converters/google";
import type { ExtendedChatMessage } from "../../st-preset-types";
import { roleArb, contentArb } from "./generators";

/* ═══════════════════════════════════════════════════════════════════════════
   Google 专用生成器
   ═══════════════════════════════════════════════════════════════════════════ */

/** 基础消息生成器 */
const basicMessageArb = fc.record({
  role: roleArb,
  content: contentArb,
});

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
   Property 14: Google 转换完整性
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 14: Google 转换完整性", () => {
  /**
   * **Feature: message-post-processing, Property 14: Google 转换完整性**
   * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
   *
   * 子属性 14.1: 前置 system 消息应该在 system_instruction 中
   */
  it("8.1: *For any* messages, leading system SHALL be in system_instruction", () => {
    fc.assert(
      fc.property(basicMessagesArb, (messages) => {
        const result = convertForGoogle(messages);
        const leadingSystemCount = countLeadingSystem(messages);

        // 前置 system 消息数量应该等于 systemInstruction.parts 长度
        // 注意：空内容的 system 消息不会被添加到 systemInstruction
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

        if (nonEmptyLeadingSystem.length > 0) {
          expect(result.systemInstruction).not.toBeNull();
          expect(result.systemInstruction!.parts.length).toBe(
            nonEmptyLeadingSystem.length,
          );
        } else {
          // 无非空 system 消息时，systemInstruction 应为 null
          expect(result.systemInstruction).toBeNull();
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 14: Google 转换完整性**
   * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
   *
   * 子属性 14.2: 输出消息中不应有 system 角色
   */
  it("8.2: *For any* messages, output SHALL have no system role", () => {
    fc.assert(
      fc.property(basicMessagesArb, (messages) => {
        const result = convertForGoogle(messages);

        // 所有输出消息的角色应该是 user 或 model
        for (const msg of result.contents) {
          expect(["user", "model"]).toContain(msg.role);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 14: Google 转换完整性**
   * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
   *
   * 子属性 14.3: assistant 角色应转换为 model
   */
  it("8.3: *For any* messages, assistant SHALL be converted to model", () => {
    fc.assert(
      fc.property(basicMessagesArb, (messages) => {
        const result = convertForGoogle(messages);

        // 输出中不应有 assistant 角色
        for (const msg of result.contents) {
          expect(msg.role).not.toBe("assistant");
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 14: Google 转换完整性**
   * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
   *
   * 子属性 14.4: 不应有连续同角色消息
   */
  it("8.4: *For any* messages, output SHALL have no consecutive same-role", () => {
    fc.assert(
      fc.property(basicMessagesArb, (messages) => {
        const result = convertForGoogle(messages);

        // 不应有连续同角色
        expect(hasConsecutiveSameRole(result.contents)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 14: Google 转换完整性**
   * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
   *
   * 子属性 14.5: 空输入应返回占位符消息
   */
  it("8.5: empty input SHALL return placeholder message", () => {
    const result = convertForGoogle([]);

    expect(result.contents.length).toBe(1);
    expect(result.contents[0].role).toBe("user");
    expect(result.systemInstruction).toBeNull();
  });

  /**
   * **Feature: message-post-processing, Property 14: Google 转换完整性**
   * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
   *
   * 子属性 14.6: 全 system 输入应提取到 systemInstruction 并返回占位符
   */
  it("8.5: *For any* all-system input, SHALL extract to systemInstruction and return placeholder", () => {
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
          const result = convertForGoogle(messages as ExtendedChatMessage[]);

          // systemInstruction 应该包含所有非空 system 消息
          const nonEmptyCount = messages.filter((m) => m.content.trim()).length;

          if (nonEmptyCount > 0) {
            expect(result.systemInstruction).not.toBeNull();
            expect(result.systemInstruction!.parts.length).toBe(nonEmptyCount);
          }

          // contents 应该有占位符
          expect(result.contents.length).toBe(1);
          expect(result.contents[0].role).toBe("user");
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 子属性 14.7: 输出至少有一条消息
   */
  it("8.5: *For any* input, output SHALL have at least one message", () => {
    fc.assert(
      fc.property(basicMessagesArb, (messages) => {
        const result = convertForGoogle(messages);
        expect(result.contents.length).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * 子属性 14.8: 所有输出消息应有 parts 数组格式
   */
  it("8.5: *For any* input, output messages SHALL have parts array", () => {
    fc.assert(
      fc.property(basicMessagesArb, (messages) => {
        const result = convertForGoogle(messages);

        for (const msg of result.contents) {
          expect(Array.isArray(msg.parts)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
