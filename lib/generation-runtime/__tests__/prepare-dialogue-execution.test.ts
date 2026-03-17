import { describe, expect, it, vi } from "vitest";
import { DialogueWorkflow } from "@/lib/workflow/examples/DialogueWorkflow";
import { prepareDialogueExecution } from "@/lib/generation-runtime/prepare/prepare-dialogue-execution";
import { finalizeDialogueResult } from "@/lib/generation-runtime/postprocess/finalize-dialogue-result";

describe("prepareDialogueExecution", () => {
  it("returns a reusable prepared execution plan before model invocation", async () => {
    vi.spyOn(DialogueWorkflow.prototype, "prepareExecution").mockResolvedValue({
      context: { id: "ctx-1" } as never,
      llmInput: {
        modelName: "gpt-test",
        apiKey: "key",
        llmType: "openai",
        messages: [{ role: "user", content: "hello" }],
      },
    });

    const prepared = await prepareDialogueExecution({
      characterId: "char-1",
      userInput: "hello",
      modelName: "gpt-test",
      apiKey: "key",
    });

    expect(prepared.context).toEqual({ id: "ctx-1" });
    expect(prepared.llmConfig.messages).toHaveLength(1);
    expect(prepared.postprocessNodeId).toBe("regex-1");
  });
});

describe("finalizeDialogueResult", () => {
  it("normalizes the finalized workflow payload into the runtime result shape", async () => {
    vi.spyOn(DialogueWorkflow.prototype, "finalizeExecution").mockResolvedValue({
      outputData: {
        screenContent: "Visible reply",
        fullResponse: "Full reply",
        thinkingContent: "Reasoning",
        nextPrompts: ["next"],
        event: "done",
      },
    });

    const result = await finalizeDialogueResult({ id: "ctx-1" } as never, "Full reply");

    expect(result).toEqual({
      screenContent: "Visible reply",
      fullResponse: "Full reply",
      thinkingContent: "Reasoning",
      parsedContent: { nextPrompts: ["next"] },
      event: "done",
      isPostProcessed: true,
    });
  });
});
