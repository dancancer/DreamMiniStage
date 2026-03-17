import { processPostResponseAsync } from "@/function/dialogue/chat-shared";
import {
  createCompleteEvent,
  createErrorEvent,
  createPostprocessStartEvent,
} from "@/lib/generation-runtime/events";
import { runModelExecution } from "@/lib/generation-runtime/model/run-model-execution";
import { finalizeDialogueResult } from "@/lib/generation-runtime/postprocess/finalize-dialogue-result";
import type {
  FinalizedDialogueResult,
  GenerationEvent,
  PreparedDialogueExecution,
} from "@/lib/generation-runtime/types";

export interface DialogueGenerationSink {
  emit: (event: GenerationEvent) => void | Promise<void>;
}

interface RunDialogueGenerationInput {
  dialogueId: string;
  originalMessage: string;
  nodeId: string;
  preparedExecution: PreparedDialogueExecution;
}

function pickResolvedThinkingContent(
  finalizedThinkingContent: string,
  streamedReasoning: string,
): string {
  if (finalizedThinkingContent.trim().length > 0) {
    return finalizedThinkingContent;
  }
  return streamedReasoning;
}

function buildFallbackResult(
  streamedContent: string,
  streamedReasoning: string,
  streamedFullResponse: string,
): FinalizedDialogueResult {
  const content = streamedContent || streamedFullResponse;
  return {
    screenContent: content,
    fullResponse: streamedFullResponse || content,
    thinkingContent: streamedReasoning,
    parsedContent: { nextPrompts: [] },
    event: "",
    isPostProcessed: false,
  };
}

export async function runDialogueGeneration(
  input: RunDialogueGenerationInput,
  sink: DialogueGenerationSink,
): Promise<void> {
  const {
    dialogueId,
    originalMessage,
    nodeId,
    preparedExecution,
  } = input;

  let streamedContent = "";
  let streamedReasoning = "";

  try {
    const modelResult = await runModelExecution(
      preparedExecution.llmConfig,
      sink.emit,
    );
    const fullResponse = modelResult.fullResponse;
    streamedContent = modelResult.streamedContent;
    streamedReasoning = modelResult.streamedReasoning;

    let finalizedResult: FinalizedDialogueResult;
    try {
      await sink.emit(createPostprocessStartEvent());
      finalizedResult = await finalizeDialogueResult(
        preparedExecution.context as never,
        fullResponse,
      );
      finalizedResult = {
        ...finalizedResult,
        thinkingContent: pickResolvedThinkingContent(
          finalizedResult.thinkingContent,
          streamedReasoning,
        ),
        fullResponse: finalizedResult.fullResponse || fullResponse,
      };
    } catch (error) {
      if (
        streamedContent.length === 0 &&
        fullResponse.length === 0 &&
        streamedReasoning.length === 0
      ) {
        throw error;
      }
      finalizedResult = buildFallbackResult(
        streamedContent,
        streamedReasoning,
        fullResponse,
      );
      console.error("Streaming finalize error, falling back to streamed content:", error);
    }

    await sink.emit(createCompleteEvent({
      screenContent: finalizedResult.screenContent,
      fullResponse: finalizedResult.fullResponse,
      thinkingContent: finalizedResult.thinkingContent,
      parsedContent: {
        nextPrompts: finalizedResult.parsedContent?.nextPrompts ?? [],
      },
      event: finalizedResult.event ?? "",
      isPostProcessed: finalizedResult.isPostProcessed ?? false,
    }));

    Promise.resolve(processPostResponseAsync({
      dialogueId,
      message: originalMessage,
      thinkingContent: finalizedResult.thinkingContent,
      fullResponse: finalizedResult.fullResponse,
      screenContent: finalizedResult.screenContent,
      event: finalizedResult.event ?? "",
      nextPrompts: finalizedResult.parsedContent?.nextPrompts ?? [],
      nodeId,
    })).catch((error) => console.error("Post-processing error:", error));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Dialogue generation error:", error);
    await sink.emit(createErrorEvent(errorMessage));
  }
}
