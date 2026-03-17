import { DialogueWorkflow, type DialogueWorkflowParams } from "@/lib/workflow/examples/DialogueWorkflow";
import type { PreparedDialogueExecution } from "@/lib/generation-runtime/types";

export async function prepareDialogueExecution(
  params: DialogueWorkflowParams,
): Promise<PreparedDialogueExecution> {
  const workflow = new DialogueWorkflow();
  const prepared = await workflow.prepareExecution(params);

  return {
    context: prepared.context,
    llmConfig: prepared.llmInput,
    postprocessNodeId: "regex-1",
    metadata: {
      characterId: params.characterId,
      dialogueKey: params.dialogueKey,
    },
  };
}
