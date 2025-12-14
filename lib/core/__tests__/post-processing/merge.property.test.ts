/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              Property 1, 4, 8, 9: 角色合并与多模态                          ║
 * ║                                                                            ║
 * ║  **Feature: message-post-processing**                                      ║
 * ║  **Validates: Requirements 1.1, 1.4, 3.1, 3.2, 3.3**                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  mergeConsecutiveRoles,
  getTextContent,
  normalizeNames,
} from "../../prompt/post-processor";
import type { ExtendedChatMessage } from "../../st-preset-types";
import {
  messagesWithToolArb,
  contentArb,
  roleArb,
  contentArrayWithTextArb,
  contentArrayWithoutTextArb,
  nonEmptyNameArb,
  promptNamesArb,
} from "./generators";

/* ═══════════════════════════════════════════════════════════════════════════
   Property 1: Merge 模式无连续同角色
   **Validates: Requirements 1.1**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 1: Merge 模式无连续同角色", () => {
  /**
   * **Feature: message-post-processing, Property 1: Merge 模式无连续同角色**
   * **Validates: Requirements 1.1**
   */
  it("1.1: *For any* messages, merge SHALL produce no consecutive same roles (except tool)", () => {
    fc.assert(
      fc.property(messagesWithToolArb, (messages) => {
        const result = mergeConsecutiveRoles(messages, false);

        for (let i = 1; i < result.length; i++) {
          const prev = result[i - 1];
          const curr = result[i];

          if (prev.role === "tool" || curr.role === "tool") {
            continue;
          }

          expect(prev.role).not.toBe(curr.role);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("merge SHALL preserve all text content", () => {
    fc.assert(
      fc.property(messagesWithToolArb, (messages) => {
        const result = mergeConsecutiveRoles(messages, false);
        const mergedText = result.map((m) => getTextContent(m.content)).join("");

        for (const msg of messages) {
          const text = getTextContent(msg.content);
          if (text) {
            expect(mergedText).toContain(text);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("tool role messages SHALL never be merged", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ role: fc.constant("tool" as const), content: contentArb }),
          { minLength: 2, maxLength: 10 },
        ),
        (toolMessages) => {
          const extMessages = toolMessages as ExtendedChatMessage[];
          const result = mergeConsecutiveRoles(extMessages, false);

          expect(result.length).toBe(extMessages.length);

          for (let i = 0; i < result.length; i++) {
            expect(result[i].role).toBe("tool");
            expect(getTextContent(result[i].content)).toBe(
              getTextContent(extMessages[i].content),
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 4: Single 模式单消息输出
   **Validates: Requirements 1.4**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 4: Single 模式单消息输出", () => {
  /**
   * **Feature: message-post-processing, Property 4: Single 模式单消息输出**
   * **Validates: Requirements 1.4**
   */
  it("1.4: *For any* non-empty messages without tool, single mode SHALL produce exactly one user message", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            role: fc.constantFrom("system" as const, "user" as const, "assistant" as const),
            content: contentArb,
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (messages) => {
          const result = mergeConsecutiveRoles(messages as ExtendedChatMessage[], true);

          expect(result.length).toBe(1);
          expect(result[0].role).toBe("user");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("single mode SHALL preserve all text content in merged message", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            role: fc.constantFrom("system" as const, "user" as const, "assistant" as const),
            content: contentArb,
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (messages) => {
          const result = mergeConsecutiveRoles(messages as ExtendedChatMessage[], true);
          const mergedContent = getTextContent(result[0].content);

          for (const msg of messages) {
            const text = getTextContent(msg.content);
            if (text) {
              expect(mergedContent).toContain(text);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("single mode SHALL keep tool messages separate", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(
            fc.record({
              role: fc.constantFrom("system" as const, "user" as const, "assistant" as const),
              content: contentArb,
            }),
            { minLength: 1, maxLength: 5 },
          ),
          fc.array(
            fc.record({ role: fc.constant("tool" as const), content: contentArb }),
            { minLength: 1, maxLength: 3 },
          ),
        ),
        ([normalMessages, toolMessages]) => {
          const mixed: ExtendedChatMessage[] = [];
          const maxLen = Math.max(normalMessages.length, toolMessages.length);

          for (let i = 0; i < maxLen; i++) {
            if (i < normalMessages.length) {
              mixed.push(normalMessages[i] as ExtendedChatMessage);
            }
            if (i < toolMessages.length) {
              mixed.push(toolMessages[i] as ExtendedChatMessage);
            }
          }

          const result = mergeConsecutiveRoles(mixed, true);
          const toolCount = result.filter((m) => m.role === "tool").length;
          expect(toolCount).toBe(toolMessages.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("empty array SHALL return empty array", () => {
    expect(mergeConsecutiveRoles([], false)).toEqual([]);
    expect(mergeConsecutiveRoles([], true)).toEqual([]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 8: 多模态数组保留
   **Validates: Requirements 3.1**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 8: 多模态数组保留", () => {
  /**
   * **Feature: message-post-processing, Property 8: 多模态数组保留**
   * **Validates: Requirements 3.1**
   */
  it("3.1: *For any* message with array content, SHALL preserve array structure", () => {
    fc.assert(
      fc.property(
        fc.record({
          role: roleArb,
          content: fc.oneof(contentArrayWithTextArb, contentArrayWithoutTextArb),
        }),
        (msg) => {
          const result = mergeConsecutiveRoles([msg as ExtendedChatMessage], false);

          expect(result.length).toBe(1);
          expect(Array.isArray(result[0].content)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("3.1: *For any* message with array content and name, normalizeNames SHALL preserve array", () => {
    fc.assert(
      fc.property(
        fc.record({
          role: fc.constantFrom("user" as const, "assistant" as const),
          content: contentArrayWithTextArb,
          name: nonEmptyNameArb,
        }),
        promptNamesArb,
        (msg, names) => {
          const result = normalizeNames([msg as ExtendedChatMessage], names);

          expect(result.length).toBe(1);
          expect(Array.isArray(result[0].content)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("3.1: *For any* message with non-text array content, SHALL preserve array", () => {
    fc.assert(
      fc.property(
        fc.record({ role: roleArb, content: contentArrayWithoutTextArb }),
        (msg) => {
          const result = mergeConsecutiveRoles([msg as ExtendedChatMessage], false);

          expect(result.length).toBe(1);
          expect(Array.isArray(result[0].content)).toBe(true);
          expect((result[0].content as unknown[]).length).toBe(
            (msg.content as unknown[]).length,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 9: 多模态合并连接
   **Validates: Requirements 3.2, 3.3**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 9: 多模态合并连接", () => {
  /**
   * **Feature: message-post-processing, Property 9: 多模态合并连接**
   * **Validates: Requirements 3.2, 3.3**
   */
  it("3.2: *For any* two same-role messages with array content, merge SHALL concatenate arrays", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("user" as const, "assistant" as const, "system" as const),
        fc.oneof(contentArrayWithTextArb, contentArrayWithoutTextArb),
        fc.oneof(contentArrayWithTextArb, contentArrayWithoutTextArb),
        (role, content1, content2) => {
          const msg1: ExtendedChatMessage = { role, content: content1 };
          const msg2: ExtendedChatMessage = { role, content: content2 };

          const result = mergeConsecutiveRoles([msg1, msg2], false);

          expect(result.length).toBe(1);
          expect(Array.isArray(result[0].content)).toBe(true);

          const resultArray = result[0].content as unknown[];
          expect(resultArray.length).toBe(content1.length + content2.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("3.3: *For any* string + array merge, string SHALL convert to text part", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("user" as const, "assistant" as const, "system" as const),
        contentArb,
        fc.oneof(contentArrayWithTextArb, contentArrayWithoutTextArb),
        (role, stringContent, arrayContent) => {
          const msg1: ExtendedChatMessage = { role, content: stringContent };
          const msg2: ExtendedChatMessage = { role, content: arrayContent };

          const result = mergeConsecutiveRoles([msg1, msg2], false);

          expect(result.length).toBe(1);
          expect(Array.isArray(result[0].content)).toBe(true);

          const resultArray = result[0].content as unknown[];
          expect(resultArray.length).toBe(1 + arrayContent.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("3.3: *For any* array + string merge, string SHALL convert to text part", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("user" as const, "assistant" as const, "system" as const),
        fc.oneof(contentArrayWithTextArb, contentArrayWithoutTextArb),
        contentArb,
        (role, arrayContent, stringContent) => {
          const msg1: ExtendedChatMessage = { role, content: arrayContent };
          const msg2: ExtendedChatMessage = { role, content: stringContent };

          const result = mergeConsecutiveRoles([msg1, msg2], false);

          expect(result.length).toBe(1);
          expect(Array.isArray(result[0].content)).toBe(true);

          const resultArray = result[0].content as unknown[];
          expect(resultArray.length).toBe(arrayContent.length + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("3.2: *For any* N same-role messages with array content, merge SHALL produce sum of lengths", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("user" as const, "assistant" as const, "system" as const),
        fc.array(
          fc.oneof(contentArrayWithTextArb, contentArrayWithoutTextArb),
          { minLength: 2, maxLength: 5 },
        ),
        (role, contents) => {
          const messages: ExtendedChatMessage[] = contents.map((content) => ({
            role,
            content,
          }));

          const result = mergeConsecutiveRoles(messages, false);

          expect(result.length).toBe(1);
          expect(Array.isArray(result[0].content)).toBe(true);

          const expectedLength = contents.reduce((sum, c) => sum + c.length, 0);
          const resultArray = result[0].content as unknown[];
          expect(resultArray.length).toBe(expectedLength);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("3.2: *For any* merged array content, SHALL preserve all original parts", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("user" as const, "assistant" as const),
        contentArrayWithTextArb,
        contentArrayWithTextArb,
        (role, content1, content2) => {
          const msg1: ExtendedChatMessage = { role, content: content1 };
          const msg2: ExtendedChatMessage = { role, content: content2 };

          const result = mergeConsecutiveRoles([msg1, msg2], false);
          const resultArray = result[0].content as typeof content1;

          for (let i = 0; i < content1.length; i++) {
            expect(resultArray[i]).toEqual(content1[i]);
          }

          for (let i = 0; i < content2.length; i++) {
            expect(resultArray[content1.length + i]).toEqual(content2[i]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
