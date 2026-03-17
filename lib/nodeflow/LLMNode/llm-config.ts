import type { PromptNames, PostProcessingMode } from "@/lib/core/st-preset-types";
import type { EffectivePromptConfigSummary } from "@/lib/prompt-config/state";
import type { OpenAITool } from "@/lib/mvu/function-call";

export interface LLMConfig {
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  llmType: "openai" | "ollama" | "gemini" | "claude";
  temperature?: number;
  contextWindow?: number;
  maxTokens?: number;
  timeout?: number;
  maxRetries?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  topK?: number;
  repeatPenalty?: number;
  streaming?: boolean;
  streamUsage?: boolean;
  language?: "zh" | "en";
  dialogueKey?: string;
  characterId?: string;
  messages?: Array<{ role: string; content: string }>;
  stopStrings?: string[];
  effectivePromptConfig?: EffectivePromptConfigSummary;
  promptNames?: PromptNames;
  postProcessingMode?: PostProcessingMode;
  tools?: boolean;
  prefill?: string;
  placeholder?: string;
  mvuToolEnabled?: boolean;
  scriptTools?: OpenAITool[];
}
