/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              Property 12: Prefill 应用                                     ║
 * ║                                                                            ║
 * ║  **Feature: message-post-processing**                                      ║
 * ║  **Validates: Requirements 6.1, 6.2, 6.3, 6.4**                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { applyPrefill } from "../../prompt/post-processor";
import type { ExtendedChatMessage } from "../../st-preset-types";
import {
  roleArb,
  contentArb,
  toolCallArb,
} from "./generators";

/* ═══════════════════════════════════════════════════════════════════════════
   辅助生成器
   ═══════════════════════════════════════════════════════════════════════════ */

/** 非空 prefill 字符串 */
const nonEmptyPrefillArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

/** 空或纯空白 prefill */
const emptyPrefillArb = fc.oneof(
  fc.constant(""),
  fc.constant("   "),
  fc.constant("\t\t"),
  fc.constant("\n\n"),
  fc.constant("  \t\n  "),
);

/** 不含工具的消息 */
const messageWithoutToolsArb = fc.record({
  role: roleArb,
  content: contentArb,
});

/** 不含工具的消息数组 */
const messagesWithoutToolsArb = fc.array(messageWithoutToolsArb, {
  minLength: 0,
  maxLength: 15,
}) as fc.Arbitrary<ExtendedChatMessage[]>;

/** 以 assistant 结尾的消息数组 */
const messagesEndingWithAssistantArb = fc
  .tuple(
    fc.array(messageWithoutToolsArb, { minLength: 0, maxLength: 10 }),
    fc.record({
      role: fc.constant("assistant" as const),
      content: contentArb,
    }),
  )
  .map(([msgs, last]) => [...msgs, last] as ExtendedChatMessage[]);

/** 不以 assistant 结尾的非空消息数组 */
const messagesNotEndingWithAssistantArb = fc
  .tuple(
    fc.array(messageWithoutToolsArb, { minLength: 0, maxLength: 10 }),
    fc.record({
      role: fc.constantFrom("system" as const, "user" as const),
      content: contentArb,
    }),
  )
  .map(([msgs, last]) => [...msgs, last] as ExtendedChatMessage[]);

/** 带 tool_calls 的消息数组 */
const messagesWithToolCallsArb = fc
  .tuple(
    fc.array(messageWithoutToolsArb, { minLength: 0, maxLength: 5 }),
    fc.record({
      role: fc.constant("assistant" as const),
      content: contentArb,
      tool_calls: fc.array(toolCallArb, { minLength: 1, maxLength: 3 }),
    }),
  )
  .map(([msgs, toolMsg]) => [...msgs, toolMsg] as ExtendedChatMessage[]);

/* ═══════════════════════════════════════════════════════════════════════════
   Property 12: Prefill 应用
   **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 12: Prefill 应用", () => {
  /**
   * **Feature: message-post-processing, Property 12: Prefill 应用**
   * **Validates: Requirements 6.1**
   *
   * 6.1: WHEN prefill string is provided AND last message is assistant
   *      THEN the system SHALL set `prefix: true` on that message
   */
  it("6.1: *For any* messages ending with assistant, SHALL set prefix=true on last", () => {
    fc.assert(
      fc.property(
        messagesEndingWithAssistantArb,
        nonEmptyPrefillArb,
        (messages, prefill) => {
          const result = applyPrefill(messages, prefill);

          // 输出长度应与输入相同（不追加新消息）
          expect(result.length).toBe(messages.length);

          // 最后一条应有 prefix=true
          const last = result[result.length - 1];
          expect(last.prefix).toBe(true);
          expect(last.role).toBe("assistant");
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 12: Prefill 应用**
   * **Validates: Requirements 6.2**
   *
   * 6.2: WHEN prefill string is provided AND last message is not assistant
   *      THEN the system SHALL append new assistant message with prefill content
   */
  it("6.2: *For any* messages not ending with assistant, SHALL append assistant with prefill", () => {
    fc.assert(
      fc.property(
        messagesNotEndingWithAssistantArb,
        nonEmptyPrefillArb,
        (messages, prefill) => {
          const result = applyPrefill(messages, prefill);

          // 输出长度应比输入多 1
          expect(result.length).toBe(messages.length + 1);

          // 最后一条应是新追加的 assistant
          const last = result[result.length - 1];
          expect(last.role).toBe("assistant");
          expect(last.prefix).toBe(true);
          expect(last.content).toBe(prefill.trimEnd());
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 12: Prefill 应用**
   * **Validates: Requirements 6.3**
   *
   * 6.3: WHEN tools are present in the prompt
   *      THEN the system SHALL NOT apply prefill to avoid conflicts
   */
  it("6.3: *For any* messages with tools, SHALL NOT apply prefill", () => {
    fc.assert(
      fc.property(
        messagesWithToolCallsArb,
        nonEmptyPrefillArb,
        (messages, prefill) => {
          const result = applyPrefill(messages, prefill);

          // 有工具时应原样返回
          expect(result).toEqual(messages);

          // 不应有 prefix 字段
          for (const msg of result) {
            expect(msg.prefix).toBeUndefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 12: Prefill 应用**
   * **Validates: Requirements 6.4**
   *
   * 6.4: WHEN prefill content has trailing whitespace
   *      THEN the system SHALL trim it before applying
   */
  it("6.4: *For any* prefill with trailing whitespace, SHALL trim before applying", () => {
    fc.assert(
      fc.property(
        messagesNotEndingWithAssistantArb,
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
          fc.constantFrom("  ", "\t", "\n", "  \t\n"),
        ),
        (messages, [base, trailing]) => {
          const prefillWithTrailing = base + trailing;
          const result = applyPrefill(messages, prefillWithTrailing);

          // 追加的消息内容应去除尾部空白
          const last = result[result.length - 1];
          expect(last.content).toBe(prefillWithTrailing.trimEnd());
          expect(last.content).not.toMatch(/\s$/);
        },
      ),
      { numRuns: 100 },
    );
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     边界情况
     ═══════════════════════════════════════════════════════════════════════════ */

  it("6.1-6.4: empty prefill SHALL return messages unchanged", () => {
    fc.assert(
      fc.property(
        messagesWithoutToolsArb,
        emptyPrefillArb,
        (messages, prefill) => {
          const result = applyPrefill(messages, prefill);
          expect(result).toEqual(messages);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("6.2: empty messages array with prefill SHALL return single assistant", () => {
    fc.assert(
      fc.property(nonEmptyPrefillArb, (prefill) => {
        const result = applyPrefill([], prefill);

        expect(result.length).toBe(1);
        expect(result[0].role).toBe("assistant");
        expect(result[0].prefix).toBe(true);
        expect(result[0].content).toBe(prefill.trimEnd());
      }),
      { numRuns: 100 },
    );
  });

  it("6.3: explicit hasToolsInPrompt=true SHALL skip prefill", () => {
    fc.assert(
      fc.property(
        messagesWithoutToolsArb.filter((m) => m.length > 0),
        nonEmptyPrefillArb,
        (messages, prefill) => {
          // 即使消息本身没有工具，显式传入 true 也应跳过
          const result = applyPrefill(messages, prefill, true);
          expect(result).toEqual(messages);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("6.3: explicit hasToolsInPrompt=false SHALL apply prefill", () => {
    fc.assert(
      fc.property(
        messagesNotEndingWithAssistantArb,
        nonEmptyPrefillArb,
        (messages, prefill) => {
          // 显式传入 false 应正常应用 prefill
          const result = applyPrefill(messages, prefill, false);

          expect(result.length).toBe(messages.length + 1);
          expect(result[result.length - 1].prefix).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("6.1: existing assistant content SHALL be preserved", () => {
    fc.assert(
      fc.property(
        messagesEndingWithAssistantArb,
        nonEmptyPrefillArb,
        (messages, prefill) => {
          const originalContent = messages[messages.length - 1].content;
          const result = applyPrefill(messages, prefill);

          // 原有内容应保持不变
          expect(result[result.length - 1].content).toBe(originalContent);
        },
      ),
      { numRuns: 100 },
    );
  });
});
