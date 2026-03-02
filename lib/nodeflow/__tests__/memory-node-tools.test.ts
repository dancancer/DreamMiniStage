import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryNodeTools } from "../MemoryNode/MemoryNodeTools";

describe("MemoryNodeTools.retrieveAndInjectMemories", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("命中记忆时应替换 system 消息中的 {{memory}} 占位符", async () => {
    const searchSpy = vi.spyOn(MemoryNodeTools, "searchMemories").mockResolvedValue({
      success: true,
      results: [{ type: "fact", content: "用户喜欢黑咖啡" }],
      count: 1,
    });

    const messages = [
      { role: "system", content: "规则前缀\n{{memory}}\n规则后缀" },
      { role: "user", content: "今天喝了什么？" },
    ];

    const result = await MemoryNodeTools.retrieveAndInjectMemories(
      "char-1",
      "今天喝了什么？",
      messages,
      "api-key",
    );

    expect(searchSpy).toHaveBeenCalled();
    expect(result.memoryCount).toBe(1);
    expect(result.messages[0].content).toContain("相关记忆");
    expect(result.messages[0].content).not.toContain("{{memory}}");
    expect(messages[0].content).toContain("{{memory}}");
  });

  it("没有 system 消息时应自动注入 memory system 消息", async () => {
    vi.spyOn(MemoryNodeTools, "searchMemories").mockResolvedValue({
      success: true,
      results: [{ type: "fact", content: "用户来自杭州" }],
      count: 1,
    });

    const messages = [{ role: "user", content: "我来自哪里？" }];
    const result = await MemoryNodeTools.retrieveAndInjectMemories(
      "char-2",
      "我来自哪里？",
      messages,
      "api-key",
    );

    expect(result.messages[0].role).toBe("system");
    expect(result.messages[0].content).toContain("<memory>");
    expect(result.messages[1]).toEqual(messages[0]);
  });

  it("无记忆命中时应保持 messages 不变", async () => {
    vi.spyOn(MemoryNodeTools, "searchMemories").mockResolvedValue({
      success: true,
      results: [],
      count: 0,
    });

    const messages = [
      { role: "system", content: "仅系统提示" },
      { role: "user", content: "用户输入" },
    ];

    const result = await MemoryNodeTools.retrieveAndInjectMemories(
      "char-3",
      "用户输入",
      messages,
      "api-key",
    );

    expect(result.memoryCount).toBe(0);
    expect(result.messages).toBe(messages);
    expect(result.messages).toEqual(messages);
  });
});
