import { afterEach, describe, expect, it, vi } from "vitest";
import { handleStreamingResponse } from "../chat-streaming";
import { LLMNodeTools } from "@/lib/nodeflow/LLMNode/LLMNodeTools";
import { DialogueWorkflow } from "@/lib/workflow/examples/DialogueWorkflow";
import * as chatShared from "@/function/dialogue/chat-shared";

vi.mock("@/function/dialogue/chat-shared", () => ({
  buildDialogueWorkflowParams: vi.fn((input: unknown) => input),
  isDialogueWorkflowResult: vi.fn(() => true),
  processPostResponseAsync: vi.fn().mockResolvedValue(undefined),
}));

describe("handleStreamingResponse", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("streams real LLM chunks instead of buffering the whole workflow result first", async () => {
    vi.spyOn(DialogueWorkflow.prototype, "finalizeExecution").mockResolvedValue({
      outputData: {
        thinkingContent: "",
        screenContent: "Hello",
        fullResponse: "Hello",
        nextPrompts: [],
        event: "",
      },
    });

    vi.spyOn(LLMNodeTools, "invokeLLMStream").mockImplementation(
      async (_config, callbacks) => {
        callbacks.onToken?.("He");
        callbacks.onToken?.("llo");
        return "Hello";
      },
    );

    const response = await handleStreamingResponse({
      dialogueId: "dialogue-1",
      originalMessage: "hi",
      nodeId: "node-1",
      preparedExecution: {
        context: {} as never,
        llmConfig: {
          modelName: "gpt-test",
          apiKey: "key",
          baseUrl: "https://example.com",
          llmType: "openai",
          messages: [{ role: "user", content: "hi" }],
        } as never,
      },
    });

    const payload = await response.text();

    expect(payload).toContain("\"content\":\"He\"");
    expect(payload).toContain("\"content\":\"llo\"");
    expect(payload).toContain("\"type\":\"complete\"");
    expect(LLMNodeTools.invokeLLMStream).toHaveBeenCalledTimes(1);
  });

  it("keeps SSE chunking when script tools are registered but unused", async () => {
    vi.spyOn(DialogueWorkflow.prototype, "finalizeExecution").mockResolvedValue({
      outputData: {
        thinkingContent: "",
        screenContent: "Hello",
        fullResponse: "Hello",
        nextPrompts: [],
        event: "",
      },
    });

    vi.spyOn(LLMNodeTools, "invokeLLMStream").mockImplementation(
      async (_config, callbacks) => {
        callbacks.onToken?.("He");
        callbacks.onToken?.("llo");
        return "Hello";
      },
    );

    const response = await handleStreamingResponse({
      dialogueId: "dialogue-1",
      originalMessage: "hi",
      nodeId: "node-1",
      preparedExecution: {
        context: {} as never,
        llmConfig: {
          modelName: "gpt-test",
          apiKey: "key",
          baseUrl: "https://example.com",
          llmType: "openai",
          messages: [{ role: "user", content: "hi" }],
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
        } as never,
      },
    });

    const payload = await response.text();

    expect(payload.match(/"type":"content"/g)).toHaveLength(2);
    expect(payload).toContain("\"content\":\"He\"");
    expect(payload).toContain("\"content\":\"llo\"");
  });

  it("persists finalized fullResponse and keeps streamed reasoning when regex output is empty", async () => {
    const postResponseSpy = vi.mocked(chatShared.processPostResponseAsync);

    vi.spyOn(DialogueWorkflow.prototype, "finalizeExecution").mockResolvedValue({
      outputData: {
        thinkingContent: "",
        screenContent: "Visible reply",
        fullResponse: "Sanitized final response",
        nextPrompts: ["next"],
        event: "",
      },
    });

    vi.spyOn(LLMNodeTools, "invokeLLMStream").mockImplementation(
      async (_config, callbacks) => {
        callbacks.onReasoning?.("step-1 ");
        callbacks.onReasoning?.("step-2");
        callbacks.onToken?.("Visible ");
        callbacks.onToken?.("reply");
        return "<think>raw</think> Visible reply";
      },
    );

    const response = await handleStreamingResponse({
      dialogueId: "dialogue-1",
      originalMessage: "hi",
      nodeId: "node-1",
      preparedExecution: {
        context: {} as never,
        llmConfig: {
          modelName: "gpt-test",
          apiKey: "key",
          baseUrl: "https://example.com",
          llmType: "openai",
          messages: [{ role: "user", content: "hi" }],
        } as never,
      },
    });

    const payload = await response.text();

    expect(payload).toContain("\"thinkingContent\":\"step-1 step-2\"");
    expect(postResponseSpy).toHaveBeenCalledWith(expect.objectContaining({
      fullResponse: "Sanitized final response",
      thinkingContent: "step-1 step-2",
      screenContent: "Visible reply",
    }));
  });

  it("falls back to streamed content when post-processing fails after tokens were emitted", async () => {
    const postResponseSpy = vi.mocked(chatShared.processPostResponseAsync);

    vi.spyOn(DialogueWorkflow.prototype, "finalizeExecution").mockRejectedValue(
      new Error("regex crashed"),
    );

    vi.spyOn(LLMNodeTools, "invokeLLMStream").mockImplementation(
      async (_config, callbacks) => {
        callbacks.onReasoning?.("step-1");
        callbacks.onToken?.("Visible ");
        callbacks.onToken?.("reply");
        return "Visible reply";
      },
    );

    const response = await handleStreamingResponse({
      dialogueId: "dialogue-1",
      originalMessage: "hi",
      nodeId: "node-1",
      preparedExecution: {
        context: {} as never,
        llmConfig: {
          modelName: "gpt-test",
          apiKey: "key",
          baseUrl: "https://example.com",
          llmType: "openai",
          messages: [{ role: "user", content: "hi" }],
        } as never,
      },
    });

    const payload = await response.text();

    expect(payload).toContain("\"type\":\"complete\"");
    expect(payload).not.toContain("\"type\":\"error\"");
    expect(payload).toContain("\"content\":\"Visible reply\"");
    expect(postResponseSpy).toHaveBeenCalledWith(expect.objectContaining({
      fullResponse: "Visible reply",
      thinkingContent: "step-1",
      screenContent: "Visible reply",
    }));
  });
});
