import { beforeEach, describe, expect, it, vi } from "vitest";

import { useModelStore } from "@/lib/store/model-store";
import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

let contextSeed = 0;

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  contextSeed += 1;

  return {
    characterId: `char-secret-${contextSeed}`,
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

describe("P3 secret command gaps", () => {
  beforeEach(() => {
    contextSeed = 0;
    window.localStorage.clear();
    useModelStore.setState({
      configs: [],
      activeConfigId: "",
    });
  });

  it("/secret-read 会从当前 provider 的现有 api key 启动 secret store", async () => {
    window.localStorage.setItem("llmType", "openai");
    window.localStorage.setItem("openaiApiKey", "legacy-openai-key");
    window.localStorage.setItem("apiKey", "legacy-openai-key");

    const ctx = createContext();
    const result = await executeSlashCommandScript("/secret-read", ctx);

    expect(result).toMatchObject({ isError: false, pipe: "legacy-openai-key" });
    expect(window.localStorage.getItem("dreamministage.secret-store")).toContain("legacy-openai-key");
  });

  it("/secret-write /secret-id /secret-get 会共享单一路径并同步到 active config", async () => {
    window.localStorage.setItem("llmType", "openai");
    window.localStorage.setItem("openaiApiKey", "legacy-openai-key");
    window.localStorage.setItem("apiKey", "legacy-openai-key");
    useModelStore.setState({
      configs: [
        {
          id: "cfg-openai",
          name: "OpenAI",
          type: "openai",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-4o-mini",
          apiKey: "legacy-openai-key",
        },
      ],
      activeConfigId: "cfg-openai",
    });

    const ctx = createContext();
    const created = await executeSlashCommandScript(
      "/secret-write key=openai label=prod next-openai-key",
      ctx,
    );
    const createdId = created.pipe;
    const switchBack = await executeSlashCommandScript("/secret-id openai-active", ctx);
    const readLegacy = await executeSlashCommandScript("/secret-get", ctx);
    const switchAgain = await executeSlashCommandScript(`/secret-rotate ${createdId}`, ctx);

    expect(created.isError).toBe(false);
    expect(createdId).toMatch(/^openai-/);
    expect(switchBack).toMatchObject({ isError: false, pipe: "openai-active" });
    expect(readLegacy).toMatchObject({ isError: false, pipe: "legacy-openai-key" });
    expect(switchAgain).toMatchObject({ isError: false, pipe: createdId });
    expect(window.localStorage.getItem("openaiApiKey")).toBe("next-openai-key");
    expect(window.localStorage.getItem("apiKey")).toBe("next-openai-key");
    expect(useModelStore.getState().getConfigById("cfg-openai")?.apiKey).toBe("next-openai-key");
  });

  it("/secret-rename /secret-find /secret-delete 支持别名、活动项回退与 provider 同步", async () => {
    window.localStorage.setItem("llmType", "gemini");
    window.localStorage.setItem("geminiApiKey", "legacy-gemini-key");
    window.localStorage.setItem("apiKey", "legacy-gemini-key");

    const ctx = createContext();
    const created = await executeSlashCommandScript(
      "/secret-write key=gemini label=work next-gemini-key",
      ctx,
    );
    const renamed = await executeSlashCommandScript("/secret-rename key=gemini id=gemini-active primary", ctx);
    const found = await executeSlashCommandScript("/secret-find key=gemini primary", ctx);
    const deletedActive = await executeSlashCommandScript("/secret-delete key=gemini", ctx);
    const fallbackRead = await executeSlashCommandScript("/secret-read key=gemini", ctx);

    expect(created.isError).toBe(false);
    expect(renamed).toMatchObject({ isError: false, pipe: "gemini-active" });
    expect(found).toMatchObject({ isError: false, pipe: "legacy-gemini-key" });
    expect(deletedActive).toMatchObject({ isError: false, pipe: created.pipe });
    expect(fallbackRead).toMatchObject({ isError: false, pipe: "legacy-gemini-key" });
    expect(window.localStorage.getItem("geminiApiKey")).toBe("legacy-gemini-key");
    expect(window.localStorage.getItem("apiKey")).toBe("legacy-gemini-key");
  });

  it("secret 命令簇对参数非法、缺少存储与查找失败显式 fail-fast", async () => {
    const ctx = createContext();

    window.localStorage.setItem("llmType", "openai");
    window.localStorage.setItem("openaiApiKey", "legacy-openai-key");

    const badQuiet = await executeSlashCommandScript("/secret-read quiet=maybe", ctx);
    const missingValue = await executeSlashCommandScript("/secret-write", ctx);
    const missingRenameId = await executeSlashCommandScript("/secret-rename NewName", ctx);
    const missingStore = await executeSlashCommandScript("/secret-read key=ollama", ctx);
    const missingTarget = await executeSlashCommandScript("/secret-id missing-secret", ctx);

    expect(badQuiet.isError).toBe(true);
    expect(missingValue.isError).toBe(true);
    expect(missingRenameId.isError).toBe(true);
    expect(missingStore.isError).toBe(true);
    expect(missingTarget.isError).toBe(true);
    expect(badQuiet.errorMessage).toContain("invalid quiet value");
    expect(missingValue.errorMessage).toContain("requires a secret value");
    expect(missingRenameId.errorMessage).toContain("requires id=");
    expect(missingStore.errorMessage).toContain("has no saved secrets");
    expect(missingTarget.errorMessage).toContain("could not find secret");
  });
});
