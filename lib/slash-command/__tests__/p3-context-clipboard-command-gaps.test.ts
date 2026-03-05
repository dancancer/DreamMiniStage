import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

let contextSeed = 0;

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  contextSeed += 1;

  return {
    characterId: `char-p3-${contextSeed}`,
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

describe("P3 context/clipboard/ask command gaps", () => {
  it("/context 在宿主回调注入时可读写模板名称", async () => {
    const selectContextPreset = vi
      .fn()
      .mockImplementation(async (name?: string) => name || "Default");
    const ctx = createContext({ selectContextPreset });

    const setResult = await executeSlashCommandScript("/context Story", ctx);
    const getResult = await executeSlashCommandScript("/context", ctx);
    const quietSet = await executeSlashCommandScript("/context quiet=true Noir", ctx);

    expect(setResult).toMatchObject({ isError: false, pipe: "Story" });
    expect(getResult).toMatchObject({ isError: false, pipe: "Default" });
    expect(quietSet).toMatchObject({ isError: false, pipe: "Noir" });

    expect(selectContextPreset).toHaveBeenNthCalledWith(1, "Story", { quiet: false });
    expect(selectContextPreset).toHaveBeenNthCalledWith(2, undefined, { quiet: false });
    expect(selectContextPreset).toHaveBeenNthCalledWith(3, "Noir", { quiet: true });
  });

  it("/context 在宿主缺失或参数非法时显式 fail-fast", async () => {
    const noHost = createContext();
    const noHostResult = await executeSlashCommandScript("/context Story", noHost);

    const withHost = createContext({
      selectContextPreset: vi.fn().mockResolvedValue("Default"),
    });
    const badQuiet = await executeSlashCommandScript("/context quiet=maybe Story", withHost);

    expect(noHostResult.isError).toBe(true);
    expect(noHostResult.errorMessage).toContain("not available");
    expect(badQuiet.isError).toBe(true);
    expect(badQuiet.errorMessage).toContain("invalid quiet");
  });

  it("/clipboard-get 与 /clipboard-set 在宿主回调注入时可执行", async () => {
    const getClipboardText = vi.fn().mockResolvedValue("clip-value");
    const setClipboardText = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ getClipboardText, setClipboardText });

    const getResult = await executeSlashCommandScript("/clipboard-get", ctx);
    const setFromArgs = await executeSlashCommandScript("/clipboard-set hello clipboard", ctx);
    const setFromNamed = await executeSlashCommandScript("/clipboard-set text=named-value", ctx);
    const setFromPipe = await executeSlashCommandScript("/echo piped|/clipboard-set", ctx);

    expect(getResult).toMatchObject({ isError: false, pipe: "clip-value" });
    expect(setFromArgs.isError).toBe(false);
    expect(setFromNamed.isError).toBe(false);
    expect(setFromPipe.isError).toBe(false);

    expect(setClipboardText).toHaveBeenNthCalledWith(1, "hello clipboard");
    expect(setClipboardText).toHaveBeenNthCalledWith(2, "named-value");
    expect(setClipboardText).toHaveBeenNthCalledWith(3, "piped");
  });

  it("/clipboard-* 在宿主缺失或返回值非法时显式 fail-fast", async () => {
    const noHost = createContext();
    const getNoHost = await executeSlashCommandScript("/clipboard-get", noHost);
    const setNoHost = await executeSlashCommandScript("/clipboard-set value", noHost);

    const badGetHost = createContext({
      getClipboardText: vi.fn().mockResolvedValue(123 as unknown as string),
      setClipboardText: vi.fn().mockResolvedValue(undefined),
    });
    const badGet = await executeSlashCommandScript("/clipboard-get", badGetHost);
    const missingText = await executeSlashCommandScript("/clipboard-set", badGetHost);

    expect(getNoHost.isError).toBe(true);
    expect(setNoHost.isError).toBe(true);
    expect(getNoHost.errorMessage).toContain("not available");
    expect(setNoHost.errorMessage).toContain("not available");

    expect(badGet.isError).toBe(true);
    expect(badGet.errorMessage).toContain("non-string");
    expect(missingText.isError).toBe(true);
    expect(missingText.errorMessage).toContain("requires text");
  });

  it("/ask 在宿主回调注入时支持 return=pipe|none", async () => {
    const askCharacter = vi
      .fn()
      .mockImplementation(async (target: string, prompt: string) => `${target}:${prompt}`);
    const ctx = createContext({ askCharacter });

    const askPipe = await executeSlashCommandScript("/ask name=Alice hello there", ctx);
    const askNone = await executeSlashCommandScript("/ask name=Alice return=none hidden", ctx);

    expect(askPipe).toMatchObject({ isError: false, pipe: "Alice:hello there" });
    expect(askNone).toMatchObject({ isError: false, pipe: "" });

    expect(askCharacter).toHaveBeenNthCalledWith(1, "Alice", "hello there", { returnType: "pipe" });
    expect(askCharacter).toHaveBeenNthCalledWith(2, "Alice", "hidden", { returnType: "none" });
  });

  it("/ask 在宿主缺失或参数非法时显式 fail-fast", async () => {
    const noHost = createContext();
    const noHostResult = await executeSlashCommandScript("/ask name=Alice hi", noHost);

    const host = createContext({
      askCharacter: vi.fn().mockResolvedValue("ok"),
    });
    const missingName = await executeSlashCommandScript("/ask hi", host);
    const invalidReturn = await executeSlashCommandScript("/ask name=Alice return=json hi", host);

    const badReturnHost = createContext({
      askCharacter: vi.fn().mockResolvedValue(42 as unknown as string),
    });
    const nonString = await executeSlashCommandScript("/ask name=Alice hi", badReturnHost);

    expect(noHostResult.isError).toBe(true);
    expect(noHostResult.errorMessage).toContain("not available");
    expect(missingName.isError).toBe(true);
    expect(missingName.errorMessage).toContain("requires name");
    expect(invalidReturn.isError).toBe(true);
    expect(invalidReturn.errorMessage).toContain("invalid return");
    expect(nonString.isError).toBe(true);
    expect(nonString.errorMessage).toContain("non-string");
  });
});
