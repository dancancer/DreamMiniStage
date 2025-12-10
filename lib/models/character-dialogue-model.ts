import { ParsedResponse } from "@/lib/models/parsed-response";

export interface DialogueMessage {
  role: "user" | "assistant" | "system" | "sample";
  content: string;
  parsedContent?: ParsedResponse;
  id: number;
}

export interface DialogueOptions {
  modelName: string;
  apiKey: string;
  baseUrl: string;
  llmType: "openai" | "ollama" | "gemini";
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  language?: "zh" | "en";
  contextWindow?: number;
}
