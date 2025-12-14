/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              Property 2, 3, 10, 11: 严格模式与工具处理                       ║
 * ║                                                                            ║
 * ║  **Feature: message-post-processing**                                      ║
 * ║  **Validates: Requirements 1.2, 1.3, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3**       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  convertMidSystemToUser,
  ensureUserStart,
  ensureNonEmpty,
  stripTools,
  getTextContent,
} from "../../prompt/post-processor";
import type { ExtendedChatMessage } from "../../st-preset-types";
import {
  messagesWithToolArb,
  messageWithFullRoleArb,
  contentArb,
  messagesWithToolFieldsArb,
} from "./generators";

/* ═══════════════════════════════════════════════════════════════════════════
   Property 2: Semi 模式仅首条可为 system
   **Validates: Requirements 1.2**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 2: Semi 模式仅首条可为 system", () => {
  /**
   * **Feature: message-post-processing, Property 2: Semi 模式仅首条可为 system**
   * **Validates: Requirements 1.2**
   */
  it("1.2: *For any* messages, convertMidSystemToUser SHALL convert non-first system to user", () => {
    fc.assert(
      fc.property(messagesWithToolArb, (messages) => {
        const result = convertMidSystemToUser(messages);

        expect(result.length).toBe(messages.length);

        for (let i = 1; i < result.length; i++) {
          expect(result[i].role).not.toBe("system");
        }
      }),
      { numRuns: 100 },
    );
  });

  it("1.2: first system message SHALL remain system", () => {
    fc.assert(
      fc.property(
        fc.record({ role: fc.constant("system" as const), content: contentArb }),
        messagesWithToolArb,
        (firstMsg, restMessages) => {
          const messages = [firstMsg as ExtendedChatMessage, ...restMessages];
          const result = convertMidSystemToUser(messages);

          expect(result[0].role).toBe("system");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("1.2: non-first system messages SHALL become user", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ role: fc.constant("system" as const), content: contentArb }),
          { minLength: 2, maxLength: 10 },
        ),
        (systemMessages) => {
          const result = convertMidSystemToUser(systemMessages as ExtendedChatMessage[]);

          expect(result[0].role).toBe("system");

          for (let i = 1; i < result.length; i++) {
            expect(result[i].role).toBe("user");
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("1.2: non-system messages SHALL keep original role", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            role: fc.constantFrom("user" as const, "assistant" as const),
            content: contentArb,
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (messages) => {
          const extMessages = messages as ExtendedChatMessage[];
          const result = convertMidSystemToUser(extMessages);

          for (let i = 0; i < result.length; i++) {
            expect(result[i].role).toBe(extMessages[i].role);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("1.2: content SHALL remain unchanged", () => {
    fc.assert(
      fc.property(messagesWithToolArb, (messages) => {
        const result = convertMidSystemToUser(messages);

        for (let i = 0; i < result.length; i++) {
          expect(getTextContent(result[i].content)).toBe(
            getTextContent(messages[i].content),
          );
        }
      }),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 3: Strict 模式 user 起始保证
   **Validates: Requirements 1.3, 5.2, 5.3**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 3: Strict 模式 user 起始保证", () => {
  /**
   * **Feature: message-post-processing, Property 3: Strict 模式 user 起始保证**
   * **Validates: Requirements 1.3, 5.2, 5.3**
   */
  it("1.3: *For any* non-empty messages, ensureUserStart SHALL guarantee user start", () => {
    fc.assert(
      fc.property(
        fc.array(messageWithFullRoleArb, { minLength: 1, maxLength: 20 }),
        (messages) => {
          const result = ensureUserStart(messages as ExtendedChatMessage[]);

          expect(result.length).toBeGreaterThan(0);

          const first = result[0];

          if (first.role === "system") {
            expect(result.length).toBeGreaterThanOrEqual(2);
            expect(result[1].role).toBe("user");
          } else {
            expect(first.role).toBe("user");
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("5.2: *For any* [system, non-user, ...], SHALL insert placeholder after system", () => {
    fc.assert(
      fc.property(
        fc.record({ role: fc.constant("system" as const), content: contentArb }),
        fc.record({
          role: fc.constantFrom("assistant" as const, "tool" as const),
          content: contentArb,
        }),
        fc.array(messageWithFullRoleArb, { minLength: 0, maxLength: 5 }),
        (systemMsg, nonUserMsg, rest) => {
          const messages = [
            systemMsg as ExtendedChatMessage,
            nonUserMsg as ExtendedChatMessage,
            ...(rest as ExtendedChatMessage[]),
          ];
          const result = ensureUserStart(messages);

          expect(result[0].role).toBe("system");
          expect(result[1].role).toBe("user");
          expect(result.length).toBe(messages.length + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("5.3: *For any* [non-system, non-user, ...], SHALL insert placeholder at start", () => {
    fc.assert(
      fc.property(
        fc.record({
          role: fc.constantFrom("assistant" as const, "tool" as const),
          content: contentArb,
        }),
        fc.array(messageWithFullRoleArb, { minLength: 0, maxLength: 5 }),
        (firstMsg, rest) => {
          const messages = [
            firstMsg as ExtendedChatMessage,
            ...(rest as ExtendedChatMessage[]),
          ];
          const result = ensureUserStart(messages);

          expect(result[0].role).toBe("user");
          expect(result.length).toBe(messages.length + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("1.3: [system, user, ...] SHALL remain unchanged", () => {
    fc.assert(
      fc.property(
        fc.record({ role: fc.constant("system" as const), content: contentArb }),
        fc.record({ role: fc.constant("user" as const), content: contentArb }),
        fc.array(messageWithFullRoleArb, { minLength: 0, maxLength: 5 }),
        (systemMsg, userMsg, rest) => {
          const messages = [
            systemMsg as ExtendedChatMessage,
            userMsg as ExtendedChatMessage,
            ...(rest as ExtendedChatMessage[]),
          ];
          const result = ensureUserStart(messages);

          expect(result.length).toBe(messages.length);
          expect(result[0].role).toBe("system");
          expect(result[1].role).toBe("user");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("1.3: [user, ...] SHALL remain unchanged", () => {
    fc.assert(
      fc.property(
        fc.record({ role: fc.constant("user" as const), content: contentArb }),
        fc.array(messageWithFullRoleArb, { minLength: 0, maxLength: 5 }),
        (userMsg, rest) => {
          const messages = [
            userMsg as ExtendedChatMessage,
            ...(rest as ExtendedChatMessage[]),
          ];
          const result = ensureUserStart(messages);

          expect(result.length).toBe(messages.length);
          expect(result[0].role).toBe("user");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("empty array SHALL remain empty", () => {
    const result = ensureUserStart([]);
    expect(result.length).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 10: 工具选项处理
   **Validates: Requirements 4.1, 4.2, 4.3**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 10: 工具选项处理", () => {
  /**
   * **Feature: message-post-processing, Property 10: 工具选项处理**
   * **Validates: Requirements 4.2, 4.3**
   */
  it("4.2: *For any* messages with tool_calls, stripTools SHALL remove tool_calls", () => {
    fc.assert(
      fc.property(messagesWithToolFieldsArb, (messages) => {
        const result = stripTools(messages);

        for (const msg of result) {
          expect(msg.tool_calls).toBeUndefined();
          expect(msg.tool_call_id).toBeUndefined();
        }
      }),
      { numRuns: 100 },
    );
  });

  it("4.3: *For any* tool role message, stripTools SHALL convert to user", () => {
    fc.assert(
      fc.property(messagesWithToolFieldsArb, (messages) => {
        const result = stripTools(messages);

        for (const msg of result) {
          expect(msg.role).not.toBe("tool");
        }
      }),
      { numRuns: 100 },
    );
  });

  it("4.2-4.3: stripTools SHALL preserve content", () => {
    fc.assert(
      fc.property(messagesWithToolFieldsArb, (messages) => {
        const result = stripTools(messages);

        expect(result.length).toBe(messages.length);

        for (let i = 0; i < result.length; i++) {
          expect(getTextContent(result[i].content)).toBe(
            getTextContent(messages[i].content),
          );
        }
      }),
      { numRuns: 100 },
    );
  });

  it("4.3: tool messages SHALL become user with same content", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            role: fc.constant("tool" as const),
            content: contentArb,
            tool_call_id: fc.string({ minLength: 1, maxLength: 20 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (toolMessages) => {
          const result = stripTools(toolMessages as ExtendedChatMessage[]);

          for (let i = 0; i < result.length; i++) {
            expect(result[i].role).toBe("user");
            expect(getTextContent(result[i].content)).toBe(
              getTextContent(toolMessages[i].content),
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("non-tool messages SHALL keep original role", () => {
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
          const result = stripTools(messages as ExtendedChatMessage[]);

          for (let i = 0; i < result.length; i++) {
            expect(result[i].role).toBe(messages[i].role);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 11: 空消息兜底
   **Validates: Requirements 5.1**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 11: 空消息兜底", () => {
  /**
   * **Feature: message-post-processing, Property 11: 空消息兜底**
   * **Validates: Requirements 5.1**
   */
  it("5.1: *For any* empty array, ensureNonEmpty SHALL return single user message", () => {
    const result = ensureNonEmpty([]);

    expect(result.length).toBe(1);
    expect(result[0].role).toBe("user");
  });

  it("5.1: *For any* non-empty array, ensureNonEmpty SHALL return unchanged", () => {
    fc.assert(
      fc.property(
        fc.array(messageWithFullRoleArb, { minLength: 1, maxLength: 20 }),
        (messages) => {
          const result = ensureNonEmpty(messages as ExtendedChatMessage[]);

          expect(result.length).toBe(messages.length);

          for (let i = 0; i < result.length; i++) {
            expect(result[i].role).toBe(messages[i].role);
            expect(getTextContent(result[i].content)).toBe(
              getTextContent(messages[i].content),
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("5.1: custom placeholder SHALL be used", () => {
    const customPlaceholder = "Custom start message";
    const result = ensureNonEmpty([], customPlaceholder);

    expect(result.length).toBe(1);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toBe(customPlaceholder);
  });

  it("5.1: default placeholder SHALL be 'Let's get started.'", () => {
    const result = ensureNonEmpty([]);

    expect(result[0].content).toBe("Let's get started.");
  });
});
