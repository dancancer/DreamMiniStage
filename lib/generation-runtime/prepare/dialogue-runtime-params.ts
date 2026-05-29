import type { ModelAdvancedSettings } from "@/lib/model-runtime";

export interface DialogueRuntimeParamInput {
  dialogueId: string;
  characterId: string;
  userInput: string;
  language: "zh" | "en";
  username?: string;
  modelName: string;
  apiKey: string;
  baseUrl: string;
  llmType: "openai" | "ollama" | "gemini";
  advanced?: ModelAdvancedSettings;
  number: number;
  fastModel: boolean;
}

export interface DialogueRuntimeParams {
  dialogueKey?: string;
  characterId: string;
  userInput: string;
  number?: number;
  language?: "zh" | "en";
  username?: string;
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  llmType?: "openai" | "ollama" | "gemini";
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
  fastModel?: boolean;
}
