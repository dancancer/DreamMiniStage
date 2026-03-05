import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

let contextSeed = 0;

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  contextSeed += 1;

  return {
    characterId: `char-db-${contextSeed}`,
    messages: [
      { id: `m-${contextSeed}-0`, role: "user", content: "hello" },
      { id: `m-${contextSeed}-1`, role: "assistant", content: "world" },
    ],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

describe("P3 data-bank command gaps", () => {
  it("/data-bank 可触发宿主打开回调并返回空字符串", async () => {
    const openDataBank = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ openDataBank });

    const main = await executeSlashCommandScript("/data-bank", ctx);
    const alias = await executeSlashCommandScript("/db", ctx);

    expect(main.isError).toBe(false);
    expect(alias.isError).toBe(false);
    expect(main.pipe).toBe("");
    expect(alias.pipe).toBe("");
    expect(openDataBank).toHaveBeenCalledTimes(2);
  });

  it("/data-bank-list 支持 source/field 并返回 JSON 数组", async () => {
    const listDataBankEntries = vi.fn().mockResolvedValue([
      { name: "Alpha", url: "https://db/a", source: "chat" },
      { name: "Beta", url: "https://db/b", source: "chat" },
    ]);
    const ctx = createContext({ listDataBankEntries });

    const withName = await executeSlashCommandScript("/data-bank-list source=chat field=name", ctx);
    const withUrl = await executeSlashCommandScript("/db-list source=chat", ctx);

    expect(withName.isError).toBe(false);
    expect(withUrl.isError).toBe(false);
    expect(withName.pipe).toBe("[\"Alpha\",\"Beta\"]");
    expect(withUrl.pipe).toBe("[\"https://db/a\",\"https://db/b\"]");
    expect(listDataBankEntries).toHaveBeenNthCalledWith(1, { source: "chat" });
    expect(listDataBankEntries).toHaveBeenNthCalledWith(2, { source: "chat" });
  });

  it("/data-bank-get 与 /data-bank-add 支持基本读写闭环", async () => {
    const getDataBankText = vi.fn().mockResolvedValue("stored-content");
    const addDataBankText = vi
      .fn()
      .mockResolvedValueOnce("https://db/new-1")
      .mockResolvedValueOnce("https://db/new-2")
      .mockResolvedValueOnce("https://db/new-3");
    const ctx = createContext({ getDataBankText, addDataBankText });

    const getResult = await executeSlashCommandScript("/data-bank-get source=chat Alpha", ctx);
    const addFromArgs = await executeSlashCommandScript("/data-bank-add source=chat name=Alpha hello world", ctx);
    const addFromNamed = await executeSlashCommandScript("/db-add source=global name=Beta text=named-content", ctx);
    const addFromPipe = await executeSlashCommandScript("/echo piped-content|/data-bank-add", ctx);

    expect(getResult).toMatchObject({ isError: false, pipe: "stored-content" });
    expect(addFromArgs).toMatchObject({ isError: false, pipe: "https://db/new-1" });
    expect(addFromNamed).toMatchObject({ isError: false, pipe: "https://db/new-2" });
    expect(addFromPipe).toMatchObject({ isError: false, pipe: "https://db/new-3" });

    expect(getDataBankText).toHaveBeenCalledWith("Alpha", { source: "chat" });
    expect(addDataBankText).toHaveBeenNthCalledWith(1, "hello world", {
      source: "chat",
      name: "Alpha",
    });
    expect(addDataBankText).toHaveBeenNthCalledWith(2, "named-content", {
      source: "global",
      name: "Beta",
    });
    expect(addDataBankText).toHaveBeenNthCalledWith(3, "piped-content", {
      source: "chat",
      name: undefined,
    });
  });

  it("/data-bank-update 支持 named target 与位置参数 target 两种路径", async () => {
    const updateDataBankText = vi
      .fn()
      .mockResolvedValueOnce("https://db/updated-1")
      .mockResolvedValueOnce(undefined);
    const ctx = createContext({ updateDataBankText });

    const namedTarget = await executeSlashCommandScript("/data-bank-update source=chat name=Alpha updated body", ctx);
    const positionalTarget = await executeSlashCommandScript("/db-update source=chat https://db/a piped", ctx);

    expect(namedTarget).toMatchObject({ isError: false, pipe: "https://db/updated-1" });
    expect(positionalTarget).toMatchObject({ isError: false, pipe: "" });
    expect(updateDataBankText).toHaveBeenNthCalledWith(1, "Alpha", "updated body", {
      source: "chat",
    });
    expect(updateDataBankText).toHaveBeenNthCalledWith(2, "https://db/a", "piped", {
      source: "chat",
    });
  });

  it("/data-bank-delete 与 enable/disable 可透传宿主状态变更", async () => {
    const deleteDataBankEntry = vi.fn().mockResolvedValue(undefined);
    const setDataBankEntryEnabled = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ deleteDataBankEntry, setDataBankEntryEnabled });

    const disableResult = await executeSlashCommandScript("/data-bank-disable source=chat Alpha", ctx);
    const enableResult = await executeSlashCommandScript("/db-enable source=chat Alpha", ctx);
    const deleteResult = await executeSlashCommandScript("/data-bank-delete source=chat Alpha", ctx);

    expect(disableResult.isError).toBe(false);
    expect(enableResult.isError).toBe(false);
    expect(deleteResult.isError).toBe(false);
    expect(setDataBankEntryEnabled).toHaveBeenNthCalledWith(1, "Alpha", false, { source: "chat" });
    expect(setDataBankEntryEnabled).toHaveBeenNthCalledWith(2, "Alpha", true, { source: "chat" });
    expect(deleteDataBankEntry).toHaveBeenCalledWith("Alpha", { source: "chat" });
  });

  it("/data-bank-ingest /data-bank-purge /data-bank-search 支持宿主检索回调", async () => {
    const ingestDataBank = vi.fn().mockResolvedValue(undefined);
    const purgeDataBank = vi.fn().mockResolvedValue(undefined);
    const searchDataBank = vi
      .fn()
      .mockResolvedValueOnce(["https://db/a", "https://db/b"])
      .mockResolvedValueOnce("chunk-a\n\nchunk-b");
    const ctx = createContext({ ingestDataBank, purgeDataBank, searchDataBank });

    const ingestResult = await executeSlashCommandScript("/data-bank-ingest source=chat", ctx);
    const purgeResult = await executeSlashCommandScript("/db-purge source=chat", ctx);
    const searchUrls = await executeSlashCommandScript("/data-bank-search source=chat threshold=0.3 count=2 what is alpha", ctx);
    const searchChunks = await executeSlashCommandScript("/db-search return=chunks what is beta", ctx);

    expect(ingestResult).toMatchObject({ isError: false, pipe: "" });
    expect(purgeResult).toMatchObject({ isError: false, pipe: "" });
    expect(searchUrls).toMatchObject({ isError: false, pipe: "[\"https://db/a\",\"https://db/b\"]" });
    expect(searchChunks).toMatchObject({ isError: false, pipe: "chunk-a\n\nchunk-b" });

    expect(ingestDataBank).toHaveBeenCalledWith({ source: "chat" });
    expect(purgeDataBank).toHaveBeenCalledWith({ source: "chat" });
    expect(searchDataBank).toHaveBeenNthCalledWith(1, "what is alpha", {
      source: "chat",
      threshold: 0.3,
      count: 2,
      returnType: "urls",
    });
    expect(searchDataBank).toHaveBeenNthCalledWith(2, "what is beta", {
      source: undefined,
      threshold: undefined,
      count: undefined,
      returnType: "chunks",
    });
  });

  it("/data-bank-* 在宿主缺失或参数非法时显式 fail-fast", async () => {
    const noHost = createContext();
    const openNoHost = await executeSlashCommandScript("/data-bank", noHost);
    const listNoHost = await executeSlashCommandScript("/data-bank-list", noHost);

    const withHost = createContext({
      openDataBank: vi.fn().mockResolvedValue(undefined),
      listDataBankEntries: vi.fn().mockResolvedValue([]),
      addDataBankText: vi.fn().mockResolvedValue("https://db/new"),
      searchDataBank: vi.fn().mockResolvedValue(["https://db/a"]),
    });

    const badSource = await executeSlashCommandScript("/data-bank-list source=team", withHost);
    const badField = await executeSlashCommandScript("/data-bank-list field=title", withHost);
    const emptyAdd = await executeSlashCommandScript("/data-bank-add", withHost);
    const badThreshold = await executeSlashCommandScript("/data-bank-search threshold=3 hello", withHost);
    const badCount = await executeSlashCommandScript("/data-bank-search count=0 hello", withHost);
    const badReturn = await executeSlashCommandScript("/data-bank-search return=dict hello", withHost);

    expect(openNoHost.isError).toBe(true);
    expect(listNoHost.isError).toBe(true);
    expect(openNoHost.errorMessage).toContain("not available");
    expect(listNoHost.errorMessage).toContain("not available");

    expect(badSource.isError).toBe(true);
    expect(badField.isError).toBe(true);
    expect(emptyAdd.isError).toBe(true);
    expect(badThreshold.isError).toBe(true);
    expect(badCount.isError).toBe(true);
    expect(badReturn.isError).toBe(true);

    expect(badSource.errorMessage).toContain("invalid source");
    expect(badField.errorMessage).toContain("invalid field");
    expect(emptyAdd.errorMessage).toContain("requires content");
    expect(badThreshold.errorMessage).toContain("invalid threshold");
    expect(badCount.errorMessage).toContain("invalid count");
    expect(badReturn.errorMessage).toContain("invalid return");
  });

  it("/data-bank-* 对宿主返回类型异常显式 fail-fast", async () => {
    const listDataBankEntries = vi.fn().mockResolvedValue("not-array" as unknown as []);
    const getDataBankText = vi.fn().mockResolvedValue(123 as unknown as string);
    const addDataBankText = vi.fn().mockResolvedValue(99 as unknown as string);
    const searchDataBank = vi
      .fn()
      .mockResolvedValueOnce("chunks-as-string" as unknown as string[])
      .mockResolvedValueOnce([1, 2] as unknown as string[]);

    const ctx = createContext({
      listDataBankEntries,
      getDataBankText,
      addDataBankText,
      searchDataBank,
    });

    const badList = await executeSlashCommandScript("/data-bank-list", ctx);
    const badGet = await executeSlashCommandScript("/data-bank-get target", ctx);
    const badAdd = await executeSlashCommandScript("/data-bank-add hello", ctx);
    const badUrls = await executeSlashCommandScript("/data-bank-search hello", ctx);
    const badChunks = await executeSlashCommandScript("/data-bank-search return=chunks hello", ctx);

    expect(badList.isError).toBe(true);
    expect(badGet.isError).toBe(true);
    expect(badAdd.isError).toBe(true);
    expect(badUrls.isError).toBe(true);
    expect(badChunks.isError).toBe(true);

    expect(badList.errorMessage).toContain("non-array");
    expect(badGet.errorMessage).toContain("non-string");
    expect(badAdd.errorMessage).toContain("non-string");
    expect(badUrls.errorMessage).toContain("non-array");
    expect(badChunks.errorMessage).toContain("non-string");
  });
});
