import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ConnectionProfileState, ExecutionContext, PromptEntryState } from "../types";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-profile-1",
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

function createProfile(partial?: Partial<ConnectionProfileState>): ConnectionProfileState {
  return {
    id: "profile-default",
    name: "Default",
    ...partial,
  };
}

function createPromptEntry(partial?: Partial<PromptEntryState>): PromptEntryState {
  return {
    identifier: "entry-main",
    name: "Main Prompt",
    enabled: true,
    ...partial,
  };
}

describe("P3 profile/prompt command gaps", () => {
  it("/profile 命令簇支持读取、切换与详情查询", async () => {
    const getCurrentProfileName = vi.fn().mockResolvedValue("Work");
    const setCurrentProfileName = vi
      .fn()
      .mockResolvedValueOnce("Roleplay")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("");
    const listConnectionProfiles = vi.fn().mockResolvedValue([
      createProfile({ id: "p-work", name: "Work" }),
      createProfile({ id: "p-rp", name: "Roleplay" }),
    ]);
    const getConnectionProfile = vi.fn().mockImplementation(async (name?: string) => {
      if (!name) {
        return createProfile({ id: "p-rp", name: "Roleplay", provider: "openai" });
      }
      if (name === "Roleplay") {
        return createProfile({ id: "p-rp", name: "Roleplay", provider: "openai" });
      }
      return null;
    });

    const ctx = createContext({
      getCurrentProfileName,
      setCurrentProfileName,
      listConnectionProfiles,
      getConnectionProfile,
    });

    const readResult = await executeSlashCommandScript("/profile", ctx);
    const switchResult = await executeSlashCommandScript("/profile await=false timeout=1000 Roleplay", ctx);
    const disableResult = await executeSlashCommandScript("/profile <None>", ctx);
    const missingResult = await executeSlashCommandScript("/profile Missing", ctx);
    const listResult = await executeSlashCommandScript("/profile-list", ctx);
    const getCurrentResult = await executeSlashCommandScript("/profile-get", ctx);
    const getNamedResult = await executeSlashCommandScript("/profile-get Roleplay", ctx);

    expect(readResult).toMatchObject({ isError: false, pipe: "Work" });
    expect(switchResult).toMatchObject({ isError: false, pipe: "Roleplay" });
    expect(disableResult).toMatchObject({ isError: false, pipe: "<None>" });
    expect(missingResult).toMatchObject({ isError: false, pipe: "" });
    expect(listResult).toMatchObject({ isError: false, pipe: "[\"Work\",\"Roleplay\"]" });
    expect(getCurrentResult).toMatchObject({ isError: false });
    expect(getNamedResult).toMatchObject({ isError: false });

    expect(setCurrentProfileName).toHaveBeenNthCalledWith(1, "Roleplay", { await: false, timeout: 1000 });
    expect(setCurrentProfileName).toHaveBeenNthCalledWith(2, null, { await: true, timeout: 2000 });
    expect(setCurrentProfileName).toHaveBeenNthCalledWith(3, "Missing", { await: true, timeout: 2000 });
    expect(JSON.parse(getCurrentResult.pipe).name).toBe("Roleplay");
    expect(JSON.parse(getNamedResult.pipe).provider).toBe("openai");
  });

  it("/profile-create 与 /profile-update 透传宿主 profile 生命周期", async () => {
    const createConnectionProfile = vi
      .fn()
      .mockResolvedValue(createProfile({ id: "p-new", name: "Campaign" }));
    const updateConnectionProfile = vi
      .fn()
      .mockResolvedValue(createProfile({ id: "p-new", name: "Campaign" }));

    const ctx = createContext({ createConnectionProfile, updateConnectionProfile });

    const createResult = await executeSlashCommandScript("/profile-create Campaign", ctx);
    const updateResult = await executeSlashCommandScript("/profile-update", ctx);

    expect(createResult).toMatchObject({ isError: false, pipe: "Campaign" });
    expect(updateResult).toMatchObject({ isError: false, pipe: "Campaign" });
    expect(createConnectionProfile).toHaveBeenCalledWith("Campaign");
    expect(updateConnectionProfile).toHaveBeenCalledTimes(1);
  });

  it("profile 命令簇在参数错误或宿主返回异常时显式 fail-fast", async () => {
    const invalidAwait = await executeSlashCommandScript(
      "/profile await=maybe Roleplay",
      createContext({
        setCurrentProfileName: vi.fn().mockResolvedValue("Roleplay"),
        getCurrentProfileName: vi.fn().mockResolvedValue("Roleplay"),
      }),
    );

    const invalidTimeout = await executeSlashCommandScript(
      "/profile timeout=-1 Roleplay",
      createContext({
        setCurrentProfileName: vi.fn().mockResolvedValue("Roleplay"),
        getCurrentProfileName: vi.fn().mockResolvedValue("Roleplay"),
      }),
    );

    const badListReturn = await executeSlashCommandScript(
      "/profile-list",
      createContext({
        listConnectionProfiles: vi.fn().mockResolvedValue({ name: "invalid" }),
      }),
    );

    const badGetReturn = await executeSlashCommandScript(
      "/profile-get",
      createContext({
        getConnectionProfile: vi.fn().mockResolvedValue("invalid"),
      }),
    );

    const missingCreate = await executeSlashCommandScript("/profile-create Alpha", createContext());

    expect(invalidAwait.isError).toBe(true);
    expect(invalidTimeout.isError).toBe(true);
    expect(badListReturn.isError).toBe(true);
    expect(badGetReturn.isError).toBe(true);
    expect(missingCreate.isError).toBe(true);
    expect(invalidAwait.errorMessage).toContain("invalid await");
    expect(invalidTimeout.errorMessage).toContain("invalid timeout");
    expect(badListReturn.errorMessage).toContain("non-array");
    expect(badGetReturn.errorMessage).toContain("invalid profile snapshot");
    expect(missingCreate.errorMessage).toContain("not available");
  });

  it("/prompt-post-processing|/ppp 支持读取与写入", async () => {
    const getPromptPostProcessing = vi.fn().mockResolvedValue("single");
    const setPromptPostProcessing = vi
      .fn()
      .mockResolvedValueOnce("strict")
      .mockResolvedValueOnce("");
    const ctx = createContext({ getPromptPostProcessing, setPromptPostProcessing });

    const readResult = await executeSlashCommandScript("/prompt-post-processing", ctx);
    const setResult = await executeSlashCommandScript("/ppp strict", ctx);
    const noneResult = await executeSlashCommandScript("/prompt-post-processing none", ctx);

    expect(readResult).toMatchObject({ isError: false, pipe: "single" });
    expect(setResult).toMatchObject({ isError: false, pipe: "strict" });
    expect(noneResult).toMatchObject({ isError: false, pipe: "" });

    expect(setPromptPostProcessing).toHaveBeenNthCalledWith(1, "strict");
    expect(setPromptPostProcessing).toHaveBeenNthCalledWith(2, "");
  });

  it("/prompt-post-processing 对宿主缺失与异常返回显式 fail-fast", async () => {
    const missingGet = await executeSlashCommandScript(
      "/prompt-post-processing",
      createContext({
        setPromptPostProcessing: vi.fn().mockResolvedValue("strict"),
      }),
    );

    const missingSet = await executeSlashCommandScript(
      "/ppp strict",
      createContext({
        getPromptPostProcessing: vi.fn().mockResolvedValue("single"),
      }),
    );

    const badReturn = await executeSlashCommandScript(
      "/prompt-post-processing",
      createContext({
        getPromptPostProcessing: vi.fn().mockResolvedValue(123),
      }),
    );

    expect(missingGet.isError).toBe(true);
    expect(missingSet.isError).toBe(true);
    expect(badReturn.isError).toBe(true);
    expect(missingGet.errorMessage).toContain("not available");
    expect(missingSet.errorMessage).toContain("not available");
    expect(badReturn.errorMessage).toContain("non-string");
  });

  it("/prompt 复用 prompt-entry 通道完成读取与写入", async () => {
    const listPromptEntries = vi.fn().mockResolvedValue([
      createPromptEntry({ identifier: "entry-main", name: "Main Prompt", enabled: true }),
      createPromptEntry({ identifier: "entry-summary", name: "Summary Prompt", enabled: false }),
    ]);
    const setPromptEntriesEnabled = vi.fn().mockResolvedValue(undefined);

    const ctx = createContext({ listPromptEntries, setPromptEntriesEnabled });

    const readResult = await executeSlashCommandScript("/prompt identifier=entry-main", ctx);
    const setResult = await executeSlashCommandScript("/prompt identifier=entry-main off", ctx);
    const pipeSetResult = await executeSlashCommandScript("/echo on | /prompt identifier=entry-summary", ctx);

    expect(readResult).toMatchObject({ isError: false, pipe: "true" });
    expect(setResult).toMatchObject({ isError: false, pipe: "" });
    expect(pipeSetResult).toMatchObject({ isError: false, pipe: "" });

    expect(setPromptEntriesEnabled).toHaveBeenNthCalledWith(1, [{
      identifier: "entry-main",
      enabled: false,
    }]);
    expect(setPromptEntriesEnabled).toHaveBeenNthCalledWith(2, [{
      identifier: "entry-summary",
      enabled: true,
    }]);
  });

  it("/prompt 在目标缺失或宿主未注入时显式 fail-fast", async () => {
    const missingTarget = await executeSlashCommandScript(
      "/prompt",
      createContext({
        listPromptEntries: vi.fn().mockResolvedValue([createPromptEntry()]),
      }),
    );

    const missingHost = await executeSlashCommandScript("/prompt identifier=entry-main", createContext());

    expect(missingTarget.isError).toBe(true);
    expect(missingHost.isError).toBe(true);
    expect(missingTarget.errorMessage).toContain("requires identifier or name");
    expect(missingHost.errorMessage).toContain("not available");
  });
});
