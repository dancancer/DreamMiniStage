import { describe, expect, it } from "vitest";
import { buildDialogueLlmConfig } from "@/hooks/character-dialogue/useDialoguePreferences";

describe("buildDialogueLlmConfig", () => {
  it("保留当前激活配置自己的 streaming 默认值", () => {
    const result = buildDialogueLlmConfig({
      id: "cfg-1",
      name: "Config",
      type: "openai",
      baseUrl: "https://api.example.com/v1",
      model: "gpt-4o-mini",
      apiKey: "key",
      advanced: {
        streaming: false,
        maxTokens: 512,
      },
    });

    expect(result.advanced).toEqual({
      streaming: false,
      maxTokens: 512,
    });
  });

  it("在没有激活配置时返回空高级参数", () => {
    const result = buildDialogueLlmConfig(undefined);

    expect(result).toMatchObject({
      llmType: "openai",
      modelName: "",
      baseUrl: "",
      apiKey: "",
      advanced: {},
    });
  });

  it("在 function-calling 策略下显式打开 mvuToolEnabled", () => {
    const result = buildDialogueLlmConfig({
      id: "cfg-2",
      name: "Config",
      type: "openai",
      baseUrl: "https://api.example.com/v1",
      model: "gpt-4o-mini",
      apiKey: "key",
      advanced: {},
    }, "function-calling");

    expect(result.mvuToolEnabled).toBe(true);
  });
});
