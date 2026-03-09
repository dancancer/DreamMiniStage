import { describe, expect, it } from "vitest";
import {
  buildConfigDraft,
  toFormAdvancedSettings,
} from "@/hooks/useModelSidebarConfig/helpers";

describe("useModelSidebarConfig helpers", () => {
  it("构建配置草稿时按后端收口字段", () => {
    const geminiConfig = buildConfigDraft({
      name: "Gemini",
      type: "gemini",
      baseUrl: "https://proxy.example.com",
      model: "gemini-1.5-flash",
      apiKey: "gemini-key",
      availableModels: ["gemini-1.5-flash"],
      advancedSettings: {
        timeout: 15000,
      },
    });

    const ollamaConfig = buildConfigDraft({
      name: "Ollama",
      type: "ollama",
      baseUrl: "localhost:11434",
      model: "llama3",
      apiKey: "ignored",
      availableModels: ["llama3"],
      advancedSettings: {
        contextWindow: 8192,
      },
    });

    expect(geminiConfig.baseUrl).toBe("");
    expect(geminiConfig.apiKey).toBe("gemini-key");
    expect(geminiConfig.availableModels).toEqual(["gemini-1.5-flash"]);
    expect(ollamaConfig.apiKey).toBeUndefined();
    expect(ollamaConfig.availableModels).toEqual([]);
    expect(ollamaConfig.advanced).toEqual({ contextWindow: 8192 });
  });

  it("表单高级参数总是补齐默认 streaming 开关", () => {
    const result = toFormAdvancedSettings({
      maxTokens: 512,
      streaming: false,
    });

    expect(result).toEqual({
      maxTokens: 512,
      streaming: false,
      streamUsage: true,
    });
  });
});
