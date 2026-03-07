import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createApiClient: vi.fn(),
  callGeminiOnce: vi.fn(),
  getModelState: vi.fn(),
}));

vi.mock("@/lib/api/backends", () => ({
  createApiClient: mocks.createApiClient,
}));

vi.mock("@/lib/core/gemini-client", () => ({
  callGeminiOnce: mocks.callGeminiOnce,
}));

vi.mock("@/lib/store/model-store", () => ({
  useModelStore: {
    getState: mocks.getModelState,
  },
}));

import {
  createSessionDefaultHostBridge,
  SESSION_DEFAULT_TRANSLATE_PROVIDER,
} from "../session-host-defaults";

function buildOpenAIConfig() {
  return {
    id: "cfg-default",
    name: "Default",
    type: "openai" as const,
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    apiKey: "sk-default",
  };
}

describe("session-host-defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createApiClient.mockReturnValue({
      chat: vi.fn().mockResolvedValue({
        content: "translated text",
      }),
    });
    mocks.callGeminiOnce.mockResolvedValue("gemini translated text");
    mocks.getModelState.mockReturnValue({
      activeConfigId: "cfg-default",
      configs: [buildOpenAIConfig()],
      getActiveConfig: () => buildOpenAIConfig(),
    });
  });

  it("translates with the active model when provider is omitted", async () => {
    const bridge = createSessionDefaultHostBridge({ language: "en" });
    const result = await bridge.translateText?.("hello world");

    expect(result).toBe("translated text");
    expect(mocks.createApiClient).toHaveBeenCalledWith({
      type: "openai",
      apiKey: "sk-default",
      apiUrl: "https://api.openai.com/v1",
    });

    const client = mocks.createApiClient.mock.results[0]?.value;
    expect(client.chat).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-4o-mini",
      messages: [
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("translation engine"),
        }),
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("Target language: en"),
        }),
      ],
    }));
  });

  it("accepts the built-in provider alias and forwards the explicit target", async () => {
    const bridge = createSessionDefaultHostBridge({ language: "en" });

    await bridge.translateText?.("hello world", {
      provider: SESSION_DEFAULT_TRANSLATE_PROVIDER,
      target: "ja",
    });

    const client = mocks.createApiClient.mock.results[0]?.value;
    expect(client.chat).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        expect.anything(),
        expect.objectContaining({
          content: expect.stringContaining("Target language: ja"),
        }),
      ],
    }));
  });

  it("fails fast for unknown translate providers", async () => {
    const bridge = createSessionDefaultHostBridge({ language: "en" });

    await expect(bridge.translateText?.("hello world", {
      provider: "mocker",
    })).rejects.toThrow("/translate provider not available in /session default host: mocker");
  });

  it("uses gemini for gemini presets", async () => {
    mocks.getModelState.mockReturnValue({
      activeConfigId: "cfg-gemini",
      configs: [{
        id: "cfg-gemini",
        name: "Gemini",
        type: "gemini",
        baseUrl: "https://generativelanguage.googleapis.com",
        model: "gemini-1.5-flash",
        apiKey: "gemini-key",
      }],
      getActiveConfig: () => ({
        id: "cfg-gemini",
        name: "Gemini",
        type: "gemini",
        baseUrl: "https://generativelanguage.googleapis.com",
        model: "gemini-1.5-flash",
        apiKey: "gemini-key",
      }),
    });

    const bridge = createSessionDefaultHostBridge({ language: "zh" });
    const result = await bridge.translateText?.("hello world");

    expect(result).toBe("gemini translated text");
    expect(mocks.callGeminiOnce).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.stringContaining("translation engine"),
      user: expect.stringContaining("Target language: zh"),
      config: expect.objectContaining({
        apiKey: "gemini-key",
        model: "gemini-1.5-flash",
      }),
    }));
    expect(mocks.createApiClient).not.toHaveBeenCalled();
  });
});
