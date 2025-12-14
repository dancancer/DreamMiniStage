/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     WorldBookNode 属性测试                                  ║
 * ║                                                                            ║
 * ║  Property 8: WorldBookNode messages[] 修改约束                              ║
 * ║  Property 9: 占位符替换范围                                                 ║
 * ║                                                                            ║
 * ║  **Validates: Requirements 4.2, 4.3, 4.4, 7.1**                            ║
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
const contentWithoutPlaceholderArb = fc.string({ minLength: 0, maxLength: 200 })
  .filter(s => 
    !s.includes("{{worldInfoBefore}}") && 
    !s.includes("{{worldInfoAfter}}") &&
    !s.includes("{{wiBefore}}") &&
    !s.includes("{{wiAfter}}"),
  );

/** 生成消息对象（不含占位符） */
const messageWithoutPlaceholderArb: fc.Arbitrary<ChatMessage> = fc.record({
  role: roleArb,
  content: contentWithoutPlaceholderArb,
});

/** 生成消息数组（不含占位符） */
const messagesWithoutPlaceholderArb = fc.array(messageWithoutPlaceholderArb, { minLength: 0, maxLength: 10 });

/** 生成包含 worldInfoBefore 占位符的内容 */
const contentWithWiBeforeArb = fc.tuple(
  fc.string({ minLength: 0, maxLength: 50 }).filter(s => !s.includes("{{")),
  fc.string({ minLength: 0, maxLength: 50 }).filter(s => !s.includes("{{")),
).map(([before, after]) => `${before}{{worldInfoBefore}}${after}`);

/** 生成包含 worldInfoAfter 占位符的内容 */
const contentWithWiAfterArb = fc.tuple(
  fc.string({ minLength: 0, maxLength: 50 }).filter(s => !s.includes("{{")),
  fc.string({ minLength: 0, maxLength: 50 }).filter(s => !s.includes("{{")),
).map(([before, after]) => `${before}{{worldInfoAfter}}${after}`);

/** 生成包含占位符的消息 */
const messageWithPlaceholderArb: fc.Arbitrary<ChatMessage> = fc.oneof(
  fc.record({ role: roleArb, content: contentWithWiBeforeArb }),
  fc.record({ role: roleArb, content: contentWithWiAfterArb }),
);

/** 生成世界书占位符内容 */
const placeholdersArb = fc.record({
  wiBefore: fc.string({ minLength: 0, maxLength: 200 }).filter(s => !s.includes("{{")),
  wiAfter: fc.string({ minLength: 0, maxLength: 200 }).filter(s => !s.includes("{{")),
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 8: WorldBookNode messages[] 修改约束
   **Validates: Requirements 4.2, 4.3**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 8: WorldBookNode messages[] 修改约束", () => {

  /**
   * **Feature: message-assembly-remediation, Property 8**
   * **Validates: Requirements 4.2**
   *
   * *For any* messages[] 不含占位符，replacePlaceholdersInMessages 应该返回原数组
   */
  it("*For any* messages[] without placeholders, SHALL return unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(
        messagesWithoutPlaceholderArb,
        placeholdersArb,
        async (messages, placeholders) => {
          const result = WorldBookNodeTools.replacePlaceholdersInMessages(messages, placeholders);

          // 核心断言：无占位符时返回原数组
          expect(result).toBe(messages);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 8**
   * **Validates: Requirements 4.2**
   *
   * *For any* messages[] 含占位符，replacePlaceholdersInMessages 应该返回新数组
   * 且原数组不被修改
   */
  it("*For any* messages[] with placeholders, SHALL return new array without mutating original", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(messageWithPlaceholderArb, { minLength: 1, maxLength: 5 }),
        placeholdersArb,
        async (messages, placeholders) => {
          // 保存原始内容的深拷贝
          const originalContents = messages.map(m => m.content);

          const result = WorldBookNodeTools.replacePlaceholdersInMessages(messages, placeholders);

          // 核心断言 1：返回新数组
          expect(result).not.toBe(messages);

          // 核心断言 2：原数组内容未被修改
          messages.forEach((msg, i) => {
            expect(msg.content).toBe(originalContents[i]);
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 8**
   * **Validates: Requirements 4.2**
   *
   * *For any* messages[]，replacePlaceholdersInMessages 应该保持消息数量不变
   */
  it("*For any* messages[], SHALL preserve message count", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.oneof(messageWithoutPlaceholderArb, messageWithPlaceholderArb),
          { minLength: 0, maxLength: 10 },
        ),
        placeholdersArb,
        async (messages, placeholders) => {
          const result = WorldBookNodeTools.replacePlaceholdersInMessages(messages, placeholders);

          // 核心断言：消息数量不变
          expect(result.length).toBe(messages.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 8**
   * **Validates: Requirements 4.2**
   *
   * *For any* messages[]，replacePlaceholdersInMessages 应该保持消息角色不变
   */
  it("*For any* messages[], SHALL preserve message roles", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.oneof(messageWithoutPlaceholderArb, messageWithPlaceholderArb),
          { minLength: 0, maxLength: 10 },
        ),
        placeholdersArb,
        async (messages, placeholders) => {
          const result = WorldBookNodeTools.replacePlaceholdersInMessages(messages, placeholders);

          // 核心断言：角色顺序和值不变
          result.forEach((msg, i) => {
            expect(msg.role).toBe(messages[i].role);
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 9: 占位符替换范围
   **Validates: Requirements 4.4, 7.1**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 9: 占位符替换范围", () => {

  /**
   * **Feature: message-assembly-remediation, Property 9**
   * **Validates: Requirements 4.4**
   *
   * *For any* messages[] 含 {{worldInfoBefore}}，替换后应该包含 wiBefore 内容
   */
  it("*For any* messages[] with {{worldInfoBefore}}, SHALL contain wiBefore content after replacement", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({ role: roleArb, content: contentWithWiBeforeArb }),
          { minLength: 1, maxLength: 5 },
        ),
        // 生成非空的 wiBefore，排除特殊字符
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => 
          !s.includes("{{") && !s.includes("$") && s.trim().length > 0,
        ),
        async (messages, wiBefore) => {
          const result = WorldBookNodeTools.replacePlaceholdersInMessages(
            messages,
            { wiBefore, wiAfter: "" },
          );

          // 核心断言：替换后不再包含占位符
          result.forEach(msg => {
            expect(msg.content).not.toContain("{{worldInfoBefore}}");
          });

          // 核心断言：替换后包含 wiBefore 内容
          const hasWiBefore = result.some(msg => msg.content.includes(wiBefore));
          expect(hasWiBefore).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 9**
   * **Validates: Requirements 4.4**
   *
   * *For any* messages[] 含 {{worldInfoAfter}}，替换后应该包含 wiAfter 内容
   */
  it("*For any* messages[] with {{worldInfoAfter}}, SHALL contain wiAfter content after replacement", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({ role: roleArb, content: contentWithWiAfterArb }),
          { minLength: 1, maxLength: 5 },
        ),
        // 生成非空的 wiAfter，排除特殊字符
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => 
          !s.includes("{{") && !s.includes("$") && s.trim().length > 0,
        ),
        async (messages, wiAfter) => {
          const result = WorldBookNodeTools.replacePlaceholdersInMessages(
            messages,
            { wiBefore: "", wiAfter },
          );

          // 核心断言：替换后不再包含占位符
          result.forEach(msg => {
            expect(msg.content).not.toContain("{{worldInfoAfter}}");
          });

          // 核心断言：替换后包含 wiAfter 内容
          const hasWiAfter = result.some(msg => msg.content.includes(wiAfter));
          expect(hasWiAfter).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 9**
   * **Validates: Requirements 7.1**
   *
   * *For any* messages[] 含占位符，空的占位符内容应该移除占位符文本
   */
  it("*For any* messages[] with placeholders, empty content SHALL remove placeholder text", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(messageWithPlaceholderArb, { minLength: 1, maxLength: 5 }),
        async (messages) => {
          const result = WorldBookNodeTools.replacePlaceholdersInMessages(
            messages,
            { wiBefore: "", wiAfter: "" },
          );

          // 核心断言：所有占位符都被移除
          result.forEach(msg => {
            expect(msg.content).not.toContain("{{worldInfoBefore}}");
            expect(msg.content).not.toContain("{{worldInfoAfter}}");
            expect(msg.content).not.toContain("{{wiBefore}}");
            expect(msg.content).not.toContain("{{wiAfter}}");
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 9**
   * **Validates: Requirements 4.4, 7.1**
   *
   * *For any* messages[]，不含占位符的消息内容应该保持不变
   */
  it("*For any* messages[], content without placeholders SHALL remain unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(
        // 混合有占位符和无占位符的消息
        fc.tuple(
          fc.array(messageWithoutPlaceholderArb, { minLength: 1, maxLength: 3 }),
          fc.array(messageWithPlaceholderArb, { minLength: 1, maxLength: 3 }),
        ),
        placeholdersArb,
        async ([messagesWithout, messagesWith], placeholders) => {
          // 交错排列
          const mixed: ChatMessage[] = [];
          const maxLen = Math.max(messagesWithout.length, messagesWith.length);
          for (let i = 0; i < maxLen; i++) {
            if (i < messagesWithout.length) mixed.push(messagesWithout[i]);
            if (i < messagesWith.length) mixed.push(messagesWith[i]);
          }

          const result = WorldBookNodeTools.replacePlaceholdersInMessages(mixed, placeholders);

          // 核心断言：无占位符的消息内容保持不变
          messagesWithout.forEach(original => {
            const found = result.find(r => 
              r.role === original.role && r.content === original.content,
            );
            expect(found).toBeDefined();
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   WorldBookNodeTools.containsWorldBookPlaceholder 单元测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("WorldBookNodeTools.containsWorldBookPlaceholder", () => {

  it("应该检测 {{worldInfoBefore}}", () => {
    expect(WorldBookNodeTools.containsWorldBookPlaceholder("前文{{worldInfoBefore}}后文")).toBe(true);
  });

  it("应该检测 {{worldInfoAfter}}", () => {
    expect(WorldBookNodeTools.containsWorldBookPlaceholder("前文{{worldInfoAfter}}后文")).toBe(true);
  });

  it("应该检测 {{wiBefore}}", () => {
    expect(WorldBookNodeTools.containsWorldBookPlaceholder("{{wiBefore}}")).toBe(true);
  });

  it("应该检测 {{wiAfter}}", () => {
    expect(WorldBookNodeTools.containsWorldBookPlaceholder("{{wiAfter}}")).toBe(true);
  });

  it("不含占位符时应该返回 false", () => {
    expect(WorldBookNodeTools.containsWorldBookPlaceholder("普通文本")).toBe(false);
  });

  it("空字符串应该返回 false", () => {
    expect(WorldBookNodeTools.containsWorldBookPlaceholder("")).toBe(false);
  });
});
