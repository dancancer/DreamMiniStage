import { afterEach, describe, expect, it, vi } from "vitest";
import { createBufferedSink } from "@/lib/generation-runtime/sinks/create-buffered-sink";
import { runDialogueGeneration } from "@/lib/generation-runtime/run-dialogue-generation";
import { LLMNodeTools } from "@/lib/nodeflow/LLMNode/LLMNodeTools";
import { finalizeDialogueResult } from "@/lib/generation-runtime/postprocess/finalize-dialogue-result";
import * as chatShared from "@/function/dialogue/chat-shared";

vi.mock("@/function/dialogue/chat-shared", async () => {
  const actual = await vi.importActual<typeof import("@/function/dialogue/chat-shared")>("@/function/dialogue/chat-shared");
  return {
    ...actual,
    processPostResponseAsync: vi.fn().mockResolvedValue(undefined),
  };
});

describe("runDialogueGeneration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("feeds a buffered sink from the prepared execution plan", async () => {
    vi.spyOn(LLMNodeTools, "invokeLLMStream").mockImplementation(
      async (_config, callbacks) => {
        callbacks.onReasoning?.("step-1");
        callbacks.onToken?.("He");
        callbacks.onToken?.("llo");
        return "Hello";
      },
    );
    vi.spyOn(
      await import("@/lib/generation-runtime/postprocess/finalize-dialogue-result"),
      "finalizeDialogueResult",
    ).mockResolvedValue({
      screenContent: "Visible reply",
      fullResponse: "Hello",
      thinkingContent: "step-1",
      parsedContent: { nextPrompts: ["next"] },
      event: "",
      isPostProcessed: true,
    });

    const sink = createBufferedSink();
    await runDialogueGeneration({
      dialogueId: "dialogue-1",
      originalMessage: "hi",
      nodeId: "node-1",
      preparedExecution: {
        context: {} as never,
        llmConfig: {},
      },
    }, sink);

    expect(sink.getResult()).toEqual({
      type: "complete",
      success: true,
      thinkingContent: "step-1",
      content: "Visible reply",
      parsedContent: { nextPrompts: ["next"] },
      isRegexProcessed: true,
    });
    expect(vi.mocked(chatShared.processPostResponseAsync)).toHaveBeenCalledWith(expect.objectContaining({
      screenContent: "Visible reply",
      fullResponse: "Hello",
    }));
  });

  it("falls back to streamed content when finalization fails after tokens", async () => {
    vi.spyOn(LLMNodeTools, "invokeLLMStream").mockImplementation(
      async (_config, callbacks) => {
        callbacks.onToken?.("He");
        callbacks.onToken?.("llo");
        return "Hello";
      },
    );
    vi.spyOn(
      await import("@/lib/generation-runtime/postprocess/finalize-dialogue-result"),
      "finalizeDialogueResult",
    ).mockRejectedValue(new Error("regex crashed"));

    const sink = createBufferedSink();
    await runDialogueGeneration({
      dialogueId: "dialogue-1",
      originalMessage: "hi",
      nodeId: "node-1",
      preparedExecution: {
        context: {} as never,
        llmConfig: {},
      },
    }, sink);

    expect(sink.getResult()).toEqual({
      type: "complete",
      success: true,
      thinkingContent: "",
      content: "Hello",
      parsedContent: { nextPrompts: [] },
      isRegexProcessed: false,
    });
  });

  it("emits content, reasoning, postprocess, then complete in order", async () => {
    vi.spyOn(LLMNodeTools, "invokeLLMStream").mockImplementation(
      async (_config, callbacks) => {
        callbacks.onReasoning?.("step-1");
        callbacks.onToken?.("He");
        callbacks.onToken?.("llo");
        return "Hello";
      },
    );
    vi.spyOn(
      await import("@/lib/generation-runtime/postprocess/finalize-dialogue-result"),
      "finalizeDialogueResult",
    ).mockResolvedValue({
      screenContent: "Hello",
      fullResponse: "Hello",
      thinkingContent: "step-1",
      parsedContent: { nextPrompts: [] },
      event: "",
      isPostProcessed: true,
    });

    const eventTypes: string[] = [];
    await runDialogueGeneration({
      dialogueId: "dialogue-1",
      originalMessage: "hi",
      nodeId: "node-1",
      preparedExecution: {
        context: {} as never,
        llmConfig: {} as never,
      },
    }, {
      emit: async (event) => {
        eventTypes.push(event.type);
      },
    });

    expect(eventTypes).toEqual([
      "reasoning-delta",
      "content-delta",
      "content-delta",
      "postprocess-start",
      "complete",
    ]);
  });

  it("emits tool-call lifecycle events before completion", async () => {
    vi.spyOn(LLMNodeTools, "invokeLLMStream").mockImplementation(
      async (_config, callbacks) => {
        callbacks.onToolCallStart?.("tool_echo");
        callbacks.onToolCallResult?.("tool_echo", "{\"ok\":true}");
        callbacks.onToken?.("Hello");
        return "Hello";
      },
    );
    vi.spyOn(
      await import("@/lib/generation-runtime/postprocess/finalize-dialogue-result"),
      "finalizeDialogueResult",
    ).mockResolvedValue({
      screenContent: "Hello",
      fullResponse: "Hello",
      thinkingContent: "",
      parsedContent: { nextPrompts: [] },
      event: "",
      isPostProcessed: true,
    });

    const eventTypes: string[] = [];
    await runDialogueGeneration({
      dialogueId: "dialogue-1",
      originalMessage: "hi",
      nodeId: "node-1",
      preparedExecution: {
        context: {} as never,
        llmConfig: {} as never,
      },
    }, {
      emit: async (event) => {
        eventTypes.push(event.type);
      },
    });

    expect(eventTypes).toEqual([
      "tool-call-start",
      "tool-call-result",
      "content-delta",
      "postprocess-start",
      "complete",
    ]);
  });
});
