import type { LLMConfig } from "@/lib/nodeflow/LLMNode/llm-config";

export interface PreparedDialogueExecution {
  context: unknown;
  llmConfig: LLMConfig;
  postprocessNodeId?: string;
  metadata?: Record<string, unknown>;
}

export interface FinalizedDialogueResult {
  screenContent: string;
  fullResponse: string;
  thinkingContent: string;
  parsedContent?: {
    nextPrompts?: string[];
  };
  event?: string;
  isPostProcessed?: boolean;
}

export type GenerationEvent =
  | { type: "content-delta"; delta: string; accumulated: string }
  | { type: "reasoning-delta"; delta: string; accumulated: string }
  | { type: "tool-call-start"; toolName: string }
  | { type: "tool-call-result"; toolName: string; output: string }
  | { type: "postprocess-start" }
  | { type: "complete"; result: FinalizedDialogueResult }
  | { type: "error"; message: string };
