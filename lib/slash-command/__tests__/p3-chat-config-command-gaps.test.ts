import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-config-1",
    messages: [
      { id: "m-0", role: "assistant", content: "opening" },
      { id: "m-1", role: "user", content: "hello" },
      { id: "m-2", role: "assistant", content: "world" },
      { id: "m-3", role: "user", content: "follow-up" },
      { id: "m-4", role: "assistant", content: "reply" },
    ],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

describe("P3 chat config command gaps", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("/reasoning-template 与别名共享单一路径存储", async () => {
    const ctx = createContext();

    const initial = await executeSlashCommandScript("/reasoning-template", ctx);
    const setTemplate = await executeSlashCommandScript("/reasoning-template Deep Think", ctx);
    const getViaPreset = await executeSlashCommandScript("/reasoning-preset", ctx);
    const setViaFormatting = await executeSlashCommandScript("/reasoning-formatting Compact", ctx);
    const getAgain = await executeSlashCommandScript("/reasoning-template", ctx);

    expect(initial).toMatchObject({ isError: false, pipe: "" });
    expect(setTemplate).toMatchObject({ isError: false, pipe: "Deep Think" });
    expect(getViaPreset).toMatchObject({ isError: false, pipe: "Deep Think" });
    expect(setViaFormatting).toMatchObject({ isError: false, pipe: "Compact" });
    expect(getAgain).toMatchObject({ isError: false, pipe: "Compact" });
    expect(window.localStorage.getItem("dreamministage.reasoning-template")).toBe("Compact");
  });

  it("/start-reply-with 与 /reroll-pick 共享显式存储语义", async () => {
    const firstCtx = createContext({ dialogueId: "dialogue-alpha" });
    const sameChatCtx = createContext({ dialogueId: "dialogue-alpha" });
    const otherChatCtx = createContext({ dialogueId: "dialogue-beta" });

    const initialReply = await executeSlashCommandScript("/start-reply-with", firstCtx);
    const setReply = await executeSlashCommandScript("/start-reply-with Sure!", firstCtx);
    const forceEmpty = await executeSlashCommandScript("/start-reply-with force=true", firstCtx);
    const readEmpty = await executeSlashCommandScript("/start-reply-with", firstCtx);
    const firstSeed = await executeSlashCommandScript("/reroll-pick", firstCtx);
    const secondSeed = await executeSlashCommandScript("/reroll-pick", sameChatCtx);
    const forcedSeed = await executeSlashCommandScript("/reroll-pick 5", firstCtx);
    const otherSeed = await executeSlashCommandScript("/reroll-pick", otherChatCtx);
    const invalidForce = await executeSlashCommandScript("/start-reply-with force=maybe hi", firstCtx);

    expect(initialReply).toMatchObject({ isError: false, pipe: "" });
    expect(setReply).toMatchObject({ isError: false, pipe: "Sure!" });
    expect(forceEmpty).toMatchObject({ isError: false, pipe: "" });
    expect(readEmpty).toMatchObject({ isError: false, pipe: "" });
    expect(firstSeed).toMatchObject({ isError: false, pipe: "1" });
    expect(secondSeed).toMatchObject({ isError: false, pipe: "2" });
    expect(forcedSeed).toMatchObject({ isError: false, pipe: "5" });
    expect(otherSeed).toMatchObject({ isError: false, pipe: "1" });
    expect(invalidForce.isError).toBe(true);
    expect(invalidForce.errorMessage).toContain("invalid force value");
    expect(window.localStorage.getItem("dreamministage.start-reply-with")).toBe("");
    expect(window.localStorage.getItem("dreamministage.pick-reroll-seed:dialogue-alpha")).toBe("5");
    expect(window.localStorage.getItem("dreamministage.pick-reroll-seed:dialogue-beta")).toBe("1");
  });

  it("/renamechat 调用宿主回调并返回新名称", async () => {
    const renameCurrentChat = vi.fn().mockResolvedValue("Session Renamed");
    const ctx = createContext({ renameCurrentChat });

    const result = await executeSlashCommandScript("/renamechat Session Renamed", ctx);

    expect(result).toMatchObject({ isError: false, pipe: "Session Renamed" });
    expect(renameCurrentChat).toHaveBeenCalledWith("Session Renamed");
  });

  it("/rename-char 透传 silent/chats 选项并校验输入", async () => {
    const renameCurrentCharacter = vi.fn().mockResolvedValue("Alice Prime");
    const ctx = createContext({ renameCurrentCharacter });

    const result = await executeSlashCommandScript(
      "/rename-char silent=false chats=true Alice Prime",
      ctx,
    );
    const invalid = await executeSlashCommandScript("/rename-char silent=maybe Alice", ctx);

    expect(result).toMatchObject({ isError: false, pipe: "Alice Prime" });
    expect(renameCurrentCharacter).toHaveBeenCalledWith("Alice Prime", {
      silent: false,
      chats: true,
    });
    expect(invalid.isError).toBe(true);
    expect(invalid.errorMessage).toContain("invalid silent value");
  });

  it("/forcesave 调用宿主保存回调", async () => {
    const forceSaveChat = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ forceSaveChat });

    const result = await executeSlashCommandScript("/forcesave", ctx);

    expect(result).toMatchObject({ isError: false, pipe: "" });
    expect(forceSaveChat).toHaveBeenCalledTimes(1);
  });

  it("/hide 默认隐藏最后一条用户消息及后续消息，也支持 at 定位", async () => {
    const hideMessages = vi.fn().mockResolvedValue(undefined);
    const unhideMessages = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ hideMessages, unhideMessages });

    const hideDefault = await executeSlashCommandScript("/hide", ctx);
    const hideAt = await executeSlashCommandScript("/hide at=1", ctx);
    const unhide = await executeSlashCommandScript("/unhide", ctx);

    expect(hideDefault).toMatchObject({ isError: false, pipe: "" });
    expect(hideAt).toMatchObject({ isError: false, pipe: "" });
    expect(unhide).toMatchObject({ isError: false, pipe: "" });
    expect(hideMessages).toHaveBeenNthCalledWith(1, 3);
    expect(hideMessages).toHaveBeenNthCalledWith(2, 1);
    expect(unhideMessages).toHaveBeenCalledTimes(1);
  });

  it("rename/save/hide 命令在宿主缺失或越界时显式 fail-fast", async () => {
    const missingRenameChat = await executeSlashCommandScript("/renamechat Alpha", createContext());
    const missingRenameCharacter = await executeSlashCommandScript("/rename-char Beta", createContext());
    const missingForceSave = await executeSlashCommandScript("/forcesave", createContext());
    const missingHide = await executeSlashCommandScript("/hide", createContext());
    const hideOutOfRange = await executeSlashCommandScript(
      "/hide at=99",
      createContext({ hideMessages: vi.fn().mockResolvedValue(undefined) }),
    );

    expect(missingRenameChat.isError).toBe(true);
    expect(missingRenameCharacter.isError).toBe(true);
    expect(missingForceSave.isError).toBe(true);
    expect(missingHide.isError).toBe(true);
    expect(hideOutOfRange.isError).toBe(true);
    expect(missingRenameChat.errorMessage).toContain("not available");
    expect(missingRenameCharacter.errorMessage).toContain("not available");
    expect(missingForceSave.errorMessage).toContain("not available");
    expect(missingHide.errorMessage).toContain("not available");
    expect(hideOutOfRange.errorMessage).toContain("out of range");
  });
});
