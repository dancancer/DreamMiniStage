import { describe, expect, it } from "vitest";
import { cleanModelCallConfig } from "../clean-model-call-config";

describe("cleanModelCallConfig", () => {
  it("keeps model-call fields and drops session-only config", () => {
    const out = cleanModelCallConfig({
      modelName: "m",
      apiKey: "k",
      baseUrl: "https://x",
      llmType: "openai",
      maxTokens: 8192,
      temperature: 0.7,
      mvuToolEnabled: true,
      tools: true,
      stopStrings: ["X"],
      streaming: true,
    });

    expect(out.modelName).toBe("m");
    expect(out.apiKey).toBe("k");
    expect(out.maxTokens).toBe(8192);
    expect(out.temperature).toBe(0.7);
    expect(out.mvuToolEnabled).toBeUndefined();
    expect(out.tools).toBeUndefined();
    expect(out.stopStrings).toBeUndefined();
    expect(out.streaming).toBeUndefined();
    expect(out.messages).toBeUndefined();
  });
});
