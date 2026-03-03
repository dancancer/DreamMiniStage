import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

function createApiContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-api-1",
    messages: [],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

describe("P2 api command gaps", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("/api 在只读路径下返回当前 API", async () => {
    const getApiSource = vi.fn().mockResolvedValue("gemini");
    const ctx = createApiContext({ getApiSource });

    const result = await executeSlashCommandScript("/api", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("gemini");
    expect(getApiSource).toHaveBeenCalledTimes(1);
  });

  it("/api 在缺少回调时回落到 localStorage", async () => {
    window.localStorage.setItem("llmType", "ollama");
    const ctx = createApiContext();

    const result = await executeSlashCommandScript("/api", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("ollama");
  });

  it("/api 在写路径下显式 fail-fast", async () => {
    const ctx = createApiContext({ getApiSource: vi.fn().mockResolvedValue("openai") });

    const result = await executeSlashCommandScript("/api openai", ctx);

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("set is not supported");
  });

  it("/api-url 返回当前 API 对应 URL，并支持 /server 别名", async () => {
    const getApiSource = vi.fn().mockResolvedValue("openai");
    const getApiUrl = vi.fn().mockImplementation(async (source?: string) => {
      const map: Record<string, string> = {
        openai: "https://api.openai.com/v1",
        ollama: "http://localhost:11434",
        gemini: "https://generativelanguage.googleapis.com",
      };
      return map[source || "openai"];
    });
    const ctx = createApiContext({ getApiSource, getApiUrl });

    const first = await executeSlashCommandScript("/api-url", ctx);
    const second = await executeSlashCommandScript("/server", ctx);

    expect(first.isError).toBe(false);
    expect(second.isError).toBe(false);
    expect(first.pipe).toBe("https://api.openai.com/v1");
    expect(second.pipe).toBe("https://api.openai.com/v1");
    expect(getApiUrl).toHaveBeenCalledWith("openai");
  });

  it("/api-url 支持 api 命名参数并校验别名", async () => {
    const getApiUrl = vi.fn().mockResolvedValue("https://api.openai.com/v1");
    const ctx = createApiContext({
      getApiSource: vi.fn().mockResolvedValue("gemini"),
      getApiUrl,
    });

    const result = await executeSlashCommandScript("/api-url api=custom", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("https://api.openai.com/v1");
    expect(getApiUrl).toHaveBeenCalledWith("openai");
  });

  it("/api-url 在写路径与非法 api 参数下做 fail-fast", async () => {
    const ctx = createApiContext({
      getApiSource: vi.fn().mockResolvedValue("openai"),
      getApiUrl: vi.fn().mockResolvedValue("https://api.openai.com/v1"),
    });

    const writeResult = await executeSlashCommandScript("/api-url https://example.com", ctx);
    const invalidResult = await executeSlashCommandScript("/api-url api=invalid-source", ctx);

    expect(writeResult.isError).toBe(true);
    expect(writeResult.errorMessage).toContain("set is not supported");
    expect(invalidResult.isError).toBe(true);
    expect(invalidResult.errorMessage).toContain("unsupported api source");
  });
});
