import { describe, expect, it } from "vitest";
import { resolveStoryModelPolicy } from "@/lib/model-capabilities";

describe("resolveStoryModelPolicy", () => {
  it("falls back to story defaults when nothing is configured", () => {
    const policy = resolveStoryModelPolicy({ modelName: "gpt-test" });

    expect(policy.contextWindow).toBe(32768);
    expect(policy.maxTokens).toBe(8192);
  });

  it("layers session override > imported preset > global default", () => {
    const policy = resolveStoryModelPolicy({
      modelName: "gpt-test",
      sessionOverride: { temperature: 0.3 },
      blueprint: { temperature: 1.1, maxTokens: 4096 },
      globalDefault: { temperature: 0.9 },
      responseLength: 2000,
    });

    expect(policy.temperature).toBe(0.3); // 会话覆盖最高
    expect(policy.maxTokens).toBe(4096); // 预设盖过全局响应长度
  });

  it("lets the imported preset override the global response length", () => {
    const policy = resolveStoryModelPolicy({
      modelName: "gpt-test",
      blueprint: { maxTokens: 65_535 },
      responseLength: 8192,
    });

    expect(policy.maxTokens).toBe(65_535); // 预设 > 全局默认（与旧行为相反）
  });

  it("uses the global response length when neither session nor preset set output", () => {
    const policy = resolveStoryModelPolicy({ modelName: "gpt-test", responseLength: 2048 });

    expect(policy.maxTokens).toBe(2048);
  });

  it("uses DeepSeek v4 pro 1M context defaults when no preset policy exists", () => {
    const policy = resolveStoryModelPolicy({
      modelName: "deepseek-v4-pro",
      baseUrl: "https://api.deepseek.com",
    });

    expect(policy).toEqual({
      contextWindow: 1_000_000,
      maxTokens: 8192,
      streamUsage: true,
    });
  });

  it("caps imported preset limits to the known model capability", () => {
    const policy = resolveStoryModelPolicy({
      modelName: "deepseek-v4-pro",
      blueprint: { contextWindow: 2_000_000, maxTokens: 500_000 },
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
