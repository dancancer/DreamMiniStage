import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-chat-1",
    messages: [],
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

  it("聊天管理命令在宿主不支持时显式 fail-fast", async () => {
    const ctx = createContext();

    const managerResult = await executeSlashCommandScript("/chat-manager", ctx);
    const reloadResult = await executeSlashCommandScript("/chat-reload", ctx);

    expect(managerResult.isError).toBe(true);
    expect(reloadResult.isError).toBe(true);
    expect(managerResult.errorMessage).toContain("not available");
    expect(reloadResult.errorMessage).toContain("not available");
  });
});
