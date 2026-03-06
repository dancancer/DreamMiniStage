import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

let contextSeed = 0;

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  contextSeed += 1;

  return {
    characterId: `char-extension-${contextSeed}`,
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

describe("P3 extension command gaps", () => {
  it("/extension-exists 与 /extension-installed 返回安装态", async () => {
    const isExtensionInstalled = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const ctx = createContext({ isExtensionInstalled });

    const exists = await executeSlashCommandScript("/extension-exists Summarize", ctx);
    const installed = await executeSlashCommandScript("/extension-installed MissingExt", ctx);

    expect(exists).toMatchObject({ isError: false, pipe: "true" });
    expect(installed).toMatchObject({ isError: false, pipe: "false" });
    expect(isExtensionInstalled).toHaveBeenNthCalledWith(1, "Summarize");
    expect(isExtensionInstalled).toHaveBeenNthCalledWith(2, "MissingExt");
  });

  it("/extension-enable 与 /extension-disable 支持状态切换并透传 reload", async () => {
    const isExtensionInstalled = vi.fn().mockResolvedValue(true);
    const getExtensionEnabledState = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const setExtensionEnabled = vi
      .fn()
      .mockResolvedValueOnce("plugin-summarize")
      .mockResolvedValueOnce(undefined);
    const ctx = createContext({
      isExtensionInstalled,
      getExtensionEnabledState,
      setExtensionEnabled,
    });

    const enableResult = await executeSlashCommandScript("/extension-enable Summarize", ctx);
    const disableResult = await executeSlashCommandScript("/extension-disable reload=off Summarize", ctx);

    expect(enableResult).toMatchObject({ isError: false, pipe: "plugin-summarize" });
    expect(disableResult).toMatchObject({ isError: false, pipe: "Summarize" });
    expect(setExtensionEnabled).toHaveBeenNthCalledWith(1, "Summarize", true, { reload: false });
    expect(setExtensionEnabled).toHaveBeenNthCalledWith(2, "Summarize", false, { reload: false });
  });

  it("/extension-toggle 支持显式 state 与 reload=true", async () => {
    const isExtensionInstalled = vi.fn().mockResolvedValue(true);
    const getExtensionEnabledState = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const setExtensionEnabled = vi.fn().mockResolvedValue("Summarize");
    const reloadPage = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({
      isExtensionInstalled,
      getExtensionEnabledState,
      setExtensionEnabled,
      reloadPage,
    });

    const forcedEnable = await executeSlashCommandScript(
      "/extension-toggle state=true reload=true Summarize",
      ctx,
    );
    const toggledBack = await executeSlashCommandScript("/extension-toggle Summarize", ctx);

    expect(forcedEnable).toMatchObject({ isError: false, pipe: "Summarize" });
    expect(toggledBack).toMatchObject({ isError: false, pipe: "Summarize" });
    expect(setExtensionEnabled).toHaveBeenNthCalledWith(1, "Summarize", true, { reload: true });
    expect(setExtensionEnabled).toHaveBeenNthCalledWith(2, "Summarize", false, { reload: false });
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it("/translate 透传 target/provider 并返回宿主结果", async () => {
    const translateText = vi.fn().mockResolvedValue("你好，世界");
    const ctx = createContext({ translateText });

    const result = await executeSlashCommandScript(
      "/translate target=zh provider=deepl hello world",
      ctx,
    );

    expect(result).toMatchObject({ isError: false, pipe: "你好，世界" });
    expect(translateText).toHaveBeenCalledWith("hello world", {
      target: "zh",
      provider: "deepl",
    });
  });

  it("/translate 支持 pipe 输入并对缺参/返回异常显式 fail-fast", async () => {
    const pipeCtx = createContext({
      setInputText: vi.fn().mockResolvedValue(undefined),
      translateText: vi.fn().mockResolvedValue("bonjour"),
    });
    const fromPipe = await executeSlashCommandScript("/setinput hello | /translate target=fr", pipeCtx);
    const missingHost = await executeSlashCommandScript("/translate hello", createContext());
    const missingText = await executeSlashCommandScript(
      "/translate target=fr",
      createContext({ translateText: vi.fn().mockResolvedValue("bonjour") }),
    );
    const invalidResult = await executeSlashCommandScript(
      "/translate hello",
      createContext({
        translateText: vi.fn().mockResolvedValue(1 as unknown as string),
      }),
    );

    expect(fromPipe).toMatchObject({ isError: false, pipe: "bonjour" });
    expect(missingHost.isError).toBe(true);
    expect(missingText.isError).toBe(true);
    expect(invalidResult.isError).toBe(true);
    expect(missingHost.errorMessage).toContain("not available");
    expect(missingText.errorMessage).toContain("requires text");
    expect(invalidResult.errorMessage).toContain("non-string");
  });

  it("extension 命令在宿主缺失、扩展缺失、参数非法时显式 fail-fast", async () => {
    const noHost = createContext();
    const noHostResult = await executeSlashCommandScript("/extension-state Summarize", noHost);

    expect(noHostResult.isError).toBe(true);
    expect(noHostResult.errorMessage).toContain("not available");

    const missingExtensionCtx = createContext({
      isExtensionInstalled: vi.fn().mockResolvedValue(false),
      getExtensionEnabledState: vi.fn(),
      setExtensionEnabled: vi.fn(),
    });
    const missingExtension = await executeSlashCommandScript(
      "/extension-enable MissingExt",
      missingExtensionCtx,
    );

    expect(missingExtension.isError).toBe(true);
    expect(missingExtension.errorMessage).toContain("not installed");

    const badStateCtx = createContext({
      isExtensionInstalled: vi.fn().mockResolvedValue(true),
      getExtensionEnabledState: vi.fn().mockResolvedValue(false),
      setExtensionEnabled: vi.fn().mockResolvedValue("Summarize"),
    });
    const badState = await executeSlashCommandScript("/extension-toggle state=maybe Summarize", badStateCtx);
    const badReload = await executeSlashCommandScript("/extension-enable reload=maybe Summarize", badStateCtx);

    expect(badState.isError).toBe(true);
    expect(badReload.isError).toBe(true);
    expect(badState.errorMessage).toContain("invalid state");
    expect(badReload.errorMessage).toContain("invalid reload");
  });

  it("extension 命令对宿主返回异常显式 fail-fast", async () => {
    const badExists = await executeSlashCommandScript(
      "/extension-exists Summarize",
      createContext({
        isExtensionInstalled: vi.fn().mockResolvedValue("yes" as unknown as boolean),
      }),
    );

    const badState = await executeSlashCommandScript(
      "/extension-state Summarize",
      createContext({
        isExtensionInstalled: vi.fn().mockResolvedValue(true),
        getExtensionEnabledState: vi.fn().mockResolvedValue("on" as unknown as boolean),
      }),
    );

    const badSetReturnCtx = createContext({
      isExtensionInstalled: vi.fn().mockResolvedValue(true),
      getExtensionEnabledState: vi.fn().mockResolvedValue(false),
      setExtensionEnabled: vi.fn().mockResolvedValue(1 as unknown as string),
    });
    const badSetReturn = await executeSlashCommandScript(
      "/extension-enable Summarize",
      badSetReturnCtx,
    );

    const reloadMissingCtx = createContext({
      isExtensionInstalled: vi.fn().mockResolvedValue(true),
      getExtensionEnabledState: vi.fn().mockResolvedValue(false),
      setExtensionEnabled: vi.fn().mockResolvedValue("Summarize"),
    });
    const reloadMissing = await executeSlashCommandScript(
      "/extension-enable reload=true Summarize",
      reloadMissingCtx,
    );

    expect(badExists.isError).toBe(true);
    expect(badState.isError).toBe(true);
    expect(badSetReturn.isError).toBe(true);
    expect(reloadMissing.isError).toBe(true);

    expect(badExists.errorMessage).toContain("non-boolean");
    expect(badState.errorMessage).toContain("non-boolean");
    expect(badSetReturn.errorMessage).toContain("must return a string");
    expect(reloadMissing.errorMessage).toContain("reload requested");
    expect(reloadMissingCtx.setExtensionEnabled).not.toHaveBeenCalled();
  });
});
