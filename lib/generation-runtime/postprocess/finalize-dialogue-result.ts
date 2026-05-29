import type { FinalizedDialogueResult } from "@/lib/generation-runtime/types";
import { finalizeStoryTurn, isStoryPreparedTurn } from "@/lib/story-agent/runtime/story-session";

export async function finalizeDialogueResult(
  context: unknown,
  llmResponse: string,
): Promise<FinalizedDialogueResult> {
  if (!isStoryPreparedTurn(context)) {
    throw new Error("Story runtime context is required for dialogue finalization");
  }
  return finalizeStoryTurn(context, llmResponse);
}
