/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              Property 5: None 模式恒等                                     ║
 * ║                                                                            ║
 * ║  **Feature: message-post-processing**                                      ║
 * ║  **Validates: Requirements 1.5**                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { postProcessMessages } from "../../prompt/post-processor";
import { PostProcessingMode } from "../../st-preset-types";
import type { ExtendedChatMessage, PromptNames } from "../../st-preset-types";
import { messagesArb, promptNamesArb } from "./generators";

/* ═══════════════════════════════════════════════════════════════════════════
   Property 5: None 模式恒等
   **Validates: Requirements 1.5**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 5: None 模式恒等", () => {
  /**
   * **Feature: message-post-processing, Property 5: None 模式恒等**
   * **Validates: Requirements 1.5**
   *
   * *For any* message array processed with none mode,
   * the output should be identical to the input.
   */
  it("1.5: *For any* messages, none mode SHALL return identical output", () => {
    fc.assert(
      fc.property(messagesArb, promptNamesArb, (messages, names) => {
        const result = postProcessMessages(messages, {
          mode: PostProcessingMode.NONE,
          names,
        });

        // 输出应与输入完全相同
        expect(result).toEqual(messages);
      }),
      { numRuns: 100 },
    );
  });

  it("1.5: none mode SHALL preserve all message fields unchanged", () => {
    fc.assert(
      fc.property(messagesArb, promptNamesArb, (messages, names) => {
        const result = postProcessMessages(messages, {
          mode: PostProcessingMode.NONE,
          names,
          tools: true,
          prefill: "test prefill",
          placeholder: "test placeholder",
        });

        // 即使提供了其他选项，none 模式也应原样返回
        expect(result).toEqual(messages);
      }),
      { numRuns: 100 },
    );
  });

  it("1.5: none mode SHALL preserve empty array", () => {
    const emptyMessages: ExtendedChatMessage[] = [];
    const names: PromptNames = {
      charName: "Char",
      userName: "User",
      groupNames: [],
      startsWithGroupName: () => false,
    };

    const result = postProcessMessages(emptyMessages, {
      mode: PostProcessingMode.NONE,
      names,
    });

    expect(result).toEqual([]);
  });

  it("1.5: none mode SHALL preserve name fields", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            role: fc.constantFrom("user" as const, "assistant" as const),
            content: fc.string({ minLength: 1, maxLength: 50 }),
            name: fc.string({ minLength: 1, maxLength: 20 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        promptNamesArb,
        (messages, names) => {
          const result = postProcessMessages(messages as ExtendedChatMessage[], {
            mode: PostProcessingMode.NONE,
            names,
          });

          // name 字段应保持不变
          for (let i = 0; i < messages.length; i++) {
            expect(result[i].name).toBe(messages[i].name);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("1.5: none mode SHALL preserve tool fields", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            role: fc.constant("assistant" as const),
            content: fc.string({ minLength: 1, maxLength: 50 }),
            tool_calls: fc.array(
              fc.record({
                id: fc.string({ minLength: 1, maxLength: 10 }),
                type: fc.constant("function" as const),
                function: fc.record({
                  name: fc.string({ minLength: 1, maxLength: 10 }),
                  arguments: fc.json(),
                }),
              }),
              { minLength: 1, maxLength: 3 },
            ),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        promptNamesArb,
        (messages, names) => {
          const result = postProcessMessages(messages as ExtendedChatMessage[], {
            mode: PostProcessingMode.NONE,
            names,
          });

          // tool_calls 字段应保持不变
          for (let i = 0; i < messages.length; i++) {
            expect(result[i].tool_calls).toEqual(messages[i].tool_calls);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
