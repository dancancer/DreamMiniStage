/**
 * @input  function/dialogue/chat-shared, lib/streaming, lib/workflow/examples/DialogueWorkflow
 * @output handleStreamingResponse
 * @pos    对话流式响应 - buffered chunked delivery SSE 封装
 */

import { createSSEResponse, formatSSEData, formatSSEDone } from "@/lib/streaming";
import { DialogueWorkflow } from "@/lib/workflow/examples/DialogueWorkflow";
import type { ModelAdvancedSettings } from "@/lib/model-runtime";
import {
  buildDialogueWorkflowParams,
  isDialogueWorkflowResult,
  processPostResponseAsync,
} from "@/function/dialogue/chat-shared";

const STREAMING_CHUNK_SIZE = 20;
const STREAMING_CHUNK_DELAY_MS = 10;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface StreamingParams {
  dialogueId: string;
  characterId: string;
  message: string;
  originalMessage: string;
  username?: string;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  llmType: "openai" | "ollama" | "gemini";
  language: "zh" | "en";
  number: number;
  fastModel: boolean;
  advanced?: ModelAdvancedSettings;
  promptRuntime: import("@/lib/prompt-config/state").ResolvedPromptRuntimeConfig;
  nodeId: string;
}

export async function handleStreamingResponse(params: StreamingParams): Promise<Response> {
  const { dialogueId, characterId, message, originalMessage, username, modelName, baseUrl, apiKey, llmType, language, number, fastModel, advanced, promptRuntime, nodeId } = params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 当前流式模式为 buffered chunked delivery：
        // 先完整执行 workflow，再按固定块大小通过 SSE 模拟流式输出。
        const workflow = new DialogueWorkflow();
        const workflowResult = await workflow.execute(buildDialogueWorkflowParams({
          dialogueId,
          characterId,
          userInput: message,
          language,
          username,
          modelName,
          apiKey,
          baseUrl,
          llmType,
          advanced,
          promptRuntime,
          number,
          fastModel,
        }));

        if (!isDialogueWorkflowResult(workflowResult)) {
          throw new Error("No response returned from workflow");
        }

        const { thinkingContent, screenContent, fullResponse, nextPrompts, event } = workflowResult.outputData;

        if (thinkingContent) {
          controller.enqueue(encoder.encode(formatSSEData({
            type: "reasoning",
            thinkingContent,
          })));
        }

        let sentContent = "";
        for (let index = 0; index < screenContent.length; index += STREAMING_CHUNK_SIZE) {
          const chunk = screenContent.slice(index, index + STREAMING_CHUNK_SIZE);
          sentContent += chunk;
          controller.enqueue(encoder.encode(formatSSEData({
            type: "content",
            content: chunk,
            accumulated: sentContent,
          })));
          await sleep(STREAMING_CHUNK_DELAY_MS);
        }

        controller.enqueue(encoder.encode(formatSSEData({
          type: "complete",
          success: true,
          thinkingContent: thinkingContent ?? "",
          content: screenContent,
          parsedContent: { nextPrompts: nextPrompts ?? [] },
          isRegexProcessed: true,
        })));
        controller.enqueue(encoder.encode(formatSSEDone()));

        processPostResponseAsync({
          dialogueId,
          message: originalMessage,
          thinkingContent: thinkingContent ?? "",
          fullResponse,
          screenContent,
          event: typeof event === "string" ? event : "",
          nextPrompts: nextPrompts ?? [],
          nodeId,
        }).catch((error) => console.error("Post-processing error:", error));

        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Streaming error:", error);
        controller.enqueue(encoder.encode(formatSSEData({
          type: "error",
          message: errorMessage,
          success: false,
        })));
        controller.enqueue(encoder.encode(formatSSEDone()));
        controller.close();
      }
    },
  });

  return createSSEResponse(stream);
}
