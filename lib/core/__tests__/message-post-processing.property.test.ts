/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              消息后处理管线 - 属性测试                                       ║
 * ║                                                                            ║
 * ║  **Feature: message-post-processing**                                      ║
 * ║  **Validates: Requirements 2.1-2.5**                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  normalizeNames,
  getTextContent,
  mergeConsecutiveRoles,
  convertMidSystemToUser,
  ensureUserStart,
  ensureNonEmpty,
} from "../prompt/post-processor";
import type {
  ExtendedChatMessage,
  PromptNames,
} from "../st-preset-types";

/* ═══════════════════════════════════════════════════════════════════════════
   生成器定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成非空名称字符串
 */
const nonEmptyNameArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => s.trim().length > 0 && !s.includes(":"));

/**
 * 生成消息角色（不含 tool）
 */
const roleArb = fc.constantFrom(
  "system" as const,
  "user" as const,
  "assistant" as const,
);

/**
 * 生成非空消息内容
 */
const contentArb = fc.string({ minLength: 1, maxLength: 100 });

/**
 * 生成文本内容片段
 */
const textPartArb = fc.record({
  type: fc.constant<"text">("text"),
  text: fc.string({ minLength: 1, maxLength: 100 }),
});

/**
 * 生成非文本内容片段
 */
const nonTextPartArb = fc.oneof(
  fc.record({
    type: fc.constant<"image_url">("image_url"),
    image_url: fc.record({ url: fc.string({ minLength: 1, maxLength: 100 }) }),
  }),
  fc.record({
    type: fc.constant<"video_url">("video_url"),
    video_url: fc.record({ url: fc.string({ minLength: 1, maxLength: 100 }) }),
  }),
  fc.record({
    type: fc.constant<"audio_url">("audio_url"),
    audio_url: fc.record({ url: fc.string({ minLength: 1, maxLength: 100 }) }),
  }),
);

/**
 * 生成包含文本的多模态内容数组
 */
const contentArrayWithTextArb = fc
  .array(fc.oneof(textPartArb, nonTextPartArb), { minLength: 1, maxLength: 5 })
  .filter(parts => parts.some(part => part.type === "text"));

/**
 * 生成无文本的多模态内容数组
 */
const contentArrayWithoutTextArb = fc.array(nonTextPartArb, {
  minLength: 1,
  maxLength: 5,
});

/**
 * 生成多模态消息内容（字符串或 ContentPart[]）
 */
const richContentArb = fc.oneof(
  contentArb,
  contentArrayWithTextArb,
  contentArrayWithoutTextArb,
);

/**
 * 生成 PromptNames
 */
const promptNamesArb = fc.record({
  charName: nonEmptyNameArb,
  userName: nonEmptyNameArb,
  groupNames: fc.array(nonEmptyNameArb, { minLength: 0, maxLength: 5 }),
}).map(({ charName, userName, groupNames }) => ({
  charName,
  userName,
  groupNames,
  startsWithGroupName: (msg: string) =>
    groupNames.some(name => msg.startsWith(`${name}: `)),
}));

/**
 * 生成带 name 字段的消息
 */
const messageWithNameArb = fc.record({
  role: roleArb,
  content: richContentArb,
  name: fc.oneof(
    nonEmptyNameArb,
    fc.constant("example_assistant"),
    fc.constant("example_user"),
  ),
});

/**
 * 生成不带 name 字段的消息
 */
const messageWithoutNameArb = fc.record({
  role: roleArb,
  content: richContentArb,
});

/**
 * 生成混合消息数组
 */
const messagesArb = fc.array(
  fc.oneof(messageWithNameArb, messageWithoutNameArb),
  { minLength: 0, maxLength: 20 },
);

/* ═══════════════════════════════════════════════════════════════════════════
   Property 6: 名称前缀应用
   **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 6: 名称前缀应用", () => {
  /**
   * **Feature: message-post-processing, Property 6: 名称前缀应用**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   *
   * *For any* message with name field, after processing:
   * (1) if role is not system, content should start with appropriate prefix
   * (2) name field should be removed
   */
  it("2.1-2.4: *For any* message with name, SHALL add prefix and remove name", () => {
    fc.assert(
      fc.property(
        messageWithNameArb,
        promptNamesArb,
        (msg, names) => {
          const result = normalizeNames([msg as ExtendedChatMessage], names);

          expect(result.length).toBe(1);
          const processed = result[0];

          // name 字段应该被移除
          expect(processed.name).toBeUndefined();

          // 非 system 角色应该有前缀
          if (msg.role !== "system") {
            const textContent = getTextContent(processed.content);
            const expectedPrefix = getExpectedPrefix(msg.name, names);

            if (expectedPrefix) {
              expect(textContent.startsWith(expectedPrefix)).toBe(true);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 6: 名称前缀应用**
   * **Validates: Requirements 2.1**
   *
   * *For any* message with name field AND role is not system,
   * content should start with "{name}: " prefix
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

          // 应该以 "name: " 开头
          expect(textContent.startsWith(`${msg.name}: `)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 6: 名称前缀应用**
   * **Validates: Requirements 2.2**
   *
   * *For any* message with name="example_assistant",
   * content should start with "{charName}: " prefix
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

          // 应该以 "charName: " 开头
          expect(textContent.startsWith(`${names.charName}: `)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 6: 名称前缀应用**
   * **Validates: Requirements 2.3**
   *
   * *For any* message with name="example_user",
   * content should start with "{userName}: " prefix
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

          // 应该以 "userName: " 开头
          expect(textContent.startsWith(`${names.userName}: `)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 6: 名称前缀应用**
   * **Validates: Requirements 2.4**
   *
   * *For any* message with name field, after processing name field should be removed
   */
  it("2.4: *For any* message with name, SHALL remove name field", () => {
    fc.assert(
      fc.property(
        messageWithNameArb,
        promptNamesArb,
        (msg, names) => {
          const result = normalizeNames([msg as ExtendedChatMessage], names);
          const processed = result[0];

          // name 字段应该被移除
          expect(processed.name).toBeUndefined();
          expect("name" in processed).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * system 角色消息不应该添加前缀
   */
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

          // system 消息内容应该保持不变
          expect(textContent).toBe(originalText);
          // name 字段仍应被移除
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
   *
   * *For any* message array, applying name normalization twice
   * should produce the same result as applying it once (no duplicate prefixes)
   */
  it("2.5: *For any* messages, normalizeNames(normalizeNames(x)) === normalizeNames(x)", () => {
    fc.assert(
      fc.property(
        messagesArb,
        promptNamesArb,
        (messages, names) => {
          const extMessages = messages as ExtendedChatMessage[];

          // 应用一次
          const once = normalizeNames(extMessages, names);

          // 应用两次
          const twice = normalizeNames(once, names);

          // 结果应该相同
          expect(twice.length).toBe(once.length);

          for (let i = 0; i < once.length; i++) {
            expect(getTextContent(twice[i].content)).toBe(
              getTextContent(once[i].content),
            );
            expect(twice[i].role).toBe(once[i].role);
            expect(twice[i].name).toBe(once[i].name);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * example_assistant 已有前缀时不应重复添加
   */
  it("example_assistant with existing charName prefix SHALL stay single", () => {
    fc.assert(
      fc.property(
        promptNamesArb,
        contentArb,
        (names, content) => {
          const msg: ExtendedChatMessage = {
            role: "assistant",
            content: `${names.charName}: ${content}`,
            name: "example_assistant",
          };

          const processed = normalizeNames([msg], names)[0];
          expect(getTextContent(processed.content)).toBe(`${names.charName}: ${content}`);
          expect(processed.name).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * example_user 已有前缀时不应重复添加
   */
  it("example_user with existing userName prefix SHALL stay single", () => {
    fc.assert(
      fc.property(
        promptNamesArb,
        contentArb,
        (names, content) => {
          const msg: ExtendedChatMessage = {
            role: "user",
            content: `${names.userName}: ${content}`,
            name: "example_user",
          };

          const processed = normalizeNames([msg], names)[0];
          expect(getTextContent(processed.content)).toBe(`${names.userName}: ${content}`);
          expect(processed.name).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 已有前缀的消息不应该重复添加
   */
  it("messages with existing prefix SHALL NOT get duplicate prefix", () => {
    fc.assert(
      fc.property(
        nonEmptyNameArb,
        contentArb,
        promptNamesArb,
        (name, content, names) => {
          // 创建已有前缀的消息
          const prefixedContent = `${name}: ${content}`;
          const msg: ExtendedChatMessage = {
            role: "user",
            content: prefixedContent,
            name: name,
          };

          const result = normalizeNames([msg], names);
          const processed = result[0];
          const textContent = getTextContent(processed.content);

          // 不应该有重复前缀
          const doublePrefix = `${name}: ${name}: `;
          expect(textContent.startsWith(doublePrefix)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 1: Merge 模式无连续同角色
   **Validates: Requirements 1.1**
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成完整角色（含 tool）
 */
const fullRoleArb = fc.constantFrom(
  "system" as const,
  "user" as const,
  "assistant" as const,
  "tool" as const,
);

/**
 * 生成带完整角色的消息
 */
const messageWithFullRoleArb = fc.record({
  role: fullRoleArb,
  content: contentArb,
});

/**
 * 生成消息数组（含 tool 角色）
 */
const messagesWithToolArb = fc.array(messageWithFullRoleArb, {
  minLength: 0,
  maxLength: 30,
});

describe("Property 1: Merge 模式无连续同角色", () => {
  /**
   * **Feature: message-post-processing, Property 1: Merge 模式无连续同角色**
   * **Validates: Requirements 1.1**
   *
   * *For any* message array processed with merge mode,
   * the output should have no two consecutive messages with the same role
   * (except tool messages which are never merged)
   */
  it("1.1: *For any* messages, merge SHALL produce no consecutive same roles (except tool)", () => {
    fc.assert(
      fc.property(messagesWithToolArb, (messages) => {
        const extMessages = messages as ExtendedChatMessage[];
        const result = mergeConsecutiveRoles(extMessages, false);

        // 检查连续消息的角色
        for (let i = 1; i < result.length; i++) {
          const prev = result[i - 1];
          const curr = result[i];

          // tool 角色不参与合并，可以连续出现
          if (prev.role === "tool" || curr.role === "tool") {
            continue;
          }

          // 非 tool 角色不应该连续相同
          expect(prev.role).not.toBe(curr.role);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * 合并应该保留所有内容（内容不丢失）
   */
  it("merge SHALL preserve all text content", () => {
    fc.assert(
      fc.property(messagesWithToolArb, (messages) => {
        const extMessages = messages as ExtendedChatMessage[];
        const result = mergeConsecutiveRoles(extMessages, false);

        // 计算合并后总文本
        const mergedText = result
          .map((m) => getTextContent(m.content))
          .join("");

        // 原始文本的所有字符都应该在合并后的文本中
        // 注意：合并会添加换行符，所以只检查原始字符是否存在
        for (const msg of extMessages) {
          const text = getTextContent(msg.content);
          if (text) {
            expect(mergedText).toContain(text);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * tool 角色消息永不合并
   */
  it("tool role messages SHALL never be merged", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            role: fc.constant("tool" as const),
            content: contentArb,
          }),
          { minLength: 2, maxLength: 10 },
        ),
        (toolMessages) => {
          const extMessages = toolMessages as ExtendedChatMessage[];
          const result = mergeConsecutiveRoles(extMessages, false);

          // tool 消息数量应该保持不变
          expect(result.length).toBe(extMessages.length);

          // 每条 tool 消息的内容应该保持不变
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
   *
   * *For any* non-empty message array processed with single mode,
   * the output should contain exactly one message with role "user"
   * (unless there are tool messages, which remain separate)
   */
  it("1.4: *For any* non-empty messages without tool, single mode SHALL produce exactly one user message", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            role: fc.constantFrom(
              "system" as const,
              "user" as const,
              "assistant" as const,
            ),
            content: contentArb,
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (messages) => {
          const extMessages = messages as ExtendedChatMessage[];
          const result = mergeConsecutiveRoles(extMessages, true);

          // 应该只有一条消息
          expect(result.length).toBe(1);

          // 角色应该是 user
          expect(result[0].role).toBe("user");
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * single 模式应该保留所有内容
   */
  it("single mode SHALL preserve all text content in merged message", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            role: fc.constantFrom(
              "system" as const,
              "user" as const,
              "assistant" as const,
            ),
            content: contentArb,
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (messages) => {
          const extMessages = messages as ExtendedChatMessage[];
          const result = mergeConsecutiveRoles(extMessages, true);

          const mergedContent = getTextContent(result[0].content);

          // 每条原始消息的内容都应该在合并结果中
          for (const msg of extMessages) {
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

  /**
   * single 模式下 tool 消息仍然保持独立
   */
  it("single mode SHALL keep tool messages separate", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(
            fc.record({
              role: fc.constantFrom(
                "system" as const,
                "user" as const,
                "assistant" as const,
              ),
              content: contentArb,
            }),
            { minLength: 1, maxLength: 5 },
          ),
          fc.array(
            fc.record({
              role: fc.constant("tool" as const),
              content: contentArb,
            }),
            { minLength: 1, maxLength: 3 },
          ),
        ),
        ([normalMessages, toolMessages]) => {
          // 交错排列消息
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

          // tool 消息数量应该保持不变
          const toolCount = result.filter((m) => m.role === "tool").length;
          expect(toolCount).toBe(toolMessages.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 空数组应该返回空数组
   */
  it("empty array SHALL return empty array", () => {
    const result = mergeConsecutiveRoles([], false);
    expect(result).toEqual([]);

    const resultSingle = mergeConsecutiveRoles([], true);
    expect(resultSingle).toEqual([]);
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
   *
   * *For any* message with array content, after processing
   * the content should remain an array (not converted to string)
   */
  it("3.1: *For any* message with array content, SHALL preserve array structure", () => {
    fc.assert(
      fc.property(
        fc.record({
          role: roleArb,
          content: fc.oneof(contentArrayWithTextArb, contentArrayWithoutTextArb),
        }),
        (msg) => {
          const extMsg = msg as ExtendedChatMessage;
          const result = mergeConsecutiveRoles([extMsg], false);

          expect(result.length).toBe(1);
          // 数组 content 应该保持为数组
          expect(Array.isArray(result[0].content)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 名称规范化后数组 content 仍应保持为数组
   */
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
          const extMsg = msg as ExtendedChatMessage;
          const result = normalizeNames([extMsg], names);

          expect(result.length).toBe(1);
          // 数组 content 应该保持为数组
          expect(Array.isArray(result[0].content)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 无文本片段的数组 content 也应保持为数组
   */
  it("3.1: *For any* message with non-text array content, SHALL preserve array", () => {
    fc.assert(
      fc.property(
        fc.record({
          role: roleArb,
          content: contentArrayWithoutTextArb,
        }),
        (msg) => {
          const extMsg = msg as ExtendedChatMessage;
          const result = mergeConsecutiveRoles([extMsg], false);

          expect(result.length).toBe(1);
          expect(Array.isArray(result[0].content)).toBe(true);
          // 长度应该保持不变
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
   *
   * *For any* two consecutive same-role messages with array content,
   * after merge the result content array length should equal
   * the sum of input array lengths
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

          // 应该合并为一条消息
          expect(result.length).toBe(1);

          // 结果应该是数组
          expect(Array.isArray(result[0].content)).toBe(true);

          // 数组长度应该等于两个输入数组长度之和
          const resultArray = result[0].content as unknown[];
          expect(resultArray.length).toBe(content1.length + content2.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 混合 string 和 array content 合并时，string 应转为 TextContentPart
   */
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

          // 应该合并为一条消息
          expect(result.length).toBe(1);

          // 结果应该是数组（混合类型合并后为数组）
          expect(Array.isArray(result[0].content)).toBe(true);

          // 数组长度应该是 1（string 转为一个 text part）+ arrayContent.length
          const resultArray = result[0].content as unknown[];
          expect(resultArray.length).toBe(1 + arrayContent.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * array + string 合并时，string 应转为 TextContentPart
   */
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

          // 应该合并为一条消息
          expect(result.length).toBe(1);

          // 结果应该是数组
          expect(Array.isArray(result[0].content)).toBe(true);

          // 数组长度应该是 arrayContent.length + 1（string 转为一个 text part）
          const resultArray = result[0].content as unknown[];
          expect(resultArray.length).toBe(arrayContent.length + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 多条同角色消息合并时，所有数组内容应该正确连接
   */
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

          // 应该合并为一条消息
          expect(result.length).toBe(1);

          // 结果应该是数组
          expect(Array.isArray(result[0].content)).toBe(true);

          // 数组长度应该等于所有输入数组长度之和
          const expectedLength = contents.reduce((sum, c) => sum + c.length, 0);
          const resultArray = result[0].content as unknown[];
          expect(resultArray.length).toBe(expectedLength);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 合并后的数组应该保留所有原始内容片段
   */
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

          // 检查所有原始片段都存在于结果中
          // 前半部分应该是 content1
          for (let i = 0; i < content1.length; i++) {
            expect(resultArray[i]).toEqual(content1[i]);
          }

          // 后半部分应该是 content2
          for (let i = 0; i < content2.length; i++) {
            expect(resultArray[content1.length + i]).toEqual(content2[i]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 2: Semi 模式仅首条可为 system
   **Validates: Requirements 1.2**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 2: Semi 模式仅首条可为 system", () => {
  /**
   * **Feature: message-post-processing, Property 2: Semi 模式仅首条可为 system**
   * **Validates: Requirements 1.2**
   *
   * *For any* message array processed with semi mode,
   * only the first message may have role "system",
   * all subsequent system messages become user
   */
  it("1.2: *For any* messages, convertMidSystemToUser SHALL convert non-first system to user", () => {
    fc.assert(
      fc.property(messagesWithToolArb, (messages) => {
        const extMessages = messages as ExtendedChatMessage[];
        const result = convertMidSystemToUser(extMessages);

        // 检查结果长度不变
        expect(result.length).toBe(extMessages.length);

        // 检查非首条消息不能是 system
        for (let i = 1; i < result.length; i++) {
          expect(result[i].role).not.toBe("system");
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * 首条 system 消息应该保持不变
   */
  it("1.2: first system message SHALL remain system", () => {
    fc.assert(
      fc.property(
        fc.record({
          role: fc.constant("system" as const),
          content: contentArb,
        }),
        messagesWithToolArb,
        (firstMsg, restMessages) => {
          const messages = [
            firstMsg as ExtendedChatMessage,
            ...(restMessages as ExtendedChatMessage[]),
          ];
          const result = convertMidSystemToUser(messages);

          // 首条 system 应该保持 system
          expect(result[0].role).toBe("system");
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 非首条 system 消息应该转为 user
   */
  it("1.2: non-first system messages SHALL become user", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            role: fc.constant("system" as const),
            content: contentArb,
          }),
          { minLength: 2, maxLength: 10 },
        ),
        (systemMessages) => {
          const extMessages = systemMessages as ExtendedChatMessage[];
          const result = convertMidSystemToUser(extMessages);

          // 首条保持 system
          expect(result[0].role).toBe("system");

          // 其余全部变为 user
          for (let i = 1; i < result.length; i++) {
            expect(result[i].role).toBe("user");
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 非 system 消息应该保持原角色
   */
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

          // 所有消息角色应该保持不变
          for (let i = 0; i < result.length; i++) {
            expect(result[i].role).toBe(extMessages[i].role);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 内容应该保持不变
   */
  it("1.2: content SHALL remain unchanged", () => {
    fc.assert(
      fc.property(messagesWithToolArb, (messages) => {
        const extMessages = messages as ExtendedChatMessage[];
        const result = convertMidSystemToUser(extMessages);

        // 所有消息内容应该保持不变
        for (let i = 0; i < result.length; i++) {
          expect(getTextContent(result[i].content)).toBe(
            getTextContent(extMessages[i].content),
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
   *
   * *For any* message array processed with strict mode,
   * if the first message is system then the second must be user;
   * if the first is not system then the first must be user
   */
  it("1.3: *For any* non-empty messages, ensureUserStart SHALL guarantee user start", () => {
    fc.assert(
      fc.property(
        fc.array(messageWithFullRoleArb, { minLength: 1, maxLength: 20 }),
        (messages) => {
          const extMessages = messages as ExtendedChatMessage[];
          const result = ensureUserStart(extMessages);

          // 结果不应为空
          expect(result.length).toBeGreaterThan(0);

          const first = result[0];

          if (first.role === "system") {
            // 如果首条是 system，第二条必须是 user
            expect(result.length).toBeGreaterThanOrEqual(2);
            expect(result[1].role).toBe("user");
          } else {
            // 如果首条不是 system，首条必须是 user
            expect(first.role).toBe("user");
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 5.2: 首条是 system 且第二条不是 user 时，应插入占位符
   */
  it("5.2: *For any* [system, non-user, ...], SHALL insert placeholder after system", () => {
    fc.assert(
      fc.property(
        fc.record({
          role: fc.constant("system" as const),
          content: contentArb,
        }),
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

          // 首条仍是 system
          expect(result[0].role).toBe("system");

          // 第二条应该是插入的 user 占位符
          expect(result[1].role).toBe("user");

          // 原来的第二条消息应该变成第三条
          expect(result[2].role).toBe(nonUserMsg.role);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 5.3: 首条不是 system 也不是 user 时，应在开头插入占位符
   */
  it("5.3: *For any* [non-system-non-user, ...], SHALL insert placeholder at start", () => {
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

          // 首条应该是插入的 user 占位符
          expect(result[0].role).toBe("user");

          // 原来的首条消息应该变成第二条
          expect(result[1].role).toBe(firstMsg.role);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 首条已经是 user 时，不应插入占位符
   */
  it("1.3: *For any* [user, ...], SHALL NOT insert placeholder", () => {
    fc.assert(
      fc.property(
        fc.record({
          role: fc.constant("user" as const),
          content: contentArb,
        }),
        fc.array(messageWithFullRoleArb, { minLength: 0, maxLength: 5 }),
        (userMsg, rest) => {
          const messages = [
            userMsg as ExtendedChatMessage,
            ...(rest as ExtendedChatMessage[]),
          ];
          const result = ensureUserStart(messages);

          // 长度应该不变
          expect(result.length).toBe(messages.length);

          // 首条应该是原来的 user 消息
          expect(result[0].role).toBe("user");
          expect(getTextContent(result[0].content)).toBe(
            getTextContent(userMsg.content),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * [system, user, ...] 时，不应插入占位符
   */
  it("1.3: *For any* [system, user, ...], SHALL NOT insert placeholder", () => {
    fc.assert(
      fc.property(
        fc.record({
          role: fc.constant("system" as const),
          content: contentArb,
        }),
        fc.record({
          role: fc.constant("user" as const),
          content: contentArb,
        }),
        fc.array(messageWithFullRoleArb, { minLength: 0, maxLength: 5 }),
        (systemMsg, userMsg, rest) => {
          const messages = [
            systemMsg as ExtendedChatMessage,
            userMsg as ExtendedChatMessage,
            ...(rest as ExtendedChatMessage[]),
          ];
          const result = ensureUserStart(messages);

          // 长度应该不变
          expect(result.length).toBe(messages.length);

          // 前两条应该保持不变
          expect(result[0].role).toBe("system");
          expect(result[1].role).toBe("user");
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 只有一条 system 消息时，应插入 user 占位符
   */
  it("5.2: single system message SHALL get user placeholder appended", () => {
    fc.assert(
      fc.property(
        fc.record({
          role: fc.constant("system" as const),
          content: contentArb,
        }),
        (systemMsg) => {
          const messages = [systemMsg as ExtendedChatMessage];
          const result = ensureUserStart(messages);

          // 应该有两条消息
          expect(result.length).toBe(2);

          // 首条是 system，第二条是 user
          expect(result[0].role).toBe("system");
          expect(result[1].role).toBe("user");
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 空数组应该返回空数组（ensureUserStart 不处理空数组）
   */
  it("empty array SHALL return empty array", () => {
    const result = ensureUserStart([]);
    expect(result).toEqual([]);
  });

  /**
   * 自定义占位符应该被使用
   */
  it("custom placeholder SHALL be used", () => {
    fc.assert(
      fc.property(
        fc.record({
          role: fc.constantFrom("assistant" as const, "tool" as const),
          content: contentArb,
        }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (firstMsg, placeholder) => {
          const messages = [firstMsg as ExtendedChatMessage];
          const result = ensureUserStart(messages, placeholder);

          // 首条应该是插入的 user 占位符
          expect(result[0].role).toBe("user");
          expect(getTextContent(result[0].content)).toBe(placeholder);
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
   *
   * *For any* input (including empty array),
   * the output should contain at least one message
   */
  it("5.1: empty array SHALL produce single user message", () => {
    const result = ensureNonEmpty([]);

    expect(result.length).toBe(1);
    expect(result[0].role).toBe("user");
    expect(getTextContent(result[0].content)).toBe("Let's get started.");
  });

  /**
   * 非空数组应该保持不变
   */
  it("5.1: *For any* non-empty messages, ensureNonEmpty SHALL return unchanged", () => {
    fc.assert(
      fc.property(
        fc.array(messageWithFullRoleArb, { minLength: 1, maxLength: 20 }),
        (messages) => {
          const extMessages = messages as ExtendedChatMessage[];
          const result = ensureNonEmpty(extMessages);

          // 长度应该不变
          expect(result.length).toBe(extMessages.length);

          // 内容应该相同（引用相等或深度相等）
          expect(result).toBe(extMessages);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 自定义占位符应该被使用
   */
  it("5.1: custom placeholder SHALL be used for empty array", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (placeholder) => {
          const result = ensureNonEmpty([], placeholder);

          expect(result.length).toBe(1);
          expect(result[0].role).toBe("user");
          expect(getTextContent(result[0].content)).toBe(placeholder);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 输出总是至少有一条消息
   */
  it("5.1: *For any* input, output SHALL have at least one message", () => {
    fc.assert(
      fc.property(
        fc.array(messageWithFullRoleArb, { minLength: 0, maxLength: 20 }),
        (messages) => {
          const extMessages = messages as ExtendedChatMessage[];
          const result = ensureNonEmpty(extMessages);

          expect(result.length).toBeGreaterThanOrEqual(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 10: 工具选项处理
   **Validates: Requirements 4.1, 4.2, 4.3**
   ═══════════════════════════════════════════════════════════════════════════ */

import { stripTools } from "../prompt/post-processor";
import type { ToolCall } from "../st-preset-types";

/**
 * 生成 ToolCall 对象
 */
const toolCallArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  type: fc.constant("function" as const),
  function: fc.record({
    name: fc.string({ minLength: 1, maxLength: 20 }),
    arguments: fc.json(),
  }),
});

/**
 * 生成带 tool_calls 的 assistant 消息
 */
const messageWithToolCallsArb = fc.record({
  role: fc.constant("assistant" as const),
  content: contentArb,
  tool_calls: fc.array(toolCallArb, { minLength: 1, maxLength: 3 }),
});

/**
 * 生成带 tool_call_id 的 tool 消息
 */
const toolMessageArb = fc.record({
  role: fc.constant("tool" as const),
  content: contentArb,
  tool_call_id: fc.string({ minLength: 1, maxLength: 20 }),
});

/**
 * 生成混合消息数组（含工具相关字段）
 */
const messagesWithToolFieldsArb = fc.array(
  fc.oneof(
    messageWithToolCallsArb,
    toolMessageArb,
    messageWithoutNameArb,
  ),
  { minLength: 1, maxLength: 15 },
);

describe("Property 10: 工具选项处理", () => {
  /**
   * **Feature: message-post-processing, Property 10: 工具选项处理**
   * **Validates: Requirements 4.2**
   *
   * *For any* message array with tool_calls/tool_call_id,
   * if tools=false then output should have no tool_calls fields
   */
  it("4.2: *For any* messages with tool_calls, stripTools SHALL remove tool_calls", () => {
    fc.assert(
      fc.property(
        fc.array(messageWithToolCallsArb, { minLength: 1, maxLength: 10 }),
        (messages) => {
          const extMessages = messages as ExtendedChatMessage[];
          const result = stripTools(extMessages);

          // 所有消息都不应该有 tool_calls 字段
          for (const msg of result) {
            expect(msg.tool_calls).toBeUndefined();
            expect("tool_calls" in msg).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 10: 工具选项处理**
   * **Validates: Requirements 4.2**
   *
   * *For any* message array with tool_call_id,
   * if tools=false then output should have no tool_call_id fields
   */
  it("4.2: *For any* messages with tool_call_id, stripTools SHALL remove tool_call_id", () => {
    fc.assert(
      fc.property(
        fc.array(toolMessageArb, { minLength: 1, maxLength: 10 }),
        (messages) => {
          const extMessages = messages as ExtendedChatMessage[];
          const result = stripTools(extMessages);

          // 所有消息都不应该有 tool_call_id 字段
          for (const msg of result) {
            expect(msg.tool_call_id).toBeUndefined();
            expect("tool_call_id" in msg).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 10: 工具选项处理**
   * **Validates: Requirements 4.3**
   *
   * *For any* message with role "tool",
   * if tools=false then role should be converted to "user"
   */
  it("4.3: *For any* tool role messages, stripTools SHALL convert to user", () => {
    fc.assert(
      fc.property(
        fc.array(toolMessageArb, { minLength: 1, maxLength: 10 }),
        (messages) => {
          const extMessages = messages as ExtendedChatMessage[];
          const result = stripTools(extMessages);

          // 所有原 tool 消息都应该变成 user
          for (const msg of result) {
            expect(msg.role).toBe("user");
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-post-processing, Property 10: 工具选项处理**
   * **Validates: Requirements 4.2, 4.3**
   *
   * *For any* mixed message array,
   * stripTools SHALL remove all tool-related fields and convert tool roles
   */
  it("4.2-4.3: *For any* mixed messages, stripTools SHALL clean all tool artifacts", () => {
    fc.assert(
      fc.property(messagesWithToolFieldsArb, (messages) => {
        const extMessages = messages as ExtendedChatMessage[];
        const result = stripTools(extMessages);

        // 检查所有消息
        for (const msg of result) {
          // 无 tool_calls
          expect(msg.tool_calls).toBeUndefined();
          expect("tool_calls" in msg).toBe(false);

          // 无 tool_call_id
          expect(msg.tool_call_id).toBeUndefined();
          expect("tool_call_id" in msg).toBe(false);

          // 无 tool 角色
          expect(msg.role).not.toBe("tool");
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * stripTools 应该保留消息内容不变
   */
  it("4.2-4.3: stripTools SHALL preserve message content", () => {
    fc.assert(
      fc.property(messagesWithToolFieldsArb, (messages) => {
        const extMessages = messages as ExtendedChatMessage[];
        const result = stripTools(extMessages);

        // 消息数量应该不变
        expect(result.length).toBe(extMessages.length);

        // 每条消息的内容应该保持不变
        for (let i = 0; i < result.length; i++) {
          expect(getTextContent(result[i].content)).toBe(
            getTextContent(extMessages[i].content),
          );
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * stripTools 应该保留非工具相关字段
   */
  it("4.2-4.3: stripTools SHALL preserve non-tool fields", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            role: fc.constantFrom("user" as const, "assistant" as const, "system" as const),
            content: contentArb,
            identifier: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (messages) => {
          const extMessages = messages as ExtendedChatMessage[];
          const result = stripTools(extMessages);

          // 消息数量应该不变
          expect(result.length).toBe(extMessages.length);

          // 每条消息的角色和内容应该保持不变
          for (let i = 0; i < result.length; i++) {
            expect(result[i].role).toBe(extMessages[i].role);
            expect(getTextContent(result[i].content)).toBe(
              getTextContent(extMessages[i].content),
            );
            // identifier 字段应该保留
            if (extMessages[i].identifier) {
              expect(result[i].identifier).toBe(extMessages[i].identifier);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 空数组应该返回空数组
   */
  it("4.2-4.3: empty array SHALL return empty array", () => {
    const result = stripTools([]);
    expect(result).toEqual([]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   辅助函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 计算期望的前缀
 */
function getExpectedPrefix(name: string, names: PromptNames): string {
  if (name === "example_assistant") {
    return names.charName ? `${names.charName}: ` : "";
  }
  if (name === "example_user") {
    return names.userName ? `${names.userName}: ` : "";
  }
  return name ? `${name}: ` : "";
}
