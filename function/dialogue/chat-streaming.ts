/**
 * @input  function/dialogue/chat-shared, lib/streaming, lib/generation-runtime
 * @output handleStreamingResponse
 * @pos    对话流式响应 - buffered chunked delivery SSE 封装
 */

import { createSSEResponse } from "@/lib/streaming";
import { createErrorEvent } from "@/lib/generation-runtime/events";
import { runDialogueGeneration } from "@/lib/generation-runtime/run-dialogue-generation";
import { createBufferedSink } from "@/lib/generation-runtime/sinks/create-buffered-sink";
import { createSseSink } from "@/lib/generation-runtime/sinks/create-sse-sink";
import type { PreparedDialogueExecution } from "@/lib/generation-runtime/types";

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
    throw new Error("No response returned from workflow");
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

  await runDialogueGeneration({
    dialogueId: params.dialogueId,
    originalMessage: params.originalMessage,
    nodeId: params.nodeId,
    preparedExecution: params.preparedExecution,
  }, sink);

  return createBufferedJsonResponse(sink.getResult());
}

export async function handleStreamingResponse(params: StreamingParams): Promise<Response> {
  const { dialogueId, originalMessage, nodeId, preparedExecution } = params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await runDialogueGeneration({
          dialogueId,
          originalMessage,
          nodeId,
          preparedExecution,
        }, createSseSink({
          controller,
          encoder,
        }));
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
