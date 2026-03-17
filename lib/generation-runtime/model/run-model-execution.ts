import {
  createContentDeltaEvent,
  createReasoningDeltaEvent,
} from "@/lib/generation-runtime/events";
import type { GenerationEvent } from "@/lib/generation-runtime/types";
import type { LLMConfig } from "@/lib/nodeflow/LLMNode/llm-config";
import { LLMNodeTools } from "@/lib/nodeflow/LLMNode/LLMNodeTools";

export async function runModelExecution(
  llmConfig: LLMConfig,
  emit: (event: GenerationEvent) => void | Promise<void>,
): Promise<{
  fullResponse: string;
  streamedContent: string;
  streamedReasoning: string;
}> {
  let streamedContent = "";
  let streamedReasoning = "";

  const fullResponse = await LLMNodeTools.invokeLLMStream(
    llmConfig,
    {
      onToken: (chunk) => {
        streamedContent += chunk;
        void emit(createContentDeltaEvent(chunk, streamedContent));
      },
      onReasoning: (chunk) => {
        streamedReasoning += chunk;
        void emit(createReasoningDeltaEvent(chunk, streamedReasoning));
      },
      onToolCallStart: (toolName) => {
        void emit({
          type: "tool-call-start",
          toolName,
        });
      },
      onToolCallResult: (toolName, output) => {
        void emit({
          type: "tool-call-result",
          toolName,
          output,
        });
      },
    },
  );

  return {
    fullResponse,
    streamedContent,
    streamedReasoning,
  };
}
