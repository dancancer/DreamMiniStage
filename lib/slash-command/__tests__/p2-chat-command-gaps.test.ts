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

  it("/getchatname 返回当前聊天名称字符串", async () => {
    const getCurrentChatName = vi.fn().mockResolvedValue("Session Alpha");
    const ctx = createContext({ getCurrentChatName });

    const result = await executeSlashCommandScript("/getchatname", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("Session Alpha");
    expect(getCurrentChatName).toHaveBeenCalledTimes(1);
  });

  it("/setinput 支持参数、namedArgs 与 pipe 三种写入来源", async () => {
    const setInputText = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ setInputText });

    const fromArgs = await executeSlashCommandScript("/setinput hello world", ctx);
    const fromNamed = await executeSlashCommandScript("/setinput text=named-value", ctx);
    const fromPipe = await executeSlashCommandScript("/echo piped|/setinput", ctx);
    const clearInput = await executeSlashCommandScript("/setinput", ctx);

    expect(fromArgs.isError).toBe(false);
    expect(fromNamed.isError).toBe(false);
    expect(fromPipe.isError).toBe(false);
    expect(clearInput.isError).toBe(false);
    expect(fromArgs.pipe).toBe("hello world");
    expect(fromNamed.pipe).toBe("named-value");
    expect(fromPipe.pipe).toBe("piped");
    expect(clearInput.pipe).toBe("");
    expect(setInputText).toHaveBeenNthCalledWith(1, "hello world");
    expect(setInputText).toHaveBeenNthCalledWith(2, "named-value");
    expect(setInputText).toHaveBeenNthCalledWith(3, "piped");
    expect(setInputText).toHaveBeenNthCalledWith(4, "");
  });

  it("/set-reasoning 与 /get-reasoning 支持默认末条消息与显式索引", async () => {
    const ctx = createContext({
      messages: [
        { id: "m-0", role: "assistant", content: "one", thinkingContent: "old-0" },
        { id: "m-1", role: "assistant", content: "two", thinkingContent: "old-1" },
      ],
    });

    const setLatest = await executeSlashCommandScript("/set-reasoning latest-think", ctx);
    const getLatest = await executeSlashCommandScript("/get-reasoning", ctx);
    const setTarget = await executeSlashCommandScript("/set-reasoning at=0 first-think", ctx);
    const getTarget = await executeSlashCommandScript("/get-reasoning 0", ctx);

    expect(setLatest.isError).toBe(false);
    expect(getLatest.isError).toBe(false);
    expect(setTarget.isError).toBe(false);
    expect(getTarget.isError).toBe(false);
    expect(setLatest.pipe).toBe("latest-think");
    expect(getLatest.pipe).toBe("latest-think");
    expect(setTarget.pipe).toBe("first-think");
    expect(getTarget.pipe).toBe("first-think");
  });

  it("/set-reasoning 支持宿主覆写回调与 collapse 参数", async () => {
    const setMessageReasoning = vi.fn().mockResolvedValue(undefined);
    const getMessageReasoning = vi.fn().mockResolvedValue("from-host");
    const ctx = createContext({
      setMessageReasoning,
      getMessageReasoning,
    });

    const setResult = await executeSlashCommandScript("/set-reasoning at=1 collapse=true host-think", ctx);
    const getResult = await executeSlashCommandScript("/get-reasoning 1", ctx);

    expect(setResult.isError).toBe(false);
    expect(getResult.isError).toBe(false);
    expect(setResult.pipe).toBe("host-think");
    expect(getResult.pipe).toBe("from-host");
    expect(setMessageReasoning).toHaveBeenCalledWith(1, "host-think", { collapse: true });
    expect(getMessageReasoning).toHaveBeenCalledWith(1);
  });

  it("/get-reasoning 与 /set-reasoning 对非法索引显式 fail-fast", async () => {
    const ctx = createContext({
      messages: [{ id: "m-0", role: "assistant", content: "only-one" }],
    });

    const setInvalid = await executeSlashCommandScript("/set-reasoning at=nope hi", ctx);
    const getInvalid = await executeSlashCommandScript("/get-reasoning nope", ctx);
    const getOutOfRange = await executeSlashCommandScript("/get-reasoning 9", ctx);

    expect(setInvalid.isError).toBe(true);
    expect(getInvalid.isError).toBe(true);
    expect(getOutOfRange.isError).toBe(true);
    expect(setInvalid.errorMessage).toContain("invalid message index");
    expect(getInvalid.errorMessage).toContain("invalid message index");
    expect(getOutOfRange.errorMessage).toContain("out of range");
  });

  it("/listinjects 返回当前会话注入记录 JSON", async () => {
    const listPromptInjections = vi.fn().mockResolvedValue([
      {
        id: "inject-1",
        content: "alpha",
        role: "system",
        position: "in_chat",
        depth: 0,
        should_scan: false,
        createdAt: "2026-03-05T00:00:00.000Z",
      },
    ]);
    const ctx = createContext({ listPromptInjections });

    const result = await executeSlashCommandScript("/listinjects", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("[{\"id\":\"inject-1\",\"content\":\"alpha\",\"role\":\"system\",\"position\":\"in_chat\",\"depth\":0,\"should_scan\":false,\"createdAt\":\"2026-03-05T00:00:00.000Z\"}]");
    expect(listPromptInjections).toHaveBeenCalledTimes(1);
  });

  it("/delchat 可触发当前聊天删除回调并返回空字符串", async () => {
    const deleteCurrentChat = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ deleteCurrentChat });

    const result = await executeSlashCommandScript("/delchat", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("");
    expect(deleteCurrentChat).toHaveBeenCalledTimes(1);
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

  it("/delmode 与 /delete 可删除最后 N 条消息并返回删除文本", async () => {
    const delModeDelete = vi.fn().mockResolvedValue(undefined);
    const delModeCtx = createContext({ deleteMessage: delModeDelete });
    const delModeResult = await executeSlashCommandScript("/delmode", delModeCtx);

    const deleteAlias = vi.fn().mockResolvedValue(undefined);
    const deleteAliasCtx = createContext({ deleteMessage: deleteAlias });
    const deleteAliasResult = await executeSlashCommandScript("/delete 2", deleteAliasCtx);

    expect(delModeResult.isError).toBe(false);
    expect(deleteAliasResult.isError).toBe(false);
    expect(delModeResult.pipe).toBe("tail");
    expect(deleteAliasResult.pipe).toBe("tail\nworld");
    expect(delModeDelete).toHaveBeenCalledWith(2);
    expect(deleteAlias).toHaveBeenNthCalledWith(1, 2);
    expect(deleteAlias).toHaveBeenNthCalledWith(2, 1);
  });

  it("/delmode 对非法数量显式 fail-fast", async () => {
    const deleteMessage = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ deleteMessage });

    const badCount = await executeSlashCommandScript("/delmode nope", ctx);
    const outOfRange = await executeSlashCommandScript("/delete 99", ctx);

    expect(badCount.isError).toBe(true);
    expect(outOfRange.isError).toBe(true);
    expect(badCount.errorMessage).toContain("invalid delete count");
    expect(outOfRange.errorMessage).toContain("out of range");
  });

  it("/delname 支持按 name 批量删除消息", async () => {
    const deleteMessage = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({
      messages: [
        { id: "m-0", role: "assistant", content: "one", name: "Alice" },
        { id: "m-1", role: "assistant", content: "two", name: "Bob" },
        { id: "m-2", role: "assistant", content: "three", name: "alice" },
      ],
      deleteMessage,
    });

    const result = await executeSlashCommandScript("/delname Alice", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("2");
    expect(deleteMessage).toHaveBeenNthCalledWith(1, 2);
    expect(deleteMessage).toHaveBeenNthCalledWith(2, 0);
  });

  it("/delswipe 与别名支持删除当前或指定 swipe", async () => {
    const deleteSwipe = vi
      .fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(undefined);
    const ctx = createContext({ deleteSwipe });

    const current = await executeSlashCommandScript("/delswipe", ctx);
    const specific = await executeSlashCommandScript("/swipedel 3", ctx);

    expect(current.isError).toBe(false);
    expect(specific.isError).toBe(false);
    expect(current.pipe).toBe("2");
    expect(specific.pipe).toBe("");
    expect(deleteSwipe).toHaveBeenNthCalledWith(1, undefined);
    expect(deleteSwipe).toHaveBeenNthCalledWith(2, 3);
  });

  it("/delswipe 对非法索引显式 fail-fast", async () => {
    const deleteSwipe = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ deleteSwipe });

    const result = await executeSlashCommandScript("/delswipe nope", ctx);

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("invalid swipe id");
  });

  it("聊天管理命令在宿主不支持时显式 fail-fast", async () => {
    const ctx = createContext();

    const managerResult = await executeSlashCommandScript("/chat-manager", ctx);
    const reloadResult = await executeSlashCommandScript("/chat-reload", ctx);
    const getChatNameResult = await executeSlashCommandScript("/getchatname", ctx);
    const setInputResult = await executeSlashCommandScript("/setinput test", ctx);
    const jumpResult = await executeSlashCommandScript("/chat-jump 1", ctx);
    const renderResult = await executeSlashCommandScript("/chat-render 1", ctx);
    const listInjectsResult = await executeSlashCommandScript("/listinjects", ctx);
    const delChatResult = await executeSlashCommandScript("/delchat", ctx);
    const delModeResult = await executeSlashCommandScript("/delmode", ctx);
    const delNameResult = await executeSlashCommandScript("/delname Alice", ctx);
    const delSwipeResult = await executeSlashCommandScript("/delswipe", ctx);

    expect(managerResult.isError).toBe(true);
    expect(reloadResult.isError).toBe(true);
    expect(getChatNameResult.isError).toBe(true);
    expect(setInputResult.isError).toBe(true);
    expect(jumpResult.isError).toBe(true);
    expect(renderResult.isError).toBe(true);
    expect(listInjectsResult.isError).toBe(true);
    expect(delChatResult.isError).toBe(true);
    expect(delModeResult.isError).toBe(true);
    expect(delNameResult.isError).toBe(true);
    expect(delSwipeResult.isError).toBe(true);
    expect(managerResult.errorMessage).toContain("not available");
    expect(reloadResult.errorMessage).toContain("not available");
    expect(getChatNameResult.errorMessage).toContain("not available");
    expect(setInputResult.errorMessage).toContain("not available");
    expect(jumpResult.errorMessage).toContain("not available");
    expect(renderResult.errorMessage).toContain("not available");
    expect(listInjectsResult.errorMessage).toContain("not available");
    expect(delChatResult.errorMessage).toContain("not available");
    expect(delModeResult.errorMessage).toContain("not available");
    expect(delNameResult.errorMessage).toContain("not available");
    expect(delSwipeResult.errorMessage).toContain("not available");
  });
});
