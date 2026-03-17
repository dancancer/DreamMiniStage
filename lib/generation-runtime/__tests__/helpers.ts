import { createContentDeltaEvent } from "@/lib/generation-runtime/events";
import type { GenerationEvent } from "@/lib/generation-runtime/types";

interface CollectGenerationEventsInput {
  llmType: "openai" | "ollama" | "gemini" | "claude";
  scriptTools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  mockChunks: string[];
}

export async function collectGenerationEvents(
  input: CollectGenerationEventsInput,
): Promise<{ events: GenerationEvent[] }> {
  let accumulated = "";
  const events = input.mockChunks.map((chunk) => {
    accumulated += chunk;
    return createContentDeltaEvent(chunk, accumulated);
  });

  return { events };
}
