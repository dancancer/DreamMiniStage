import { GoogleGenerativeAI } from "@google/generative-ai";
import { RunnableLambda } from "@langchain/core/runnables";
import { BaseMessage } from "@langchain/core/messages";

export interface GeminiConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
}

// ===============================
// Gemini 适配器：使用官方 SDK 构造可复用的 Runnable
// ===============================
export function createGeminiRunnable(config: GeminiConfig) {
  const safeModel = config.model?.trim() || "gemini-1.5-flash";

  return RunnableLambda.from(async (input: any) => {
    const { system, user } = normalizePrompt(input);
    const { client, requestOptions } = createClient(config.apiKey, config.baseUrl);

    const model = client.getGenerativeModel({
      model: safeModel,
      systemInstruction: system,
    }, requestOptions);

    const generationConfig = buildGenerationConfig(config);
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: user }],
        },
      ],
      generationConfig,
    });

    const text = result.response?.text?.() || extractCandidateText(result.response);
    if (!text) {
      throw new Error("Gemini 返回为空");
    }
    return text;
  });
}

export async function callGeminiOnce(input: {
  system: string;
  user: string;
  config: GeminiConfig;
}): Promise<string> {
  const { system, user, config } = input;
  const { client, requestOptions } = createClient(config.apiKey, config.baseUrl);
  const safeModel = config.model?.trim() || "gemini-1.5-flash";

  const model = client.getGenerativeModel({
    model: safeModel,
    systemInstruction: system,
  }, requestOptions);

  const generationConfig = buildGenerationConfig(config);
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: user }],
      },
    ],
    generationConfig,
  });

  const text = result.response?.text?.() || extractCandidateText(result.response);
  if (!text) {
    throw new Error("Gemini 返回为空");
  }
  return text;
}

function createClient(apiKey: string, baseUrl?: string) {
  const client = new GoogleGenerativeAI(apiKey);
  const trimmedBase = baseUrl?.trim();
  const requestOptions = trimmedBase ? { baseUrl: trimmedBase } : undefined;
  return { client, requestOptions };
}

function buildGenerationConfig(config: GeminiConfig) {
  const generationConfig: Record<string, number> = {};
  if (config.temperature !== undefined) generationConfig.temperature = config.temperature;
  if (config.maxTokens !== undefined) generationConfig.maxOutputTokens = config.maxTokens;
  if (config.topP !== undefined) generationConfig.topP = config.topP;
  if (config.topK !== undefined) generationConfig.topK = config.topK;
  return generationConfig;
}

function normalizePrompt(input: any): { system: string; user: string } {
  if (input?.toChatMessages) {
    return pickFromMessages(input.toChatMessages());
  }

  if (Array.isArray(input)) {
    return pickFromMessages(input);
  }

  if (input?.messages && Array.isArray(input.messages)) {
    return pickFromMessages(input.messages);
  }

  if (input?.system_message || input?.user_message) {
    return {
      system: input.system_message || "",
      user: input.user_message || input.system_message || "",
    };
  }

  return { system: "", user: typeof input === "string" ? input : "" };
}

function pickFromMessages(messages: Array<BaseMessage | any>): { system: string; user: string } {
  let system = "";
  let user = "";

  messages.forEach((message) => {
    const role = getRole(message);
    const text = getText(message?.content);
    if (!text) return;
    if (role === "system") {
      system = text;
    } else if (role === "human" || role === "user") {
      user = text;
    }
  });

  return { system, user: user || system };
}

function getRole(message: any): string {
  if (typeof message?._getType === "function") {
    return message._getType();
  }
  if (message?.role) return message.role;
  return "";
}

function getText(content: any): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(getText).join(" ");
  if (typeof content === "object" && content.text) return content.text;
  return "";
}

function extractCandidateText(response: any): string {
  if (!response?.candidates) return "";
  const candidate = response.candidates.find((item: any) => item?.content?.parts?.length);
  if (!candidate) return "";
  return candidate.content.parts.map((part: any) => part.text || "").join("");
}
