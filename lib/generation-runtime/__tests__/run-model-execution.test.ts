import { afterEach, describe, expect, it, vi } from "vitest";
import { LLMNodeTools } from "@/lib/nodeflow/LLMNode/LLMNodeTools";
import { runModelExecution } from "@/lib/generation-runtime/model/run-model-execution";

describe("runModelExecution", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits reasoning, tool, and content events while returning accumulated outputs", async () => {
    vi.spyOn(LLMNodeTools, "invokeLLMStream").mockImplementation(
      async (_config, callbacks) => {
        callbacks.onReasoning?.("step-1");
        callbacks.onToolCallStart?.("tool_echo");
        callbacks.onToolCallResult?.("tool_echo", "{\"ok\":true}");
        callbacks.onToken?.("He");
        callbacks.onToken?.("llo");
        return "Hello";
      },
    );

    const eventTypes: string[] = [];
    const result = await runModelExecution({} as never, async (event) => {
      eventTypes.push(event.type);
    });

    expect(result).toEqual({
      fullResponse: "Hello",
      streamedContent: "Hello",
      streamedReasoning: "step-1",
    });
    expect(eventTypes).toEqual([
      "reasoning-delta",
      "tool-call-start",
      "tool-call-result",
      "content-delta",
      "content-delta",
    ]);
  });
});
