import { beforeEach, describe, expect, it, vi } from "vitest";
import { MVU_VARIABLE_UPDATE_FUNCTION } from "@/lib/mvu/function-call";

const createGeminiRunnable = vi.fn();
const convertForGoogle = vi.fn();
const getGenerativeModel = vi.fn();
const generateContent = vi.fn();

vi.mock("@/lib/core/gemini-client", () => ({
  createGeminiRunnable: (...args: unknown[]) => createGeminiRunnable(...args),
}));

vi.mock("@/lib/core/prompt/converters", async () => {
  const actual = await vi.importActual<typeof import("@/lib/core/prompt/converters")>("@/lib/core/prompt/converters");
  return {
    ...actual,
    convertForGoogle: (...args: unknown[]) => convertForGoogle(...args),
  };
});

vi.mock("@google/generative-ai", async () => {
  const actual = await vi.importActual<typeof import("@google/generative-ai")>("@google/generative-ai");
  return {
    ...actual,
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: (...args: unknown[]) => getGenerativeModel(...args),
    })),
  };
});

import { invokeGeminiModel } from "@/lib/nodeflow/LLMNode/model-invokers";

describe("invokeGeminiModel", () => {
  beforeEach(() => {
    createGeminiRunnable.mockReset();
    convertForGoogle.mockReset();
    getGenerativeModel.mockReset();
    generateContent.mockReset();

    convertForGoogle.mockReturnValue({
      contents: [{ role: "user", parts: [{ text: "hello" }] }],
      systemInstruction: { parts: [{ text: "system" }] },
    });
  });

  it("passes stop strings through the standard Gemini path", async () => {
    const invoke = vi.fn().mockResolvedValue("ok");
    createGeminiRunnable.mockReturnValue({ invoke });

    const response = await invokeGeminiModel(
      [{ role: "user", content: "hello" }],
      {
        apiKey: "test-key",
        modelName: "gemini-1.5-flash",
        llmType: "gemini",
        stopStrings: ["END"],
      } as never,
    );

    expect(response).toBe("ok");
    expect(createGeminiRunnable).toHaveBeenCalledWith(expect.objectContaining({
      stopSequences: ["END"],
    }));
  });

  it("passes stop strings through the MVU Gemini path", async () => {
    generateContent.mockResolvedValue({
      response: {
        candidates: [{
          content: {
            parts: [{ text: "ok" }],
          },
        }],
      },
    });
    getGenerativeModel.mockReturnValue({ generateContent });

    const response = await invokeGeminiModel(
      [{ role: "user", content: "hello" }],
      {
        apiKey: "test-key",
        modelName: "gemini-1.5-flash",
        llmType: "gemini",
        stopStrings: ["END"],
        mvuToolEnabled: true,
      } as never,
    );

    expect(response).toBe("ok");
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      generationConfig: expect.objectContaining({
        stopSequences: ["END"],
      }),
    }));
  });

  it("emits tool call callbacks on the MVU Gemini path", async () => {
    generateContent.mockResolvedValue({
      response: {
        candidates: [{
          content: {
            parts: [{
              functionCall: {
                name: MVU_VARIABLE_UPDATE_FUNCTION.name,
                args: {
                  analysis: "ok",
                  delta: "{\"hp\":1}",
                },
              },
            }],
          },
        }],
      },
    });
    getGenerativeModel.mockReturnValue({ generateContent });
    const onToolCallStart = vi.fn();
    const onToolCallResult = vi.fn();

    await invokeGeminiModel(
      [{ role: "user", content: "hello" }],
      {
        apiKey: "test-key",
        modelName: "gemini-1.5-flash",
        llmType: "gemini",
        mvuToolEnabled: true,
      } as never,
      {
        onToolCallStart,
        onToolCallResult,
      },
    );

    expect(onToolCallStart).toHaveBeenCalledWith(MVU_VARIABLE_UPDATE_FUNCTION.name);
    expect(onToolCallResult).toHaveBeenCalledTimes(1);
  });
});
