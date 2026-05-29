import type { DialogueRuntimeParams } from "./dialogue-runtime-params";
import type { PreparedDialogueExecution } from "@/lib/generation-runtime/types";
import { saveStorySession, loadStoryRuntimeBinding } from "@/lib/story-agent/session";
import { prepareStoryTurn } from "@/lib/story-agent/runtime/story-session";

export async function prepareDialogueExecution(
  params: DialogueRuntimeParams,
): Promise<PreparedDialogueExecution> {
  const dialogueId = params.dialogueKey ?? params.characterId;
  const { blueprint, session } = await loadStoryRuntimeBinding(dialogueId);
  const turn = prepareStoryTurn({
    blueprint,
    session,
    userInput: params.userInput,
    model: {
      modelName: params.modelName,
      apiKey: params.apiKey,
      baseUrl: params.baseUrl,
      llmType: params.llmType,
      temperature: params.temperature,
      contextWindow: params.contextWindow,
      maxTokens: params.maxTokens ?? params.number,
      timeout: params.timeout,
      maxRetries: params.maxRetries,
      topP: params.topP,
      frequencyPenalty: params.frequencyPenalty,
      presencePenalty: params.presencePenalty,
      topK: params.topK,
      repeatPenalty: params.repeatPenalty,
      streaming: params.streaming,
      streamUsage: params.streamUsage,
      language: params.language,
    },
    commitSession: saveStorySession,
  });

  return {
    runtime: "story",
    context: turn,
    llmConfig: turn.llmConfig,
    postprocessNodeId: "story-runtime",
    metadata: {
      characterId: params.characterId,
      dialogueKey: params.dialogueKey,
      runtime: "story",
    },
  };
}
