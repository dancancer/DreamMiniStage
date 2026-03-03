/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║               LLMNode Script Tool Calls Regression                        ║
 * ║                                                                           ║
 * ║  覆盖 registerFunctionTool -> tool_calls -> 回调执行 -> 结果回传链路         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearIframeFunctionTools,
  extensionHandlers,
  handleFunctionToolResult,
  registerIframeDispatcher,
  unregisterIframeDispatcher,
} from "@/hooks/script-bridge/extension-handlers";
import type { ApiCallContext } from "@/hooks/script-bridge/types";

const { mockState, MockChatOpenAI } = vi.hoisted(() => {
  const state = {
    aiMessage: {
      content: "",
      tool_calls: [] as Array<{ id?: string; name: string; args: unknown }>,
    },
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
  }

  return {
    mockState: state,
    MockChatOpenAI: ChatOpenAIMock,
  };
});

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: MockChatOpenAI,
}));

import { LLMNodeTools } from "@/lib/nodeflow/LLMNode/LLMNodeTools";

function createApiContext(iframeId: string): ApiCallContext {
  return {
    iframeId,
    characterId: "char-llm-tool",
    dialogueId: "dialogue-llm-tool",
    chatId: "dialogue-llm-tool",
    messages: [],
    setScriptVariable: vi.fn(),
    deleteScriptVariable: vi.fn(),
    getVariablesSnapshot: () => ({
      global: {},
      character: {},
    }),
  };
}

describe("llm node script tool calls", () => {
  beforeEach(() => {
    mockState.aiMessage = {
      content: "",
      tool_calls: [],
    };
    clearIframeFunctionTools("iframe_llm_tool");
    unregisterIframeDispatcher("iframe_llm_tool");
  });

  it("bridges model tool_calls back to registered iframe callback", async () => {
    const iframeId = "iframe_llm_tool";
    const toolName = "tool_echo";

    registerIframeDispatcher(iframeId, (_type, payload) => {
      const callbackPayload = payload as {
        callbackId: string;
        args: Record<string, unknown>;
      };
      handleFunctionToolResult(callbackPayload.callbackId, {
        echoed: callbackPayload.args.input,
      });
    });

    expect(extensionHandlers.registerFunctionTool([
      toolName,
      "echo tool",
      { type: "object", properties: {} },
      false,
      iframeId,
    ], createApiContext(iframeId))).toBe(true);

    mockState.aiMessage = {
      content: "base-response",
      tool_calls: [
        {
          id: "tc1",
          name: toolName,
          args: { input: "hello" },
        },
      ],
    };

    const result = await LLMNodeTools.invokeLLM({
      modelName: "mock-model",
      apiKey: "mock-key",
      llmType: "openai",
      messages: [{ role: "user", content: "say hi" }],
      scriptTools: [
        {
          type: "function",
          function: {
            name: toolName,
            description: "echo",
            parameters: { type: "object", properties: {} },
          },
        },
      ],
    });

    expect(result).toContain("base-response");
    expect(result).toContain("[tool:tool_echo]");
    expect(result).toContain("hello");

    clearIframeFunctionTools(iframeId);
    unregisterIframeDispatcher(iframeId);
  });

  it("fails fast when tool call arguments are invalid json", async () => {
    const toolName = "tool_echo";

    mockState.aiMessage = {
      content: "",
      tool_calls: [
        {
          id: "tc2",
          name: toolName,
          args: "{invalid-json}",
        },
      ],
    };

    await expect(
      LLMNodeTools.invokeLLM({
        modelName: "mock-model",
        apiKey: "mock-key",
        llmType: "openai",
        messages: [{ role: "user", content: "trigger" }],
        scriptTools: [
          {
            type: "function",
            function: {
              name: toolName,
              description: "echo",
              parameters: { type: "object", properties: {} },
            },
          },
        ],
      }),
    ).rejects.toThrow("arguments 解析失败");
  });
});
