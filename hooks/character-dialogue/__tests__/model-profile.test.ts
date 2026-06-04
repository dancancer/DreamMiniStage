import { describe, expect, it } from "vitest";
import { buildDialogueModelProfile } from "@/hooks/character-dialogue/model-profile";

describe("buildDialogueModelProfile", () => {
  it("把 LLM 配置和对话生成偏好收束成单一 Profile", () => {
    const result = buildDialogueModelProfile({
      language: "zh",
      llmConfig: {
        llmType: "openai",
        modelName: "gpt-4o-mini",
        baseUrl: "https://api.example.com/v1",
        apiKey: "key",
        advanced: {
          streaming: false,
          maxTokens: 512,
        },
        instructTemplateId: "story-template",
      },
      responseLength: 8192,
      fastModelEnabled: true,
    });

    expect(result).toEqual({
      language: "zh",
      llmType: "openai",
      modelName: "gpt-4o-mini",
      baseUrl: "https://api.example.com/v1",
      apiKey: "key",
      advanced: {
        streaming: false,
        maxTokens: 512,
      },
      responseLength: 8192,
      fastModel: true,
    });
  });
});
