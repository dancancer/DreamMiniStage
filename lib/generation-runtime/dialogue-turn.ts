/**
 * @input  function/dialogue/chat-shared, lib/generation-runtime/*
 * @output runPreparedDialogueTurn, DialogueTurnSink
 * @pos    Dialogue Turn 深层运行模块 - 模型执行、Story finalization 与持久化队列
 */

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

export interface DialogueTurnSink {
  emit: (event: GenerationEvent) => void | Promise<void>;
}

export interface RunPreparedDialogueTurnInput {
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

async function finalizeTurnResult(
  preparedExecution: PreparedDialogueExecution,
  fullResponse: string,
  streamedContent: string,
  streamedReasoning: string,
  sink: DialogueTurnSink,
): Promise<FinalizedDialogueResult> {
  try {
    await sink.emit(createPostprocessStartEvent());
    const finalized = await finalizeDialogueResult(
      preparedExecution.context as never,
      fullResponse,
    );
    return {
      ...finalized,
      thinkingContent: pickResolvedThinkingContent(
        finalized.thinkingContent,
        streamedReasoning,
      ),
      fullResponse: finalized.fullResponse || fullResponse,
    };
  } catch (error) {
    if (
      streamedContent.length === 0 &&
      fullResponse.length === 0 &&
      streamedReasoning.length === 0
    ) {
      throw error;
    }

    console.error("Streaming finalize error, falling back to streamed content:", error);
    return buildFallbackResult(
      streamedContent,
      streamedReasoning,
      fullResponse,
    );
  }
}

function queueDialogueTurnPersistence(
  input: RunPreparedDialogueTurnInput,
  finalizedResult: FinalizedDialogueResult,
): void {
  Promise.resolve(processPostResponseAsync({
    dialogueId: input.dialogueId,
    message: input.originalMessage,
    thinkingContent: finalizedResult.thinkingContent,
    fullResponse: finalizedResult.fullResponse,
    screenContent: finalizedResult.screenContent,
    event: finalizedResult.event ?? "",
    nextPrompts: finalizedResult.parsedContent?.nextPrompts ?? [],
    nodeId: input.nodeId,
  })).catch((error) => console.error("Post-processing error:", error));
}

async function emitCompletedTurn(
  sink: DialogueTurnSink,
  finalizedResult: FinalizedDialogueResult,
): Promise<void> {
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
}

export async function runPreparedDialogueTurn(
  input: RunPreparedDialogueTurnInput,
  sink: DialogueTurnSink,
): Promise<void> {
  const { preparedExecution } = input;

  try {
    const modelResult = await runModelExecution(
      preparedExecution.llmConfig,
      sink.emit,
    );
    const finalizedResult = await finalizeTurnResult(
      preparedExecution,
      modelResult.fullResponse,
      modelResult.streamedContent,
      modelResult.streamedReasoning,
      sink,
    );

    await emitCompletedTurn(sink, finalizedResult);
    queueDialogueTurnPersistence(input, finalizedResult);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Dialogue turn error:", error);
    await sink.emit(createErrorEvent(errorMessage));
  }
}
