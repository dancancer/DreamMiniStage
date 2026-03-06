import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-lore-1",
    messages: [
      { id: "m-0", role: "user", content: "hello" },
      { id: "m-1", role: "assistant", content: "world" },
    ],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

describe("P2 world/lore command gaps", () => {
  it("/world 支持读取与 state=on|off|toggle 更新", async () => {
    let selected = ["global-a"];
    const getGlobalLorebooks = vi.fn(async () => selected.slice());
    const setGlobalLorebooks = vi.fn(async (next: string[]) => {
      selected = next.slice();
    });
    const ctx = createContext({ getGlobalLorebooks, setGlobalLorebooks });

    const listed = await executeSlashCommandScript("/world", ctx);
    const toggled = await executeSlashCommandScript("/world global-b", ctx);
    const removed = await executeSlashCommandScript("/world state=off global-a", ctx);

    expect(listed.isError).toBe(false);
    expect(toggled.isError).toBe(false);
    expect(removed.isError).toBe(false);
    expect(JSON.parse(listed.pipe)).toEqual(["global-a"]);
    expect(JSON.parse(toggled.pipe)).toEqual(["global-a", "global-b"]);
    expect(JSON.parse(removed.pipe)).toEqual(["global-b"]);
    expect(setGlobalLorebooks).toHaveBeenCalledTimes(2);
  });

  it("/getcharlore 与 /getcharbook 支持 primary/additional/all 三种读取模式", async () => {
    const getCharLorebooks = vi.fn().mockResolvedValue({
      primary: "char-main",
      additional: ["char-extra-a", "char-extra-b"],
    });
    const ctx = createContext({ getCharLorebooks });

    const primary = await executeSlashCommandScript("/getcharlore", ctx);
    const additional = await executeSlashCommandScript("/getcharbook type=additional", ctx);
    const all = await executeSlashCommandScript("/getcharwi type=all", ctx);

    expect(primary.isError).toBe(false);
    expect(additional.isError).toBe(false);
    expect(all.isError).toBe(false);
    expect(primary.pipe).toBe("char-main");
    expect(JSON.parse(additional.pipe)).toEqual(["char-extra-a", "char-extra-b"]);
    expect(JSON.parse(all.pipe)).toEqual(["char-main", "char-extra-a", "char-extra-b"]);
  });

  it("/getchatbook /getglobalbooks /getpersonabook 复用 lore 数据路径", async () => {
    const ctx = createContext({
      getChatLorebook: vi.fn().mockResolvedValue("chat-book"),
      getGlobalLorebooks: vi.fn().mockResolvedValue(["global-a", "global-b"]),
      getPersonaLorebook: vi.fn().mockResolvedValue("persona-book"),
    });

    const chat = await executeSlashCommandScript("/getchatbook", ctx);
    const global = await executeSlashCommandScript("/getglobalbooks", ctx);
    const persona = await executeSlashCommandScript("/getpersonabook", ctx);

    expect(chat.isError).toBe(false);
    expect(global.isError).toBe(false);
    expect(persona.isError).toBe(false);
    expect(chat.pipe).toBe("chat-book");
    expect(JSON.parse(global.pipe)).toEqual(["global-a", "global-b"]);
    expect(persona.pipe).toBe("persona-book");
  });

  it("/getlorefield 与 entry/wi 别名共享字段读写路径", async () => {
    const getLoreField = vi.fn(async (_file: string, _uid: string, field: string) => {
      if (field === "keys") {
        return ["alpha", "beta"];
      }
      return "lore-content";
    });
    const setLoreField = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ getLoreField, setLoreField });

    const readContent = await executeSlashCommandScript("/getlorefield file=book-1 uid-1", ctx);
    const readEntryAlias = await executeSlashCommandScript("/getentryfield file=book-1 uid-1", ctx);
    const readKeys = await executeSlashCommandScript("/getwifield file=book-1 field=key uid-1", ctx);
    const writeContent = await executeSlashCommandScript(
      "/setlorefield file=book-1 uid=uid-1 field=content updated-text",
      ctx,
    );
    const writeEntryAlias = await executeSlashCommandScript(
      "/setentryfield file=book-1 uid=uid-1 field=content updated-entry",
      ctx,
    );
    const writeKeys = await executeSlashCommandScript(
      "/setwifield file=book-1 uid=uid-1 field=key alpha,beta,gamma",
      ctx,
    );

    expect(readContent.isError).toBe(false);
    expect(readEntryAlias.isError).toBe(false);
    expect(readKeys.isError).toBe(false);
    expect(writeContent.isError).toBe(false);
    expect(writeEntryAlias.isError).toBe(false);
    expect(writeKeys.isError).toBe(false);
    expect(readContent.pipe).toBe("lore-content");
    expect(readEntryAlias.pipe).toBe("lore-content");
    expect(readKeys.pipe).toBe("alpha,beta");
    expect(setLoreField).toHaveBeenNthCalledWith(1, "book-1", "uid-1", "content", "updated-text");
    expect(setLoreField).toHaveBeenNthCalledWith(2, "book-1", "uid-1", "content", "updated-entry");
    expect(setLoreField).toHaveBeenNthCalledWith(3, "book-1", "uid-1", "keys", "alpha,beta,gamma");
  });

  it("/findentry|/findlore 支持按 file+field 模糊定位条目 uid", async () => {
    const listWorldBookEntries = vi.fn(async (bookName?: string) => {
      if (bookName !== "book-1") {
        return [];
      }
      return [
        {
          id: "11",
          keys: ["Shadowfang", "blade"],
          content: "The sword of the king",
          enabled: true,
        },
        {
          id: "22",
          keys: ["Moonshield"],
          content: "A silver shield",
          enabled: true,
        },
      ];
    });
    const ctx = createContext({ listWorldBookEntries });

    const byKey = await executeSlashCommandScript("/findlore file=book-1 shadow", ctx);
    const byContent = await executeSlashCommandScript("/findentry file=book-1 field=content silver", ctx);
    const notFound = await executeSlashCommandScript("/findwi file=book-1 field=content unknown", ctx);

    expect(byKey.isError).toBe(false);
    expect(byContent.isError).toBe(false);
    expect(notFound.isError).toBe(false);
    expect(byKey.pipe).toBe("11");
    expect(byContent.pipe).toBe("22");
    expect(notFound.pipe).toBe("");
  });

  it("/createlore 支持在指定 lorebook 创建条目并返回 uid", async () => {
    const createWorldBookEntry = vi.fn().mockResolvedValue({
      id: "77",
      keys: ["Shadowfang"],
      content: "The sword of the king",
      enabled: true,
    });
    const ctx = createContext({ createWorldBookEntry });

    const created = await executeSlashCommandScript(
      "/createlore file=book-1 key=Shadowfang The sword of the king",
      ctx,
    );
    const aliasCreated = await executeSlashCommandScript("/createwi file=book-1 key=Moonshield", ctx);

    expect(created.isError).toBe(false);
    expect(aliasCreated.isError).toBe(false);
    expect(created.pipe).toBe("77");
    expect(aliasCreated.pipe).toBe("77");
    expect(createWorldBookEntry).toHaveBeenNthCalledWith(1, {
      keys: ["Shadowfang"],
      comment: "Shadowfang",
      content: "The sword of the king",
      enabled: true,
    }, "book-1");
    expect(createWorldBookEntry).toHaveBeenNthCalledWith(2, {
      keys: ["Moonshield"],
      comment: "Moonshield",
      content: "",
      enabled: true,
    }, "book-1");
  });

  it("/vector-worldinfo-state 支持读取与布尔状态切换", async () => {
    let enabled = false;
    const getVectorWorldInfoState = vi.fn(() => enabled);
    const setVectorWorldInfoState = vi.fn((next: boolean) => {
      enabled = next;
      return enabled;
    });
    const ctx = createContext({
      getVectorWorldInfoState,
      setVectorWorldInfoState,
    });

    const initial = await executeSlashCommandScript("/vector-worldinfo-state", ctx);
    const toggled = await executeSlashCommandScript("/vector-worldinfo-state true", ctx);
    const invalid = await executeSlashCommandScript("/vector-worldinfo-state maybe", ctx);

    expect(initial.isError).toBe(false);
    expect(toggled.isError).toBe(false);
    expect(invalid.isError).toBe(true);
    expect(initial.pipe).toBe("false");
    expect(toggled.pipe).toBe("true");
    expect(setVectorWorldInfoState).toHaveBeenCalledWith(true);
    expect(invalid.errorMessage).toContain("invalid boolean");
  });

  it("vector 状态命令支持布尔与数值读写", async () => {
    let threshold = 0.25;
    let query = 2;
    let maxEntries = 5;
    let chatsEnabled = false;
    let filesEnabled = true;
    const ctx = createContext({
      getVectorScoreThreshold: vi.fn(() => threshold),
      setVectorScoreThreshold: vi.fn((next: number) => {
        threshold = next;
        return threshold;
      }),
      getVectorQueryMessages: vi.fn(() => query),
      setVectorQueryMessages: vi.fn((next: number) => {
        query = next;
        return query;
      }),
      getVectorMaxEntries: vi.fn(() => maxEntries),
      setVectorMaxEntries: vi.fn((next: number) => {
        maxEntries = next;
        return maxEntries;
      }),
      getVectorChatsState: vi.fn(() => chatsEnabled),
      setVectorChatsState: vi.fn((next: boolean) => {
        chatsEnabled = next;
        return chatsEnabled;
      }),
      getVectorFilesState: vi.fn(() => filesEnabled),
      setVectorFilesState: vi.fn((next: boolean) => {
        filesEnabled = next;
        return filesEnabled;
      }),
    });

    const thresholdResult = await executeSlashCommandScript("/vector-threshold 0.4", ctx);
    const queryResult = await executeSlashCommandScript("/vector-query 4", ctx);
    const maxEntriesResult = await executeSlashCommandScript("/vector-max-entries 8", ctx);
    const chatsResult = await executeSlashCommandScript("/vector-chats-state true", ctx);
    const filesResult = await executeSlashCommandScript("/vector-files-state false", ctx);

    expect(thresholdResult.isError).toBe(false);
    expect(queryResult.isError).toBe(false);
    expect(maxEntriesResult.isError).toBe(false);
    expect(chatsResult.isError).toBe(false);
    expect(filesResult.isError).toBe(false);
    expect(thresholdResult.pipe).toBe("0.4");
    expect(queryResult.pipe).toBe("4");
    expect(maxEntriesResult.pipe).toBe("8");
    expect(chatsResult.pipe).toBe("true");
    expect(filesResult.pipe).toBe("false");
  });

  it("vector 状态命令对非法参数与缺失宿主显式 fail-fast", async () => {
    const invalidThreshold = await executeSlashCommandScript(
      "/vector-threshold 2",
      createContext({ getVectorScoreThreshold: vi.fn(() => 0.25), setVectorScoreThreshold: vi.fn() }),
    );
    const invalidQuery = await executeSlashCommandScript(
      "/vector-query 0",
      createContext({ getVectorQueryMessages: vi.fn(() => 2), setVectorQueryMessages: vi.fn() }),
    );
    const invalidBoolean = await executeSlashCommandScript(
      "/vector-chats-state maybe",
      createContext({ getVectorChatsState: vi.fn(() => false), setVectorChatsState: vi.fn() }),
    );
    const missingHost = await executeSlashCommandScript("/vector-files-state", createContext());

    expect(invalidThreshold.isError).toBe(true);
    expect(invalidQuery.isError).toBe(true);
    expect(invalidBoolean.isError).toBe(true);
    expect(missingHost.isError).toBe(true);
    expect(invalidThreshold.errorMessage).toContain("invalid threshold");
    expect(invalidQuery.errorMessage).toContain("invalid numeric");
    expect(invalidBoolean.errorMessage).toContain("invalid boolean");
    expect(missingHost.errorMessage).toContain("not available");
  });

  it("world/lore 命令在宿主不支持时显式 fail-fast", async () => {
    const ctx = createContext();

    const world = await executeSlashCommandScript("/world", ctx);
    const charLore = await executeSlashCommandScript("/getcharlore", ctx);
    const chatLore = await executeSlashCommandScript("/getchatlore", ctx);
    const globalLore = await executeSlashCommandScript("/getgloballore", ctx);
    const personaLore = await executeSlashCommandScript("/getpersonalore", ctx);
    const getField = await executeSlashCommandScript("/getlorefield file=book-1 uid-1", ctx);
    const getEntryField = await executeSlashCommandScript("/getentryfield file=book-1 uid-1", ctx);
    const setField = await executeSlashCommandScript("/setlorefield file=book-1 uid=uid-1 value", ctx);
    const setEntryField = await executeSlashCommandScript("/setentryfield file=book-1 uid=uid-1 value", ctx);
    const findLore = await executeSlashCommandScript("/findlore file=book-1 shadow", ctx);
    const createLore = await executeSlashCommandScript("/createlore file=book-1 key=shadow content", ctx);
    const vectorThreshold = await executeSlashCommandScript("/vector-threshold", ctx);
    const vectorQuery = await executeSlashCommandScript("/vector-query", ctx);
    const vectorMaxEntries = await executeSlashCommandScript("/vector-max-entries", ctx);
    const vectorChats = await executeSlashCommandScript("/vector-chats-state", ctx);
    const vectorFiles = await executeSlashCommandScript("/vector-files-state", ctx);
    const vectorState = await executeSlashCommandScript("/vector-worldinfo-state", ctx);

    expect(world.isError).toBe(true);
    expect(charLore.isError).toBe(true);
    expect(chatLore.isError).toBe(true);
    expect(globalLore.isError).toBe(true);
    expect(personaLore.isError).toBe(true);
    expect(getField.isError).toBe(true);
    expect(getEntryField.isError).toBe(true);
    expect(setField.isError).toBe(true);
    expect(setEntryField.isError).toBe(true);
    expect(findLore.isError).toBe(true);
    expect(createLore.isError).toBe(true);
    expect(vectorThreshold.isError).toBe(true);
    expect(vectorQuery.isError).toBe(true);
    expect(vectorMaxEntries.isError).toBe(true);
    expect(vectorChats.isError).toBe(true);
    expect(vectorFiles.isError).toBe(true);
    expect(vectorState.isError).toBe(true);

    expect(world.errorMessage).toContain("not available");
    expect(charLore.errorMessage).toContain("not available");
    expect(chatLore.errorMessage).toContain("not available");
    expect(globalLore.errorMessage).toContain("not available");
    expect(personaLore.errorMessage).toContain("not available");
    expect(getField.errorMessage).toContain("not available");
    expect(getEntryField.errorMessage).toContain("not available");
    expect(setField.errorMessage).toContain("not available");
    expect(setEntryField.errorMessage).toContain("not available");
    expect(findLore.errorMessage).toContain("not available");
    expect(createLore.errorMessage).toContain("not available");
    expect(vectorThreshold.errorMessage).toContain("not available");
    expect(vectorQuery.errorMessage).toContain("not available");
    expect(vectorMaxEntries.errorMessage).toContain("not available");
    expect(vectorChats.errorMessage).toContain("not available");
    expect(vectorFiles.errorMessage).toContain("not available");
    expect(vectorState.errorMessage).toContain("not available");
  });
});
