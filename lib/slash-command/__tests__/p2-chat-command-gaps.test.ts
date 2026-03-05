import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-chat-1",
    messages: [
      { id: "m-0", role: "user", content: "hello" },
      { id: "m-1", role: "assistant", content: "world" },
      { id: "m-2", role: "assistant", content: "tail" },
    ],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

describe("P2 chat command gaps", () => {
  it("/chat-manager 与别名可打开聊天管理器并返回空字符串", async () => {
    const openChatManager = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ openChatManager });

    const main = await executeSlashCommandScript("/chat-manager", ctx);
    const aliasOne = await executeSlashCommandScript("/manage-chats", ctx);
    const aliasTwo = await executeSlashCommandScript("/chat-history", ctx);

    expect(main.isError).toBe(false);
    expect(aliasOne.isError).toBe(false);
    expect(aliasTwo.isError).toBe(false);
    expect(main.pipe).toBe("");
    expect(aliasOne.pipe).toBe("");
    expect(aliasTwo.pipe).toBe("");
    expect(openChatManager).toHaveBeenCalledTimes(3);
  });

  it("/chat-reload 可触发重载回调并返回空字符串", async () => {
    const reloadCurrentChat = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ reloadCurrentChat });

    const result = await executeSlashCommandScript("/chat-reload", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("");
    expect(reloadCurrentChat).toHaveBeenCalledTimes(1);
  });

  it("/chat-jump 与 /chat-scrollto 可跳转消息索引并返回空字符串", async () => {
    const jumpToMessage = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ jumpToMessage });

    const jump = await executeSlashCommandScript("/chat-jump 1", ctx);
    const scroll = await executeSlashCommandScript("/chat-scrollto 2", ctx);

    expect(jump.isError).toBe(false);
    expect(scroll.isError).toBe(false);
    expect(jump.pipe).toBe("");
    expect(scroll.pipe).toBe("");
    expect(jumpToMessage).toHaveBeenNthCalledWith(1, 1);
    expect(jumpToMessage).toHaveBeenNthCalledWith(2, 2);
  });

  it("/chat-jump 对非法索引显式 fail-fast", async () => {
    const jumpToMessage = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ jumpToMessage });

    const badType = await executeSlashCommandScript("/chat-jump nope", ctx);
    const outOfRange = await executeSlashCommandScript("/chat-jump 5", ctx);

    expect(badType.isError).toBe(true);
    expect(outOfRange.isError).toBe(true);
    expect(badType.errorMessage).toContain("invalid message index");
    expect(outOfRange.errorMessage).toContain("out of range");
  });

  it("/chat-render 支持计数与滚动参数", async () => {
    const renderChatMessages = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ renderChatMessages });

    const withCount = await executeSlashCommandScript("/chat-render scroll=true 2", ctx);
    const noCount = await executeSlashCommandScript("/chat-render", ctx);

    expect(withCount.isError).toBe(false);
    expect(noCount.isError).toBe(false);
    expect(withCount.pipe).toBe("");
    expect(noCount.pipe).toBe("");
    expect(renderChatMessages).toHaveBeenNthCalledWith(1, 2, { scroll: true });
    expect(renderChatMessages).toHaveBeenNthCalledWith(2, Number.MAX_SAFE_INTEGER, { scroll: false });
  });

  it("/chat-render 对非法计数显式 fail-fast", async () => {
    const renderChatMessages = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ renderChatMessages });

    const result = await executeSlashCommandScript("/chat-render nope", ctx);

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("invalid message count");
  });

  it("聊天管理命令在宿主不支持时显式 fail-fast", async () => {
    const ctx = createContext();

    const managerResult = await executeSlashCommandScript("/chat-manager", ctx);
    const reloadResult = await executeSlashCommandScript("/chat-reload", ctx);
    const jumpResult = await executeSlashCommandScript("/chat-jump 1", ctx);
    const renderResult = await executeSlashCommandScript("/chat-render 1", ctx);

    expect(managerResult.isError).toBe(true);
    expect(reloadResult.isError).toBe(true);
    expect(jumpResult.isError).toBe(true);
    expect(renderResult.isError).toBe(true);
    expect(managerResult.errorMessage).toContain("not available");
    expect(reloadResult.errorMessage).toContain("not available");
    expect(jumpResult.errorMessage).toContain("not available");
    expect(renderResult.errorMessage).toContain("not available");
  });
});
