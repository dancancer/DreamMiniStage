import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { AuthorNoteState, ExecutionContext } from "../types";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-note-persona-1",
    messages: [
      { id: "m-0", role: "user", content: "hello", name: "User" },
      { id: "m-1", role: "assistant", content: "world", name: "Assistant" },
    ],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

function createNoteState(partial?: Partial<AuthorNoteState>): AuthorNoteState {
  return {
    text: "",
    depth: 4,
    frequency: 1,
    position: "chat",
    role: "system",
    ...partial,
  };
}

describe("P3 note/persona command gaps", () => {
  it("/note 与 note-* 命令簇支持读写与别名", async () => {
    const getAuthorNoteState = vi.fn().mockResolvedValue(createNoteState({ text: "saved-note" }));
    const setAuthorNoteState = vi
      .fn()
      .mockResolvedValueOnce(createNoteState({ text: "new-note" }))
      .mockResolvedValueOnce(createNoteState({ text: "new-note", depth: 9 }))
      .mockResolvedValueOnce(createNoteState({ text: "new-note", depth: 9, frequency: 3 }))
      .mockResolvedValueOnce(createNoteState({ text: "new-note", depth: 9, frequency: 3, position: "before" }))
      .mockResolvedValueOnce(createNoteState({ text: "new-note", depth: 9, frequency: 3, position: "before", role: "assistant" }));

    const ctx = createContext({ getAuthorNoteState, setAuthorNoteState });

    const readResult = await executeSlashCommandScript("/note", ctx);
    const setResult = await executeSlashCommandScript("/note new-note", ctx);
    const depthAlias = await executeSlashCommandScript("/depth 9", ctx);
    const freqAlias = await executeSlashCommandScript("/note-freq 3", ctx);
    const positionAlias = await executeSlashCommandScript("/note-pos before_scenario", ctx);
    const roleResult = await executeSlashCommandScript("/note-role assistant", ctx);

    expect(readResult).toMatchObject({ isError: false, pipe: "saved-note" });
    expect(setResult).toMatchObject({ isError: false, pipe: "new-note" });
    expect(depthAlias).toMatchObject({ isError: false, pipe: "9" });
    expect(freqAlias).toMatchObject({ isError: false, pipe: "3" });
    expect(positionAlias).toMatchObject({ isError: false, pipe: "before" });
    expect(roleResult).toMatchObject({ isError: false, pipe: "assistant" });

    expect(getAuthorNoteState).toHaveBeenCalledTimes(1);
    expect(setAuthorNoteState).toHaveBeenNthCalledWith(1, { text: "new-note" });
    expect(setAuthorNoteState).toHaveBeenNthCalledWith(2, { depth: 9 });
    expect(setAuthorNoteState).toHaveBeenNthCalledWith(3, { frequency: 3 });
    expect(setAuthorNoteState).toHaveBeenNthCalledWith(4, { position: "before" });
    expect(setAuthorNoteState).toHaveBeenNthCalledWith(5, { role: "assistant" });
  });

  it("note-* 对非法参数与无效宿主返回显式 fail-fast", async () => {
    const missingHost = await executeSlashCommandScript("/note", createContext());

    const invalidDepth = await executeSlashCommandScript(
      "/note-depth nope",
      createContext({
        getAuthorNoteState: vi.fn().mockResolvedValue(createNoteState()),
        setAuthorNoteState: vi.fn().mockResolvedValue(createNoteState()),
      }),
    );
    const invalidPosition = await executeSlashCommandScript(
      "/note-position middle",
      createContext({
        getAuthorNoteState: vi.fn().mockResolvedValue(createNoteState()),
        setAuthorNoteState: vi.fn().mockResolvedValue(createNoteState()),
      }),
    );
    const invalidRole = await executeSlashCommandScript(
      "/note-role narrator",
      createContext({
        getAuthorNoteState: vi.fn().mockResolvedValue(createNoteState()),
        setAuthorNoteState: vi.fn().mockResolvedValue(createNoteState()),
      }),
    );
    const badReturn = await executeSlashCommandScript(
      "/note",
      createContext({
        getAuthorNoteState: vi.fn().mockResolvedValue({ text: 123 }),
      }),
    );

    expect(missingHost.isError).toBe(true);
    expect(invalidDepth.isError).toBe(true);
    expect(invalidPosition.isError).toBe(true);
    expect(invalidRole.isError).toBe(true);
    expect(badReturn.isError).toBe(true);

    expect(missingHost.errorMessage).toContain("not available");
    expect(invalidDepth.errorMessage).toContain("invalid depth");
    expect(invalidPosition.errorMessage).toContain("invalid position");
    expect(invalidRole.errorMessage).toContain("invalid role");
    expect(badReturn.errorMessage).toContain("invalid note text");
  });

  it("/persona 与 /persona-set 支持读取与 mode 驱动写入", async () => {
    const getPersonaName = vi.fn().mockResolvedValue("Persona-A");
    const setPersonaName = vi.fn().mockResolvedValue("Persona-B");
    const ctx = createContext({ getPersonaName, setPersonaName });

    const readResult = await executeSlashCommandScript("/persona", ctx);
    const setResult = await executeSlashCommandScript("/persona-set mode=lookup Persona-B", ctx);

    expect(readResult).toMatchObject({ isError: false, pipe: "Persona-A" });
    expect(setResult).toMatchObject({ isError: false, pipe: "Persona-B" });
    expect(getPersonaName).toHaveBeenCalledTimes(1);
    expect(setPersonaName).toHaveBeenCalledWith("Persona-B", { mode: "lookup" });
  });

  it("/persona-set 对非法 mode 与无效返回显式 fail-fast", async () => {
    const invalidMode = await executeSlashCommandScript(
      "/persona mode=unknown Alex",
      createContext({
        setPersonaName: vi.fn().mockResolvedValue("Alex"),
      }),
    );

    const badReturn = await executeSlashCommandScript(
      "/persona-set Alex",
      createContext({
        setPersonaName: vi.fn().mockResolvedValue(123),
      }),
    );

    expect(invalidMode.isError).toBe(true);
    expect(badReturn.isError).toBe(true);
    expect(invalidMode.errorMessage).toContain("invalid mode");
    expect(badReturn.errorMessage).toContain("non-string");
  });

  it("/persona-lock 支持查询与状态切换", async () => {
    const getPersonaLockState = vi.fn().mockResolvedValue(false);
    const setPersonaLock = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const ctx = createContext({ getPersonaLockState, setPersonaLock });

    const readResult = await executeSlashCommandScript("/persona-lock type=chat", ctx);
    const onResult = await executeSlashCommandScript("/persona-lock type=chat on", ctx);
    const toggleResult = await executeSlashCommandScript("/persona-lock type=default toggle", ctx);

    expect(readResult).toMatchObject({ isError: false, pipe: "false" });
    expect(onResult).toMatchObject({ isError: false, pipe: "true" });
    expect(toggleResult).toMatchObject({ isError: false, pipe: "false" });
    expect(getPersonaLockState).toHaveBeenCalledWith({ type: "chat" });
    expect(setPersonaLock).toHaveBeenNthCalledWith(1, "on", { type: "chat" });
    expect(setPersonaLock).toHaveBeenNthCalledWith(2, "toggle", { type: "default" });
  });

  it("/persona-lock 对非法参数与宿主缺失显式 fail-fast", async () => {
    const missingGet = await executeSlashCommandScript("/persona-lock", createContext({
      setPersonaLock: vi.fn().mockResolvedValue(true),
    }));
    const missingSet = await executeSlashCommandScript("/persona-lock on", createContext({
      getPersonaLockState: vi.fn().mockResolvedValue(false),
    }));
    const invalidType = await executeSlashCommandScript("/persona-lock type=session", createContext({
      getPersonaLockState: vi.fn().mockResolvedValue(false),
    }));
    const invalidState = await executeSlashCommandScript("/persona-lock maybe", createContext({
      getPersonaLockState: vi.fn().mockResolvedValue(false),
      setPersonaLock: vi.fn().mockResolvedValue(true),
    }));

    expect(missingGet.isError).toBe(true);
    expect(missingSet.isError).toBe(true);
    expect(invalidType.isError).toBe(true);
    expect(invalidState.isError).toBe(true);
    expect(missingGet.errorMessage).toContain("not available");
    expect(missingSet.errorMessage).toContain("not available");
    expect(invalidType.errorMessage).toContain("invalid type");
    expect(invalidState.errorMessage).toContain("invalid state");
  });

  it("/persona-sync 与 /sync 透传宿主同步回调", async () => {
    const syncPersona = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ syncPersona });

    const syncResult = await executeSlashCommandScript("/persona-sync", ctx);
    const aliasResult = await executeSlashCommandScript("/sync", ctx);

    expect(syncResult).toMatchObject({ isError: false, pipe: "" });
    expect(aliasResult).toMatchObject({ isError: false, pipe: "" });
    expect(syncPersona).toHaveBeenCalledTimes(2);
  });
});
