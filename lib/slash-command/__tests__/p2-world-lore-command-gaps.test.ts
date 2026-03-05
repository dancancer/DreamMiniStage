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

    expect(world.isError).toBe(true);
    expect(charLore.isError).toBe(true);
    expect(chatLore.isError).toBe(true);
    expect(globalLore.isError).toBe(true);
    expect(personaLore.isError).toBe(true);
    expect(getField.isError).toBe(true);
    expect(getEntryField.isError).toBe(true);
    expect(setField.isError).toBe(true);
    expect(setEntryField.isError).toBe(true);

    expect(world.errorMessage).toContain("not available");
    expect(charLore.errorMessage).toContain("not available");
    expect(chatLore.errorMessage).toContain("not available");
    expect(globalLore.errorMessage).toContain("not available");
    expect(personaLore.errorMessage).toContain("not available");
    expect(getField.errorMessage).toContain("not available");
    expect(getEntryField.errorMessage).toContain("not available");
    expect(setField.errorMessage).toContain("not available");
    expect(setEntryField.errorMessage).toContain("not available");
  });
});
