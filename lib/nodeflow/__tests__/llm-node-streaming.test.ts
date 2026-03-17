import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockState,
  MockChatOpenAI,
  convertForClaudeMock,
  invokeScriptToolMock,
} = vi.hoisted(() => {
  const state = {
    aiMessage: {
      content: "",
      tool_calls: [] as Array<{ id?: string; name: string; args: unknown }>,
    },
    streamChunks: [] as Array<Record<string, unknown>>,
  };

  class ChatOpenAIMock {
    constructor(_config: unknown) {}

    bindTools(_tools: unknown, _options: unknown) {
      return {
        invoke: async (_messages: unknown) => state.aiMessage,
      };
    }

    async invoke(_messages: unknown) {
      return state.aiMessage;
    }

    async *stream(_messages: unknown) {
      for (const chunk of state.streamChunks) {
        yield chunk;
      }
    }
  }

  return {
    mockState: state,
    MockChatOpenAI: ChatOpenAIMock,
    convertForClaudeMock: vi.fn(),
    invokeScriptToolMock: vi.fn(),
  };
});

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: MockChatOpenAI,
}));

vi.mock("@langchain/ollama", () => ({
  ChatOllama: class {},
}));

vi.mock("@/lib/core/gemini-client", () => ({
  createGeminiRunnable: vi.fn(),
}));

vi.mock("@/lib/core/prompt/converters", async () => {
  const actual = await vi.importActual<typeof import("@/lib/core/prompt/converters")>("@/lib/core/prompt/converters");
  return {
    ...actual,
    convertForClaude: (...args: unknown[]) => convertForClaudeMock(...args),
  };
});

vi.mock("@/hooks/script-bridge", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/script-bridge")>("@/hooks/script-bridge");
  return {
    ...actual,
    invokeScriptTool: (...args: unknown[]) => invokeScriptToolMock(...args),
  };
});

import { LLMNodeTools } from "@/lib/nodeflow/LLMNode/LLMNodeTools";

describe("LLMNodeTools.invokeLLMStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.aiMessage = {
      content: "",
      tool_calls: [],
    };
    mockState.streamChunks = [];
    delete window.lastTokenUsage;
  });

  it("does not depend on Claude conversion for OpenAI streaming", async () => {
    convertForClaudeMock.mockImplementation(() => {
      throw new Error("openai streaming should not use Claude conversion");
    });
    mockState.streamChunks = [
      { content: "Hello" },
    ];

    await expect(
      LLMNodeTools.invokeLLMStream(
        {
          modelName: "mock-model",
          apiKey: "mock-key",
          llmType: "openai",
          messages: [
            { role: "system", content: "sys-1" },
            { role: "system", content: "sys-2" },
            { role: "user", content: "hello" },
          ],
        },
        {},
      ),
    ).resolves.toBe("Hello");

    expect(convertForClaudeMock).not.toHaveBeenCalled();
  });

  it("preserves script tool execution when streaming is enabled", async () => {
    invokeScriptToolMock.mockResolvedValue({ echoed: "hello" });
    mockState.aiMessage = {
      content: "base-response",
      tool_calls: [
        {
          id: "tc1",
          name: "tool_echo",
          args: { input: "hello" },
        },
      ],
    };
    const onToken = vi.fn();

    const result = await LLMNodeTools.invokeLLMStream(
      {
        modelName: "mock-model",
        apiKey: "mock-key",
        llmType: "openai",
        messages: [{ role: "user", content: "say hi" }],
        scriptTools: [
          {
            type: "function",
            function: {
              name: "tool_echo",
              description: "echo",
              parameters: { type: "object", properties: {} },
            },
          },
        ],
      },
      { onToken },
    );

    expect(result).toContain("base-response");
    expect(result).toContain("[tool:tool_echo]");
    expect(result).toContain("hello");
    expect(onToken).toHaveBeenCalled();
  });

  it("emits tool call callbacks when buffered tool execution is used", async () => {
    invokeScriptToolMock.mockResolvedValue({ echoed: "hello" });
    mockState.aiMessage = {
      content: "base-response",
      tool_calls: [
        {
          id: "tc1",
          name: "tool_echo",
          args: { input: "hello" },
        },
      ],
    };
    const onToolCallStart = vi.fn();
    const onToolCallResult = vi.fn();

    await expect(
      LLMNodeTools.invokeLLMStream(
        {
          modelName: "mock-model",
          apiKey: "mock-key",
          llmType: "openai",
          mvuToolEnabled: true,
          messages: [{ role: "user", content: "say hi" }],
          scriptTools: [
            {
              type: "function",
              function: {
                name: "tool_echo",
                description: "echo",
                parameters: { type: "object", properties: {} },
              },
            },
          ],
        },
        { onToolCallStart, onToolCallResult },
      ),
    ).resolves.toContain("[tool:tool_echo]");

    expect(onToolCallStart).toHaveBeenCalledWith("tool_echo");
    expect(onToolCallResult).toHaveBeenCalledWith(
      "tool_echo",
      expect.stringContaining("hello"),
    );
  });

  it("falls back to buffered tool execution for Claude and emits tool callbacks", async () => {
    convertForClaudeMock.mockReturnValue({
      messages: [{ role: "user", content: "hello" }],
      systemPrompt: [],
    });
    invokeScriptToolMock.mockResolvedValue({ echoed: "hello" });
    mockState.aiMessage = {
      content: "base-response",
      tool_calls: [
        {
          id: "tc1",
          name: "tool_echo",
          args: { input: "hello" },
        },
      ],
    };
    const onToolCallStart = vi.fn();
    const onToolCallResult = vi.fn();

    await expect(
      LLMNodeTools.invokeLLMStream(
        {
          modelName: "mock-model",
          apiKey: "mock-key",
          llmType: "claude",
          messages: [{ role: "user", content: "say hi" }],
          scriptTools: [
            {
              type: "function",
              function: {
                name: "tool_echo",
                description: "echo",
                parameters: { type: "object", properties: {} },
              },
            },
          ],
        },
        { onToolCallStart, onToolCallResult },
      ),
    ).resolves.toContain("[tool:tool_echo]");

    expect(onToolCallStart).toHaveBeenCalledWith("tool_echo");
    expect(onToolCallResult).toHaveBeenCalledWith(
      "tool_echo",
      expect.stringContaining("hello"),
    );
  });

  it("keeps token streaming when script tools are registered but unused", async () => {
    mockState.streamChunks = [
      { content: "He" },
      { content: "llo" },
    ];
    const onToken = vi.fn();

    const result = await LLMNodeTools.invokeLLMStream(
      {
        modelName: "mock-model",
        apiKey: "mock-key",
        llmType: "openai",
        messages: [{ role: "user", content: "say hi" }],
        scriptTools: [
          {
            type: "function",
            function: {
              name: "tool_echo",
              description: "echo",
              parameters: { type: "object", properties: {} },
            },
          },
        ],
      },
      { onToken },
    );

    expect(result).toBe("Hello");
    expect(onToken).toHaveBeenCalledTimes(2);
    expect(onToken).toHaveBeenNthCalledWith(1, "He");
    expect(onToken).toHaveBeenNthCalledWith(2, "llo");
  });

  it("publishes token usage from OpenAI streaming chunks", async () => {
    const eventHandler = vi.fn();
    window.addEventListener("llm-token-usage", eventHandler);
    mockState.streamChunks = [
      { content: "He" },
      {
        content: "llo",
        usage_metadata: {
          input_tokens: 7,
          output_tokens: 3,
          total_tokens: 10,
        },
      },
    ];

    try {
      await expect(
        LLMNodeTools.invokeLLMStream(
          {
            modelName: "mock-model",
            apiKey: "mock-key",
            llmType: "openai",
            streaming: true,
            streamUsage: true,
            messages: [{ role: "user", content: "hello" }],
          },
          {},
        ),
      ).resolves.toBe("Hello");

      expect(window.lastTokenUsage).toEqual({
        prompt_tokens: 7,
        completion_tokens: 3,
        total_tokens: 10,
      });
      expect(eventHandler).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("llm-token-usage", eventHandler);
    }
  });
});
