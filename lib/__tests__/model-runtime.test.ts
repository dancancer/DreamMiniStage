import { beforeEach, describe, expect, it } from "vitest";
import {
  MODEL_ADVANCED_STORAGE_KEYS,
  MODEL_STORAGE_KEYS,
  applyContextWindowToMessages,
  convertPresetToModelAdvancedSettings,
  estimateMessageTokens,
  resolveModelAdvancedSettings,
  syncModelConfigToStorage,
} from "@/lib/model-runtime";
import {
  supportsModelAdvancedBooleanSetting,
  supportsModelAdvancedNumberSetting,
} from "@/lib/model-runtime-support";

describe("model runtime storage keys", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("将模型 streaming 配置与聊天 UI 开关分离持久化", () => {
    expect(MODEL_ADVANCED_STORAGE_KEYS.streaming).toBe("modelStreamingEnabled");
    expect(MODEL_ADVANCED_STORAGE_KEYS.streaming).not.toBe("streamingEnabled");
  });

  it("同步配置时同时写入通用 key 与当前类型 key", () => {
    window.localStorage.setItem(MODEL_ADVANCED_STORAGE_KEYS.timeout, "9000");

    syncModelConfigToStorage({
      id: "cfg-openai",
      name: "OpenAI",
      type: "openai",
      baseUrl: "https://api.example.com/v1",
      model: "gpt-4o-mini",
      apiKey: "sk-openai",
      advanced: {
        maxTokens: 256,
        streaming: false,
      },
    });

    expect(window.localStorage.getItem("llmType")).toBe("openai");
    expect(window.localStorage.getItem("modelName")).toBe("gpt-4o-mini");
    expect(window.localStorage.getItem(MODEL_STORAGE_KEYS.openai.model)).toBe("gpt-4o-mini");
    expect(window.localStorage.getItem("modelBaseUrl")).toBe("https://api.example.com/v1");
    expect(window.localStorage.getItem(MODEL_STORAGE_KEYS.openai.baseUrl)).toBe("https://api.example.com/v1");
    expect(window.localStorage.getItem(MODEL_STORAGE_KEYS.openai.apiKey || "")).toBe("sk-openai");
    expect(window.localStorage.getItem("apiKey")).toBe("sk-openai");
    expect(window.localStorage.getItem(MODEL_ADVANCED_STORAGE_KEYS.maxTokens)).toBe("256");
    expect(window.localStorage.getItem(MODEL_ADVANCED_STORAGE_KEYS.streaming)).toBe("false");
    expect(window.localStorage.getItem(MODEL_ADVANCED_STORAGE_KEYS.timeout)).toBeNull();
  });
});

describe("model advanced settings", () => {
  it("按 request > session > preset 优先级合并高级参数", () => {
    const result = resolveModelAdvancedSettings({
      request: {
        temperature: 0.8,
        streaming: false,
      },
      session: {
        temperature: 0.6,
        topP: 0.9,
        streamUsage: false,
      },
      preset: {
        temperature: 0.4,
        topP: 0.7,
        maxTokens: 1024,
        streamUsage: true,
      },
    });

    expect(result).toEqual({
      temperature: 0.8,
      topP: 0.9,
      maxTokens: 1024,
      streaming: false,
      streamUsage: false,
    });
  });

  it("将 ST preset 采样字段映射为统一高级参数", () => {
    const result = convertPresetToModelAdvancedSettings({
      temperature: 0.55,
      top_p: 0.8,
      top_k: 64,
      frequency_penalty: 0.2,
      presence_penalty: 0.1,
      repetition_penalty: 1.15,
      openai_max_context: 32000,
      openai_max_tokens: 2048,
      stream_openai: true,
    });

    expect(result).toEqual({
      temperature: 0.55,
      contextWindow: 32000,
      maxTokens: 2048,
      topP: 0.8,
      frequencyPenalty: 0.2,
      presencePenalty: 0.1,
      topK: 64,
      repeatPenalty: 1.15,
      streaming: true,
    });
  });
});

describe("model advanced setting support", () => {
  it("只暴露后端真正支持的数字高级参数", () => {
    expect(supportsModelAdvancedNumberSetting("openai", "maxRetries")).toBe(true);
    expect(supportsModelAdvancedNumberSetting("gemini", "timeout")).toBe(true);
    expect(supportsModelAdvancedNumberSetting("gemini", "maxRetries")).toBe(false);
    expect(supportsModelAdvancedNumberSetting("ollama", "timeout")).toBe(false);
    expect(supportsModelAdvancedNumberSetting("openai", "topK")).toBe(false);
    expect(supportsModelAdvancedNumberSetting("ollama", "repeatPenalty")).toBe(true);
  });

  it("只在支持 usage 统计的后端展示 stream usage 开关", () => {
    expect(supportsModelAdvancedBooleanSetting("openai", "streamUsage")).toBe(true);
    expect(supportsModelAdvancedBooleanSetting("gemini", "streamUsage")).toBe(false);
    expect(supportsModelAdvancedBooleanSetting("ollama", "streaming")).toBe(true);
  });
});

describe("applyContextWindowToMessages", () => {
  function totalTokens(messages: Array<{ content: string }>): number {
    return messages.reduce((sum, message) => sum + estimateMessageTokens(message.content), 0);
  }

  it("在 system prompt 自身超过预算时仍保证结果不超预算", () => {
    const messages = [
      { role: "system", content: "A".repeat(200) },
      { role: "user", content: "hello" },
    ];

    const result = applyContextWindowToMessages(messages, {
      contextWindow: 40,
      maxTokens: 10,
    });

    expect(totalTokens(result)).toBeLessThanOrEqual(30);
  });

  it("裁剪上下文时保持保留消息的原始相对顺序", () => {
    const messages = [
      { id: "s1", role: "system", content: "intro" },
      { id: "u1", role: "user", content: "first user turn" },
      { id: "s2", role: "system", content: "late system guard" },
      { id: "a1", role: "assistant", content: "assistant answer" },
      { id: "u2", role: "user", content: "latest user turn that should survive" },
    ];

    const result = applyContextWindowToMessages(messages, {
      contextWindow: 28,
      maxTokens: 6,
    });

    const ids = result.map((message) => message.id);
    expect(ids).toEqual([...ids].sort((left, right) => {
      const leftIndex = messages.findIndex((message) => message.id === left);
      const rightIndex = messages.findIndex((message) => message.id === right);
      return leftIndex - rightIndex;
    }));
  });

  it("在 maxTokens 吃光上下文预算时显式失败", () => {
    expect(() => applyContextWindowToMessages([
      { role: "system", content: "prompt" },
      { role: "user", content: "hello" },
    ], {
      contextWindow: 20,
      maxTokens: 20,
    })).toThrow("contextWindow must be greater than maxTokens");
  });

  it("system prompt 很长时仍优先保留最新用户输入", () => {
    const messages = [
      { id: "s1", role: "system", content: "A".repeat(200) },
      { id: "u1", role: "user", content: "latest user turn" },
    ];

    const result = applyContextWindowToMessages(messages, {
      contextWindow: 36,
      maxTokens: 6,
    });

    expect(result.some((message) => message.id === "u1")).toBe(true);
    expect(totalTokens(result)).toBeLessThanOrEqual(30);
  });

  it("在最新用户消息单条超预算时会裁剪到预算内", () => {
    const messages = [
      { role: "system", content: "System prompt." },
      { role: "assistant", content: "Short reply." },
      { role: "user", content: "B".repeat(240) },
    ];

    const result = applyContextWindowToMessages(messages, {
      contextWindow: 60,
      maxTokens: 20,
    });

    expect(totalTokens(result)).toBeLessThanOrEqual(40);
    expect(result[result.length - 1]?.role).toBe("user");
    expect(result[result.length - 1]?.content.length).toBeLessThan(messages[2].content.length);
  });
});
