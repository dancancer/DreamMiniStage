import { describe, expect, it } from "vitest";
import {
  applyContextWindowToMessages,
  estimateMessageTokens,
} from "@/lib/model-runtime";

describe("applyContextWindowToMessages", () => {
  function totalTokens(messages: Array<{ content: string }>): number {
    return messages.reduce((sum, message) => sum + estimateMessageTokens(message.content), 0);
  }

  it("在 system prompt 自身超过预算时仍保证结果不超预算", () => {
    const messages = [
      { role: "system", content: "A".repeat(200) },
      { role: "user", content: "hello" },
    ];

    const result = applyContextWindowToMessages(messages, {
      contextWindow: 40,
      maxTokens: 10,
    });

    expect(totalTokens(result)).toBeLessThanOrEqual(30);
  });

  it("裁剪上下文时保持保留消息的原始相对顺序", () => {
    const messages = [
      { id: "s1", role: "system", content: "intro" },
      { id: "u1", role: "user", content: "first user turn" },
      { id: "s2", role: "system", content: "late system guard" },
      { id: "a1", role: "assistant", content: "assistant answer" },
      { id: "u2", role: "user", content: "latest user turn that should survive" },
    ];

    const result = applyContextWindowToMessages(messages, {
      contextWindow: 28,
      maxTokens: 6,
    });

    const ids = result.map((message) => message.id);
    expect(ids).toEqual([...ids].sort((left, right) => {
      const leftIndex = messages.findIndex((message) => message.id === left);
      const rightIndex = messages.findIndex((message) => message.id === right);
      return leftIndex - rightIndex;
    }));
  });

  it("在最新用户消息单条超预算时会裁剪到预算内", () => {
    const messages = [
      { role: "system", content: "System prompt." },
      { role: "assistant", content: "Short reply." },
      { role: "user", content: "B".repeat(240) },
    ];

    const result = applyContextWindowToMessages(messages, {
      contextWindow: 60,
      maxTokens: 20,
    });

    expect(totalTokens(result)).toBeLessThanOrEqual(40);
    expect(result[result.length - 1]?.role).toBe("user");
    expect(result[result.length - 1]?.content.length).toBeLessThan(messages[2].content.length);
  });
});
