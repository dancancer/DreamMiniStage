/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     ContextNode 属性测试                                    ║
 * ║                                                                            ║
 * ║  验证 ContextNode 仅做 messages[] 透传，不再处理字符串兼容逻辑。              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { ContextNode } from "../ContextNode/ContextNode";
import { ContextNodeTools } from "../ContextNode/ContextNodeTools";

async function callContextNode(input: {
  messages?: Array<{ role: string; content: string }>;
}): Promise<{
  messages: Array<{ role: string; content: string }> | undefined;
}> {
  const node = new ContextNode({
    id: "test-context",
    name: "context",
  });
  return await (node as unknown as { _call: (value: typeof input) => Promise<{ messages: Array<{ role: string; content: string }> | undefined }> })._call(input);
}

const messageArb = fc.record({
  role: fc.constantFrom("user", "assistant", "system"),
  content: fc.string({ minLength: 0, maxLength: 500 }),
});
const messagesArb = fc.array(messageArb, { minLength: 0, maxLength: 20 });

describe("Property 10: ContextNode 透传约束", () => {
  it("*For any* input, ContextNode SHALL pass through messages unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(
        messagesArb,
        async (messages) => {
          const result = await callContextNode({ messages });
          expect(result.messages).toEqual(messages);
          expect(result.messages).toBe(messages);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("ContextNodeTools 不应再提供字符串占位符替换方法", () => {
    expect(typeof (ContextNodeTools as unknown as Record<string, unknown>).replaceHistoryPlaceholder).toBe("undefined");
  });

  it("undefined messages SHOULD remain undefined", async () => {
    const result = await callContextNode({});
    expect(result.messages).toBeUndefined();
  });
});
