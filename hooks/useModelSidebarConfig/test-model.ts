import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { callGeminiOnce } from "@/lib/core/gemini-client";
import {
  normalizeModelAdvancedSettings,
  type LLMType,
  type ModelAdvancedSettings,
} from "@/lib/model-runtime";
import { getBaseUrlPlaceholder } from "./helpers";

export interface TestModelInput {
  llmType: LLMType;
  baseUrl: string;
  model: string;
  apiKey: string;
  advancedSettings: ModelAdvancedSettings;
}

function normalizeOllamaBaseUrl(baseUrl: string, llmType: LLMType): string {
  let resolvedBaseUrl = baseUrl || getBaseUrlPlaceholder(llmType);
  if (!resolvedBaseUrl.startsWith("http")) {
    resolvedBaseUrl = `http://${resolvedBaseUrl}`;
  }
  return resolvedBaseUrl.replace(/\/$/, "");
}

export async function testModelConnection(input: TestModelInput): Promise<void> {
  const { llmType, baseUrl, model, apiKey, advancedSettings } = input;
  const effectiveAdvanced = normalizeModelAdvancedSettings(advancedSettings);

  if (llmType === "gemini") {
    if (!apiKey) {
      throw new Error("Gemini requires API Key");
    }

    const reply = await callGeminiOnce({
      system: "You are a helpful AI assistant.",
      user: "Ping",
      config: {
        apiKey,
        model,
        baseUrl,
        timeout: effectiveAdvanced.timeout,
        temperature: effectiveAdvanced.temperature ?? 0.1,
        maxTokens: effectiveAdvanced.maxTokens,
        topP: effectiveAdvanced.topP,
        topK: effectiveAdvanced.topK,
      },
    });
    if (!reply.trim()) {
      throw new Error("Empty response");
    }
    return;
  }

  if (llmType === "openai") {
    const trimmedBaseUrl = (baseUrl || getBaseUrlPlaceholder(llmType)).replace(/\/$/, "");
    const chatModel = new ChatOpenAI({
      modelName: model,
      openAIApiKey: apiKey,
      configuration: { baseURL: trimmedBaseUrl },
      temperature: effectiveAdvanced.temperature ?? 0.1,
      maxTokens: effectiveAdvanced.maxTokens,
      maxRetries: effectiveAdvanced.maxRetries ?? 0,
      topP: effectiveAdvanced.topP,
      frequencyPenalty: effectiveAdvanced.frequencyPenalty,
      presencePenalty: effectiveAdvanced.presencePenalty,
      timeout: effectiveAdvanced.timeout,
    });
    const response = await chatModel.invoke([
      { role: "system", content: "You are a helpful AI assistant." },
      { role: "user", content: "Hello" },
    ]);
    if (!response.content.toString().trim()) {
      throw new Error("Empty response");
    }
    return;
  }

  const chatModel = new ChatOllama({
    baseUrl: normalizeOllamaBaseUrl(baseUrl, llmType),
    model,
    temperature: effectiveAdvanced.temperature ?? 0.1,
    topK: effectiveAdvanced.topK,
    topP: effectiveAdvanced.topP,
    repeatPenalty: effectiveAdvanced.repeatPenalty,
    numCtx: effectiveAdvanced.contextWindow,
    numPredict: effectiveAdvanced.maxTokens,
    streaming: effectiveAdvanced.streaming ?? false,
  });
  const response = await chatModel.invoke([{ role: "user", content: "Hi" }]);
  if (!response.content.toString().trim()) {
    throw new Error("Empty response");
  }
}
