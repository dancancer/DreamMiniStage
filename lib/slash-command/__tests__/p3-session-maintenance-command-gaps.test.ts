import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-session-1",
    messages: [
      { id: "m-0", role: "user", content: "hello" },
      { id: "m-1", role: "assistant", content: "world" },
      { id: "m-2", role: "system", content: "sys" },
    ],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

describe("P3 session maintenance command gaps", () => {
  it("/count 使用 countTokens 回调并忽略 system 消息", async () => {
    const countTokens = vi.fn().mockResolvedValue(42);
    const ctx = createContext({
      messages: [
        { id: "m-0", role: "user", content: "alpha" },
        { id: "m-1", role: "system", content: "hidden" },
        { id: "m-2", role: "assistant", content: "beta" },
      ],
      countTokens,
    });

    const result = await executeSlashCommandScript("/count", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("42");
    expect(countTokens).toHaveBeenCalledWith("alpha beta");
  });

  it("/count 在缺少 tokenizer 回调时走估算路径", async () => {
    const ctx = createContext({
      messages: [{ id: "m-0", role: "assistant", content: "abcdefgh" }],
    });

    const result = await executeSlashCommandScript("/count", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("2");
  });

  it("/count 在宿主返回非法 token 数时显式 fail-fast", async () => {
    const ctx = createContext({
      countTokens: vi.fn().mockResolvedValue(1.5),
    });

    const result = await executeSlashCommandScript("/count", ctx);

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("invalid token count");
  });

  it("/closechat 可关闭当前会话并返回空字符串", async () => {
    const closeCurrentChat = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ closeCurrentChat });

    const result = await executeSlashCommandScript("/closechat", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("");
    expect(closeCurrentChat).toHaveBeenCalledTimes(1);
  });

  it("/closechat 在宿主缺失时显式 fail-fast", async () => {
    const result = await executeSlashCommandScript("/closechat", createContext());

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("not available");
  });

  it("/member-count 与别名可返回群成员数量", async () => {
    const getGroupMemberCount = vi
      .fn()
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5);
    const ctx = createContext({ getGroupMemberCount });

    const canonical = await executeSlashCommandScript("/member-count", ctx);
    const aliasOne = await executeSlashCommandScript("/countmember", ctx);
    const aliasTwo = await executeSlashCommandScript("/membercount", ctx);

    expect(canonical.isError).toBe(false);
    expect(aliasOne.isError).toBe(false);
    expect(aliasTwo.isError).toBe(false);
    expect(canonical.pipe).toBe("3");
    expect(aliasOne.pipe).toBe("4");
    expect(aliasTwo.pipe).toBe("5");
    expect(getGroupMemberCount).toHaveBeenCalledTimes(3);
  });

  it("/countmember 在宿主缺失或返回非法类型时显式 fail-fast", async () => {
    const missing = await executeSlashCommandScript("/countmember", createContext());
    const invalid = await executeSlashCommandScript(
      "/countmember",
      createContext({
        getGroupMemberCount: vi.fn().mockResolvedValue(-1),
      }),
    );

    expect(missing.isError).toBe(true);
    expect(invalid.isError).toBe(true);
    expect(missing.errorMessage).toContain("not available");
    expect(invalid.errorMessage).toContain("invalid member count");
  });

  it("/cut 支持闭区间 range 并按倒序调用删除回调", async () => {
    const messages = [
      { id: "m-0", role: "user", content: "m0" },
      { id: "m-1", role: "assistant", content: "m1" },
      { id: "m-2", role: "assistant", content: "m2" },
      { id: "m-3", role: "assistant", content: "m3" },
    ] as ExecutionContext["messages"];
    const deleteMessage = vi.fn().mockImplementation(async (index: number) => {
      messages.splice(index, 1);
    });
    const ctx = createContext({ messages, deleteMessage });

    const result = await executeSlashCommandScript("/cut 1-2", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("m1\nm2");
    expect(deleteMessage).toHaveBeenNthCalledWith(1, 2);
    expect(deleteMessage).toHaveBeenNthCalledWith(2, 1);
  });

  it("/cut 支持多个 index/range 组合并自动去重", async () => {
    const messages = [
      { id: "m-0", role: "user", content: "a" },
      { id: "m-1", role: "assistant", content: "b" },
      { id: "m-2", role: "assistant", content: "c" },
      { id: "m-3", role: "assistant", content: "d" },
    ] as ExecutionContext["messages"];
    const deleteMessage = vi.fn().mockImplementation(async (index: number) => {
      messages.splice(index, 1);
    });
    const ctx = createContext({ messages, deleteMessage });

    const result = await executeSlashCommandScript("/cut 3 1-2 2", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("b\nc\nd");
    expect(deleteMessage).toHaveBeenNthCalledWith(1, 3);
    expect(deleteMessage).toHaveBeenNthCalledWith(2, 2);
    expect(deleteMessage).toHaveBeenNthCalledWith(3, 1);
  });

  it("/cut 对缺参、越界和非法 range 显式 fail-fast", async () => {
    const baseCtx = createContext({
      messages: [{ id: "m-0", role: "assistant", content: "x" }],
      deleteMessage: vi.fn().mockResolvedValue(undefined),
    });

    const missing = await executeSlashCommandScript("/cut", baseCtx);
    const outOfRange = await executeSlashCommandScript("/cut 3", baseCtx);
    const invalidRange = await executeSlashCommandScript("/cut 2-1", baseCtx);

    expect(missing.isError).toBe(true);
    expect(outOfRange.isError).toBe(true);
    expect(invalidRange.isError).toBe(true);
    expect(missing.errorMessage).toContain("requires at least one message index or range");
    expect(outOfRange.errorMessage).toContain("out of range");
    expect(invalidRange.errorMessage).toContain("invalid range");
  });

  it("/input 作为 /setinput 别名可写入输入框", async () => {
    const setInputText = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ setInputText });

    const result = await executeSlashCommandScript("/input hello-alias", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("hello-alias");
    expect(setInputText).toHaveBeenCalledWith("hello-alias");
  });
});
