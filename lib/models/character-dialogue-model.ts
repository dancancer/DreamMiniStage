/**
 * @input  lib/models/parsed-response
 * @output DialogueMessage, DialogueOptions
 * @pos    对话消息与配置模型,定义对话结构和 LLM 调用参数
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

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
