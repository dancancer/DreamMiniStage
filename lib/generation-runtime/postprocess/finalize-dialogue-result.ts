import { DialogueWorkflow } from "@/lib/workflow/examples/DialogueWorkflow";
import type { FinalizedDialogueResult } from "@/lib/generation-runtime/types";
import type { NodeContext } from "@/lib/nodeflow/NodeContext";

export async function finalizeDialogueResult(
  context: NodeContext,
  llmResponse: string,
): Promise<FinalizedDialogueResult> {
  const workflow = new DialogueWorkflow();
  const finalized = await workflow.finalizeExecution(context, llmResponse);
  const output = finalized.outputData;

  return {
    screenContent: String(output.screenContent ?? ""),
    fullResponse: String(output.fullResponse ?? llmResponse),
    thinkingContent: String(output.thinkingContent ?? ""),
    parsedContent: {
      nextPrompts: Array.isArray(output.nextPrompts)
        ? output.nextPrompts as string[]
        : [],
    },
    event: typeof output.event === "string" ? output.event : "",
    isPostProcessed: true,
  };
}
