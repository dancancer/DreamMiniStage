/** API 后端提供者实现 — OpenAI / Anthropic / Ollama 客户端 */

import type {
  ApiBackendType,
  UnifiedMessage,
  UnifiedRequestParams,
  UnifiedResponse,
  StreamChunk,
  BackendConfig,
  ApiClient,
  ToolCall,
} from "./backends";

interface OpenAIResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { content: string | null; tool_calls?: ToolCall[] };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/** OpenAI 客户端 */
export class OpenAIClient implements ApiClient {
  readonly type: ApiBackendType = "openai";
  private config: BackendConfig;
  constructor(config: BackendConfig) {
    this.config = { ...config, type: "openai" };
  }

  async chat(params: UnifiedRequestParams): Promise<UnifiedResponse> {
    const response = await fetch(this.getApiUrl("/chat/completions"), {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(this.transformRequest(params)),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return this.transformResponse(data);
  }

  async *chatStream(params: UnifiedRequestParams): AsyncGenerator<StreamChunk> {
    const response = await fetch(this.getApiUrl("/chat/completions"), {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ ...this.transformRequest(params), stream: true }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            yield { done: true };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            yield {
              content: delta?.content,
              toolCalls: delta?.tool_calls,
              finishReason: parsed.choices?.[0]?.finish_reason,
              done: false,
            };
          } catch {
            continue;
          }
        }
      }
    }

    yield { done: true };
  }

  private getApiUrl(path: string): string {
    const base = this.config.apiUrl || "https://api.openai.com/v1";
    return `${base}${path}`;
  }

  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.config.apiKey}`,
      ...(this.config.organizationId && { "OpenAI-Organization": this.config.organizationId }),
      ...this.config.headers,
    };
  }

  private transformRequest(params: UnifiedRequestParams): Record<string, unknown> {
    return {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature,
      top_p: params.top_p,
      max_tokens: params.max_tokens,
      stop: params.stop,
      stream: params.stream,
      tools: params.tools,
      tool_choice: params.tool_choice,
    };
  }

  private transformResponse(data: OpenAIResponse): UnifiedResponse {
    const choice = data.choices[0];
    return {
      id: data.id,
      model: data.model,
      content: choice.message.content || "",
      finishReason: choice.finish_reason as UnifiedResponse["finishReason"],
      toolCalls: choice.message.tool_calls,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }
}

interface AnthropicResponse {
  id: string;
  model: string;
  content: Array<{ type: string; text: string }>;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

/** Anthropic 客户端 */
export class AnthropicClient implements ApiClient {
  readonly type: ApiBackendType = "anthropic";
  private config: BackendConfig;
  constructor(config: BackendConfig) {
    this.config = { ...config, type: "anthropic" };
  }

  async chat(params: UnifiedRequestParams): Promise<UnifiedResponse> {
    const { systemPrompt, messages } = this.extractSystemPrompt(params.messages);

    const response = await fetch(this.getApiUrl("/messages"), {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.max_tokens || 4096,
        system: systemPrompt,
        messages: this.transformMessages(messages),
        temperature: params.temperature,
        top_p: params.top_p,
        stop_sequences: params.stop,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return this.transformResponse(data);
  }

  async *chatStream(params: UnifiedRequestParams): AsyncGenerator<StreamChunk> {
    const { systemPrompt, messages } = this.extractSystemPrompt(params.messages);

    const response = await fetch(this.getApiUrl("/messages"), {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.max_tokens || 4096,
        system: systemPrompt,
        messages: this.transformMessages(messages),
        temperature: params.temperature,
        stop_sequences: params.stop,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "content_block_delta") {
              yield { content: data.delta?.text, done: false };
            } else if (data.type === "message_stop") {
              yield { done: true };
              return;
            }
          } catch {
            continue;
          }
        }
      }
    }

    yield { done: true };
  }

  private getApiUrl(path: string): string {
    const base = this.config.apiUrl || "https://api.anthropic.com/v1";
    return `${base}${path}`;
  }

  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.config.apiKey || "",
      "anthropic-version": "2023-06-01",
      ...this.config.headers,
    };
  }

  private extractSystemPrompt(messages: UnifiedMessage[]): {
    systemPrompt: string;
    messages: UnifiedMessage[];
  } {
    const systemMessages = messages.filter((m) => m.role === "system");
    const otherMessages = messages.filter((m) => m.role !== "system");

    return {
      systemPrompt: systemMessages.map((m) =>
        typeof m.content === "string" ? m.content : "",
      ).join("\n\n"),
      messages: otherMessages,
    };
  }

  private transformMessages(messages: UnifiedMessage[]): Array<{ role: string; content: string }> {
    return messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: typeof m.content === "string" ? m.content : "",
    }));
  }

  private transformResponse(data: AnthropicResponse): UnifiedResponse {
    const textContent = data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");

    return {
      id: data.id,
      model: data.model,
      content: textContent,
      finishReason: data.stop_reason === "end_turn" ? "stop" : data.stop_reason as UnifiedResponse["finishReason"],
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  }
}

/** Ollama 客户端 */
export class OllamaClient implements ApiClient {
  readonly type: ApiBackendType = "ollama";
  private config: BackendConfig;

  constructor(config: BackendConfig) {
    this.config = { ...config, type: "ollama" };
  }

  async chat(params: UnifiedRequestParams): Promise<UnifiedResponse> {
    const response = await fetch(this.getApiUrl("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages.map((m) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : "",
        })),
        stream: false,
        options: {
          temperature: params.temperature,
          top_p: params.top_p,
          num_predict: params.max_tokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      id: `ollama-${Date.now()}`,
      model: params.model,
      content: data.message?.content || "",
      finishReason: "stop",
    };
  }

  async *chatStream(params: UnifiedRequestParams): AsyncGenerator<StreamChunk> {
    const response = await fetch(this.getApiUrl("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages.map((m) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : "",
        })),
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            yield {
              content: data.message?.content,
              done: data.done || false,
            };
            if (data.done) return;
          } catch {
            continue;
          }
        }
      }
    }

    yield { done: true };
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(this.getApiUrl("/api/tags"));
    if (!response.ok) return [];

    const data = await response.json();
    return data.models?.map((m: { name: string }) => m.name) || [];
  }

  private getApiUrl(path: string): string {
    const base = this.config.apiUrl || "http://localhost:11434";
    return `${base}${path}`;
  }
}
