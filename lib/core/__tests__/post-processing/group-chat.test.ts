/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              群聊前缀测试                                                   ║
 * ║                                                                            ║
 * ║  验证群聊场景下的说话人前缀写入/移除逻辑                                      ║
 * ║  对齐 SillyTavern prompt-converter 行为                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import { normalizeNames, postProcessMessages } from "../../prompt/post-processor";
import { PostProcessingMode } from "../../st-preset-types";
import type { ExtendedChatMessage, PromptNames } from "../../st-preset-types";

/* ═══════════════════════════════════════════════════════════════════════════
   测试数据
   ═══════════════════════════════════════════════════════════════════════════ */

const groupNames: PromptNames = {
  charName: "Alice",
  userName: "Player",
  groupNames: ["Bob", "Charlie", "Diana"],
  startsWithGroupName: (msg: string) =>
    ["Bob", "Charlie", "Diana"].some((name) => msg.startsWith(`${name}: `)),
};

/* ═══════════════════════════════════════════════════════════════════════════
   群聊成员前缀测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("群聊前缀: normalizeNames", () => {
  it("应为群聊成员名添加前缀", () => {
    const messages: ExtendedChatMessage[] = [
      { role: "assistant", content: "Hello everyone!", name: "Bob" },
      { role: "assistant", content: "Nice to meet you.", name: "Charlie" },
    ];

    const result = normalizeNames(messages, groupNames);

    expect(result[0].content).toBe("Bob: Hello everyone!");
    expect(result[0].name).toBeUndefined();
    expect(result[1].content).toBe("Charlie: Nice to meet you.");
    expect(result[1].name).toBeUndefined();
  });

  it("应为 example_assistant 使用 charName", () => {
    const messages: ExtendedChatMessage[] = [
      { role: "assistant", content: "I'm the main character.", name: "example_assistant" },
    ];

    const result = normalizeNames(messages, groupNames);

    expect(result[0].content).toBe("Alice: I'm the main character.");
  });

  it("应为 example_user 使用 userName", () => {
    const messages: ExtendedChatMessage[] = [
      { role: "user", content: "Hello!", name: "example_user" },
    ];

    const result = normalizeNames(messages, groupNames);

    expect(result[0].content).toBe("Player: Hello!");
  });

  it("非群聊成员的普通 name 应直接作为前缀", () => {
    const messages: ExtendedChatMessage[] = [
      { role: "assistant", content: "I'm a guest.", name: "Guest" },
    ];

    const result = normalizeNames(messages, groupNames);

    expect(result[0].content).toBe("Guest: I'm a guest.");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   幂等性测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("群聊前缀: 幂等性", () => {
  it("已有前缀的消息不应重复添加", () => {
    const messages: ExtendedChatMessage[] = [
      { role: "assistant", content: "Bob: Already has prefix.", name: "Bob" },
    ];

    const result = normalizeNames(messages, groupNames);

    // 不应重复添加前缀
    expect(result[0].content).toBe("Bob: Already has prefix.");
    expect(result[0].name).toBeUndefined();
  });

  it("startsWithGroupName 应正确检测已有前缀", () => {
    const messages: ExtendedChatMessage[] = [
      { role: "assistant", content: "Charlie: I said this.", name: "SomeOtherName" },
    ];

    const result = normalizeNames(messages, groupNames);

    // 即使 name 不匹配，但 content 已有群聊成员前缀，不应添加新前缀
    expect(result[0].content).toBe("Charlie: I said this.");
  });

  it("多次调用 normalizeNames 应产生相同结果", () => {
    const messages: ExtendedChatMessage[] = [
      { role: "assistant", content: "Hello!", name: "Bob" },
    ];

    const result1 = normalizeNames(messages, groupNames);
    // 移除 name 后再次调用（模拟已处理过的消息）
    const result2 = normalizeNames(result1, groupNames);

    expect(result1).toEqual(result2);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   postProcessMessages 集成测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("群聊前缀: postProcessMessages 集成", () => {
  it("MERGE 模式应正确处理群聊前缀", () => {
    const messages: ExtendedChatMessage[] = [
      { role: "user", content: "Hi everyone!" },
      { role: "assistant", content: "Hello!", name: "Bob" },
      { role: "assistant", content: "Hi there!", name: "Charlie" },
    ];

    const result = postProcessMessages(messages, {
      mode: PostProcessingMode.MERGE,
      names: groupNames,
    });

    // 检查前缀正确添加
    expect(result.some((m) => m.content === "Bob: Hello!\nCharlie: Hi there!")).toBe(true);
  });

  it("STRICT 模式应正确处理群聊前缀", () => {
    const messages: ExtendedChatMessage[] = [
      { role: "system", content: "System prompt" },
      { role: "assistant", content: "Welcome!", name: "Diana" },
    ];

    const result = postProcessMessages(messages, {
      mode: PostProcessingMode.STRICT,
      names: groupNames,
    });

    // Diana 的消息应有前缀
    const dianaMsg = result.find((m) =>
      typeof m.content === "string" && m.content.includes("Diana:"),
    );
    expect(dianaMsg).toBeDefined();
  });

  it("NONE 模式应保留 name 字段不添加前缀", () => {
    const messages: ExtendedChatMessage[] = [
      { role: "assistant", content: "Hello!", name: "Bob" },
    ];

    const result = postProcessMessages(messages, {
      mode: PostProcessingMode.NONE,
      names: groupNames,
    });

    // NONE 模式不处理
    expect(result[0].content).toBe("Hello!");
    expect(result[0].name).toBe("Bob");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   边界情况测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("群聊前缀: 边界情况", () => {
  it("空 groupNames 数组应正常工作", () => {
    const emptyGroupNames: PromptNames = {
      charName: "Alice",
      userName: "Player",
      groupNames: [],
      startsWithGroupName: () => false,
    };

    const messages: ExtendedChatMessage[] = [
      { role: "assistant", content: "Hello!", name: "Bob" },
    ];

    const result = normalizeNames(messages, emptyGroupNames);

    // 应使用普通 name 前缀逻辑
    expect(result[0].content).toBe("Bob: Hello!");
  });

  it("system 角色不应添加群聊前缀", () => {
    const messages: ExtendedChatMessage[] = [
      { role: "system", content: "System message", name: "Bob" },
    ];

    const result = normalizeNames(messages, groupNames);

    expect(result[0].content).toBe("System message");
    expect(result[0].name).toBeUndefined();
  });

  it("多模态内容应正确添加前缀", () => {
    const messages: ExtendedChatMessage[] = [
      {
        role: "assistant",
        content: [{ type: "text", text: "Hello!" }],
        name: "Bob",
      },
    ];

    const result = normalizeNames(messages, groupNames);

    expect(result[0].content).toEqual([{ type: "text", text: "Bob: Hello!" }]);
  });
});
