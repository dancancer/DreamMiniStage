/**
 * @input  lib/streaming, lib/generation-runtime/dialogue-turn, ./chat-shared
 * @output handleStreamingResponse
 * @pos    对话流式响应 - buffered chunked delivery SSE 封装；持有 Dialogue Turn 持久化适配器
 */

import { createSSEResponse } from "@/lib/streaming";
import { createErrorEvent } from "@/lib/generation-runtime/events";
import {
  runPreparedDialogueTurn,
  type DialogueTurnPersister,
} from "@/lib/generation-runtime/dialogue-turn";
import { createBufferedSink } from "@/lib/generation-runtime/sinks/create-buffered-sink";
import { createSseSink } from "@/lib/generation-runtime/sinks/create-sse-sink";
import type { PreparedDialogueExecution } from "@/lib/generation-runtime/types";
import { processPostResponseAsync } from "./chat-shared";

// Dialogue Turn 完成后的持久化适配器。store 写入留在 server-action 层（本层），
// runtime（dialogue-turn）只调用注入的端口，不反向依赖 function/dialogue。
// 沿用 fire-and-forget 语义，不阻塞响应。
const dialogueTurnPersister: DialogueTurnPersister = (input, result) => {
  Promise.resolve(
    processPostResponseAsync({
      dialogueId: input.dialogueId,
      message: input.originalMessage,
      thinkingContent: result.thinkingContent,
      fullResponse: result.fullResponse,
      screenContent: result.screenContent,
      event: result.event ?? "",
      nextPrompts: result.parsedContent?.nextPrompts ?? [],
      nodeId: input.nodeId,
    }),
  ).catch((error) => console.error("Post-processing error:", error));
};

export interface StreamingParams {
  dialogueId: string;
  originalMessage: string;
  nodeId: string;
  preparedExecution: PreparedDialogueExecution;
}

export interface PreparedDialogueResponseParams extends StreamingParams {
  streaming?: boolean;
}

function createBufferedJsonResponse(
  result: ReturnType<ReturnType<typeof createBufferedSink>["getResult"]>,
): Response {
  if (!result) {
    throw new Error("No response returned from story runtime");
  }

  return new Response(JSON.stringify(result), {
    status: result.type === "error" ? 500 : 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function createBufferedResponse(
  params: StreamingParams,
): Promise<Response> {
  const sink = createBufferedSink();

  await runPreparedDialogueTurn({
    dialogueId: params.dialogueId,
    originalMessage: params.originalMessage,
    nodeId: params.nodeId,
    preparedExecution: params.preparedExecution,
  }, sink, dialogueTurnPersister);

  return createBufferedJsonResponse(sink.getResult());
}

export async function handleStreamingResponse(params: StreamingParams): Promise<Response> {
  const { dialogueId, originalMessage, nodeId, preparedExecution } = params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await runPreparedDialogueTurn({
          dialogueId,
          originalMessage,
          nodeId,
          preparedExecution,
        }, createSseSink({
          controller,
          encoder,
        }), dialogueTurnPersister);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Streaming error:", error);
        const sink = createSseSink({ controller, encoder });
        await sink.emit(createErrorEvent(errorMessage));
      }
    },
  });

  return createSSEResponse(stream);
}

export async function handlePreparedDialogueResponse(
  params: PreparedDialogueResponseParams,
): Promise<Response> {
  if (params.streaming) {
    return handleStreamingResponse(params);
  }

  return createBufferedResponse(params);
}
