/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              Property 6 & 7: 名称前缀规范化                                 ║
 * ║                                                                            ║
 * ║  **Feature: message-post-processing**                                      ║
 * ║  **Validates: Requirements 2.1-2.5**                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { normalizeNames, getTextContent } from "../../prompt/post-processor";
import type { ExtendedChatMessage } from "../../st-preset-types";
import {
  messageWithNameArb,
  promptNamesArb,
  messagesArb,
  richContentArb,
  nonEmptyNameArb,
  contentArb,
  getExpectedPrefix,
} from "./generators";

/* ═══════════════════════════════════════════════════════════════════════════
   Property 6: 名称前缀应用
   **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 6: 名称前缀应用", () => {
  /**
   * **Feature: message-post-processing, Property 6: 名称前缀应用**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   */
  it("2.1-2.4: *For any* message with name, SHALL add prefix and remove name", () => {
    fc.assert(
      fc.property(messageWithNameArb, promptNamesArb, (msg, names) => {
        const result = normalizeNames([msg as ExtendedChatMessage], names);

        expect(result.length).toBe(1);
        const processed = result[0];

        // name 字段应该被移除
        expect(processed.name).toBeUndefined();

        // 非 system 角色应该有前缀
        if (msg.role !== "system") {
          const textContent = getTextContent(processed.content);
          const expectedPrefix = getExpectedPrefix(msg.name!, names);

          if (expectedPrefix) {
            expect(textContent.startsWith(expectedPrefix)).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.1**
   */
  it("2.1: *For any* non-system message with name, SHALL prepend name prefix", () => {
    fc.assert(
      fc.property(
        fc.record({
          role: fc.constantFrom("user" as const, "assistant" as const),
          content: richContentArb,
          name: nonEmptyNameArb,
        }),
        promptNamesArb,
        (msg, names) => {
          const result = normalizeNames([msg as ExtendedChatMessage], names);
          const processed = result[0];
          const textContent = getTextContent(processed.content);

          expect(textContent.startsWith(`${msg.name}: `)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.2**
   */
  it("2.2: *For any* example_assistant message, SHALL prepend charName prefix", () => {
    fc.assert(
      fc.property(
        fc.record({
          role: fc.constantFrom("user" as const, "assistant" as const),
          content: richContentArb,
          name: fc.constant("example_assistant"),
        }),
        promptNamesArb,
        (msg, names) => {
          const result = normalizeNames([msg as ExtendedChatMessage], names);
          const processed = result[0];
          const textContent = getTextContent(processed.content);

          expect(textContent.startsWith(`${names.charName}: `)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.3**
   */
  it("2.3: *For any* example_user message, SHALL prepend userName prefix", () => {
    fc.assert(
      fc.property(
        fc.record({
          role: fc.constantFrom("user" as const, "assistant" as const),
          content: richContentArb,
          name: fc.constant("example_user"),
        }),
        promptNamesArb,
        (msg, names) => {
          const result = normalizeNames([msg as ExtendedChatMessage], names);
          const processed = result[0];
          const textContent = getTextContent(processed.content);

          expect(textContent.startsWith(`${names.userName}: `)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.4**
   */
  it("2.4: *For any* message with name, SHALL remove name field", () => {
    fc.assert(
      fc.property(messageWithNameArb, promptNamesArb, (msg, names) => {
        const result = normalizeNames([msg as ExtendedChatMessage], names);
        const processed = result[0];

        expect(processed.name).toBeUndefined();
        expect("name" in processed).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("system role messages SHALL NOT have prefix added", () => {
    fc.assert(
      fc.property(
        fc.record({
          role: fc.constant("system" as const),
          content: richContentArb,
          name: nonEmptyNameArb,
        }),
        promptNamesArb,
        (msg, names) => {
          const original = msg as ExtendedChatMessage;
          const result = normalizeNames([original], names);
          const processed = result[0];
          const textContent = getTextContent(processed.content);
          const originalText = getTextContent(original.content);

          expect(textContent).toBe(originalText);
          expect(processed.name).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 7: 名称前缀幂等性
   **Validates: Requirements 2.5**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 7: 名称前缀幂等性", () => {
  /**
   * **Feature: message-post-processing, Property 7: 名称前缀幂等性**
   * **Validates: Requirements 2.5**
   */
  it("2.5: *For any* messages, normalizeNames(normalizeNames(x)) === normalizeNames(x)", () => {
    fc.assert(
      fc.property(messagesArb, promptNamesArb, (messages, names) => {
        const once = normalizeNames(messages, names);
        const twice = normalizeNames(once, names);

        expect(twice.length).toBe(once.length);

        for (let i = 0; i < once.length; i++) {
          expect(getTextContent(twice[i].content)).toBe(
            getTextContent(once[i].content),
          );
          expect(twice[i].role).toBe(once[i].role);
          expect(twice[i].name).toBe(once[i].name);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("example_assistant with existing charName prefix SHALL stay single", () => {
    fc.assert(
      fc.property(promptNamesArb, contentArb, (names, content) => {
        const msg: ExtendedChatMessage = {
          role: "assistant",
          content: `${names.charName}: ${content}`,
          name: "example_assistant",
        };

        const processed = normalizeNames([msg], names)[0];
        expect(getTextContent(processed.content)).toBe(
          `${names.charName}: ${content}`,
        );
        expect(processed.name).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it("example_user with existing userName prefix SHALL stay single", () => {
    fc.assert(
      fc.property(promptNamesArb, contentArb, (names, content) => {
        const msg: ExtendedChatMessage = {
          role: "user",
          content: `${names.userName}: ${content}`,
          name: "example_user",
        };

        const processed = normalizeNames([msg], names)[0];
        expect(getTextContent(processed.content)).toBe(
          `${names.userName}: ${content}`,
        );
        expect(processed.name).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it("messages with existing prefix SHALL NOT get duplicate prefix", () => {
    fc.assert(
      fc.property(
        nonEmptyNameArb,
        contentArb,
        promptNamesArb,
        (name, content, names) => {
          const prefixedContent = `${name}: ${content}`;
          const msg: ExtendedChatMessage = {
            role: "user",
            content: prefixedContent,
            name: name,
          };

          const result = normalizeNames([msg], names);
          const processed = result[0];
          const textContent = getTextContent(processed.content);

          const doublePrefix = `${name}: ${name}: `;
          expect(textContent.startsWith(doublePrefix)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
