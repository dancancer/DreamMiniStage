import { describe, expect, it } from "vitest";
import { resolveStoryModelPolicy } from "@/lib/model-capabilities";

describe("resolveStoryModelPolicy", () => {
  it("uses DeepSeek v4 pro 1M context defaults when no preset policy exists", () => {
    const policy = resolveStoryModelPolicy({
      modelName: "deepseek-v4-pro",
      baseUrl: "https://api.deepseek.com",
      request: {},
      blueprint: {},
    });

    expect(policy).toEqual({
      contextWindow: 1_000_000,
      maxTokens: 8192,
      streamUsage: true,
    });
  });

  it("lets explicit output settings override blueprint and model defaults", () => {
    const policy = resolveStoryModelPolicy({
      modelName: "deepseek-v4-pro",
      request: {
        contextWindow: 128_000,
        maxTokens: 4096,
      },
      blueprint: {
        contextWindow: 841_394,
        maxTokens: 65_535,
      },
    });

    expect(policy.contextWindow).toBe(1_000_000);
    expect(policy.maxTokens).toBe(4096);
  });

  it("uses response length as the per-turn output cap", () => {
    const policy = resolveStoryModelPolicy({
      modelName: "deepseek-v4-pro",
      responseLength: 8192,
      request: {
        maxTokens: 512,
      },
      blueprint: {
        maxTokens: 65_535,
      },
    });

    expect(policy.maxTokens).toBe(8192);
  });

  it("caps imported preset limits to the known model capability", () => {
    const policy = resolveStoryModelPolicy({
      modelName: "deepseek-v4-pro",
      blueprint: {
        contextWindow: 2_000_000,
        maxTokens: 500_000,
      },
    });

    expect(policy.contextWindow).toBe(1_000_000);
    expect(policy.maxTokens).toBe(384_000);
  });

  it("does not send ignored sampling parameters to DeepSeek v4 pro thinking mode", () => {
    const policy = resolveStoryModelPolicy({
      modelName: "deepseek-v4-pro",
      blueprint: {
        temperature: 1.5,
        topP: 0.92,
        topK: 500,
        frequencyPenalty: 0.2,
        presencePenalty: 0,
        repeatPenalty: 1,
      },
    });

    expect(policy).not.toHaveProperty("temperature");
    expect(policy).not.toHaveProperty("topP");
    expect(policy).not.toHaveProperty("topK");
    expect(policy).not.toHaveProperty("frequencyPenalty");
    expect(policy).not.toHaveProperty("presencePenalty");
    expect(policy).not.toHaveProperty("repeatPenalty");
  });
});
