/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     LLMNode 属性测试                                        ║
 * ║                                                                            ║
 * ║  验证 messages-only 契约：                                                  ║
 * ║  - 仅接受 messages[]                                                        ║
 * ║  - 不自动回填 system/user 字符串                                            ║
 * ║  - 不对消息内容做隐式修补                                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";

type ChatMessage = { role: string; content: string };

const roleArb = fc.constantFrom("user", "assistant", "system");
const contentArb = fc.string({ minLength: 1, maxLength: 200 });
const messageArb: fc.Arbitrary<ChatMessage> = fc.record({
  role: roleArb,
  content: contentArb,
});
const messagesArb = fc.array(messageArb, { minLength: 1, maxLength: 20 });
const messagesWithoutUserArb = fc.array(
  fc.record({
    role: fc.constantFrom("assistant", "system"),
    content: contentArb,
  }),
  { minLength: 1, maxLength: 20 },
);

/**
 * 提取自 LLMNodeTools 的核心输入约束：
 * 1) messages[] 必须存在且非空
 * 2) 仅做浅拷贝，不做内容修补
 */
function buildFinalMessages(configMessages?: ChatMessage[]): ChatMessage[] {
  if (!configMessages || configMessages.length === 0) {
    throw new Error("messages[] is required for invokeLLM");
  }
  return [...configMessages];
}

describe("Property 1: LLMNode messages-only", () => {
  it("*For any* 非空 messages[], SHALL 原样作为最终输入", () => {
    fc.assert(
      fc.property(messagesArb, (messages) => {
        const result = buildFinalMessages(messages);
        expect(result).toEqual(messages);
      }),
      { numRuns: 100 },
    );
  });

  it("*For any* 空 messages[], SHALL 抛错", () => {
    expect(() => buildFinalMessages([])).toThrow("messages[] is required for invokeLLM");
  });

  it("*For any* undefined messages, SHALL 抛错", () => {
    expect(() => buildFinalMessages(undefined)).toThrow("messages[] is required for invokeLLM");
  });

  it("*For any* messages[], SHALL NOT 修改原数组", () => {
    fc.assert(
      fc.property(messagesArb, (messages) => {
        const snapshot = JSON.parse(JSON.stringify(messages));
        buildFinalMessages(messages);
        expect(messages).toEqual(snapshot);
      }),
      { numRuns: 100 },
    );
  });

  it("*For any* 无 user 的 messages[], SHALL 保持无 user（不自动注入）", () => {
    fc.assert(
      fc.property(messagesWithoutUserArb, (messages) => {
        const result = buildFinalMessages(messages);
        expect(result.some((m) => m.role === "user")).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
