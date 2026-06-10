import type { DialogueRuntimeParams } from "./dialogue-runtime-params";
import type { PreparedDialogueExecution } from "@/lib/generation-runtime/types";
import { saveStorySession, loadStoryRuntimeBinding } from "@/lib/story-agent/session";
import { prepareStoryTurn } from "@/lib/story-agent/runtime/story-session";
import { ingestStoryMemory } from "@/lib/story-agent/memory";
import { getVectorMemoryManager } from "@/lib/vector-memory/manager";

export async function prepareDialogueExecution(
  params: DialogueRuntimeParams,
): Promise<PreparedDialogueExecution> {
  const dialogueId = params.dialogueKey ?? params.characterId;
  const { blueprint, session } = await loadStoryRuntimeBinding(dialogueId);
  const vectorizeMemory =
    blueprint.memoryPolicy?.status === "active" && blueprint.memoryPolicy.vectorizeMemory === true;
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
      maxTokens: params.maxTokens,
      responseLength: params.number,
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
      username: params.username,
    },
    openingMessage: params.openingMessage,
    // 持久化 session 后，opt-in 地把收敛出的 Facts/Relationships best-effort 写入向量记忆供检索。
    // 显式组合在 commit 边界（非 runtime finalize 里的隐藏 fire-and-forget）；默认关，避免每轮 embedding 开销。
    commitSession: async (next) => {
      await saveStorySession(next);
      if (vectorizeMemory) {
        await ingestStoryMemory(getVectorMemoryManager(), dialogueId, next.memory);
      }
    },
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
