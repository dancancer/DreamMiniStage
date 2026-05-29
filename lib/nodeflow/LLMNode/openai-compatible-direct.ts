import { inferModelCapability } from "@/lib/model-capabilities";
import type { TokenUsage } from "@/lib/adapters/token-usage";
import type { LLMConfig } from "./llm-config";
import type { StreamingCallbacks } from "./model-invokers";

type ChatMessage = { role: string; content: string };

interface DirectChoice {
  message?: { content?: string | null };
  delta?: { content?: string; reasoning_content?: string };
}

interface DirectResponse {
  choices?: DirectChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export function shouldUseDirectOpenAICompatible(config: LLMConfig): boolean {
  return config.llmType === "openai" && inferModelCapability(config)?.sampling === "ignored";
}

export async function invokeDirectOpenAICompatibleModel(
  messages: ChatMessage[],
  config: LLMConfig,
  callbacks?: Pick<StreamingCallbacks, "onUsage">,
): Promise<string> {
  const response = await fetch(chatCompletionsUrl(config), {
    method: "POST",
    headers: requestHeaders(config),
    body: JSON.stringify(requestBody(messages, config, false)),
  });

  if (!response.ok) {
    throw new Error(`OpenAI-compatible API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as DirectResponse;
  const usage = toTokenUsage(data.usage);
  if (usage) callbacks?.onUsage?.(usage);
  return data.choices?.[0]?.message?.content ?? "";
}

export async function streamDirectOpenAICompatibleModel(
  messages: ChatMessage[],
  config: LLMConfig,
  callbacks: StreamingCallbacks,
): Promise<string> {
  const response = await fetch(chatCompletionsUrl(config), {
    method: "POST",
    headers: requestHeaders(config),
    body: JSON.stringify(requestBody(messages, config, true)),
  });

  if (!response.ok) {
    throw new Error(`OpenAI-compatible API error: ${response.status} ${await response.text()}`);
  }

  return readEventStream(response, callbacks);
}

function requestBody(
  messages: ChatMessage[],
  config: LLMConfig,
  stream: boolean,
): Record<string, unknown> {
  return stripUndefined({
    model: config.modelName,
    messages,
    stream,
    stream_options: stream && config.streamUsage ? { include_usage: true } : undefined,
    max_tokens: config.maxTokens,
    stop: config.stopStrings,
  });
}

async function readEventStream(
  response: Response,
  callbacks: StreamingCallbacks,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const next = readStreamLine(line, callbacks);
      if (!next) continue;
      fullContent += next;
      callbacks.onToken?.(next);
    }
  }

  return fullContent;
}

function readStreamLine(line: string, callbacks: StreamingCallbacks): string {
  if (!line.startsWith("data: ")) return "";
  const data = line.slice(6).trim();
  if (!data || data === "[DONE]") return "";

  let parsed: DirectResponse;
  try {
    parsed = JSON.parse(data) as DirectResponse;
  } catch {
    return "";
  }
  const delta = parsed.choices?.[0]?.delta;
  const usage = toTokenUsage(parsed.usage);
  if (usage) callbacks.onUsage?.(usage);
  if (delta?.reasoning_content) callbacks.onReasoning?.(delta.reasoning_content);
  return delta?.content ?? "";
}

function chatCompletionsUrl(config: LLMConfig): string {
  const base = (config.baseUrl?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  return `${base}/chat/completions`;
}

function requestHeaders(config: LLMConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${config.apiKey}`,
  };
}

function toTokenUsage(value: DirectResponse["usage"]): TokenUsage | undefined {
  if (!value) return undefined;
  return {
    promptTokens: value.prompt_tokens ?? 0,
    completionTokens: value.completion_tokens ?? 0,
    totalTokens: value.total_tokens ?? 0,
  };
}

function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
