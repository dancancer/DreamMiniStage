/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         多后端 API 支持                                    ║
 * ║                                                                            ║
 * ║  统一接口支持 OpenAI、Claude、本地模型等多种后端                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              类型定义
// ============================================================================

/** API 后端类型 */
export type ApiBackendType =
  | "openai"
  | "azure"
  | "anthropic"
  | "gemini"
  | "ollama"
  | "openrouter"
  | "custom";

/** 通用消息格式 */
export interface UnifiedMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

/** 内容部分 (多模态) */
export interface ContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string; detail?: "auto" | "low" | "high" };
}

/** 工具调用 */
export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** 通用请求参数 */
export interface UnifiedRequestParams {
  model: string;
  messages: UnifiedMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string[];
  stream?: boolean;
  tools?: ToolDefinition[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
}

/** 工具定义 */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** 通用响应格式 */
export interface UnifiedResponse {
  id: string;
  model: string;
  content: string;
  finishReason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** 流式响应块 */
export interface StreamChunk {
  content?: string;
  toolCalls?: Partial<ToolCall>[];
  finishReason?: string;
  done: boolean;
}

/** 后端配置 */
export interface BackendConfig {
  type: ApiBackendType;
  apiKey?: string;
  apiUrl?: string;
  organizationId?: string;
  defaultModel?: string;
  headers?: Record<string, string>;
}

// ============================================================================
//                              API 客户端接口
// ============================================================================

/** API 客户端接口 */
export interface ApiClient {
  readonly type: ApiBackendType;
  chat(params: UnifiedRequestParams): Promise<UnifiedResponse>;
  chatStream(params: UnifiedRequestParams): AsyncGenerator<StreamChunk>;
  listModels?(): Promise<string[]>;
}

// ============================================================================
//                              OpenAI 客户端
// ============================================================================

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

interface OpenAIResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { content: string | null; tool_calls?: ToolCall[] };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

// ============================================================================
//                              Anthropic (Claude) 客户端
// ============================================================================

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

interface AnthropicResponse {
  id: string;
  model: string;
  content: Array<{ type: string; text: string }>;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

// ============================================================================
//                              Ollama 客户端 (本地模型)
// ============================================================================

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

// ============================================================================
//                              API 管理器
// ============================================================================

/** API 管理器 */
export class ApiManager {
  private clients: Map<string, ApiClient> = new Map();
  private defaultClientId: string | null = null;

  /** 注册客户端 */
  registerClient(id: string, client: ApiClient): void {
    this.clients.set(id, client);
    if (!this.defaultClientId) {
      this.defaultClientId = id;
    }
  }

  /** 创建并注册客户端 */
  createClient(id: string, config: BackendConfig): ApiClient {
    const client = createApiClient(config);
    this.registerClient(id, client);
    return client;
  }

  /** 获取客户端 */
  getClient(id?: string): ApiClient | undefined {
    if (id) return this.clients.get(id);
    if (this.defaultClientId) return this.clients.get(this.defaultClientId);
    return undefined;
  }

  /** 设置默认客户端 */
  setDefaultClient(id: string): boolean {
    if (this.clients.has(id)) {
      this.defaultClientId = id;
      return true;
    }
    return false;
  }

  /** 获取所有客户端 ID */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /** 移除客户端 */
  removeClient(id: string): boolean {
    if (this.defaultClientId === id) {
      this.defaultClientId = null;
    }
    return this.clients.delete(id);
  }
}

// ============================================================================
//                              便捷函数
// ============================================================================

/** 创建 API 客户端 */
export function createApiClient(config: BackendConfig): ApiClient {
  switch (config.type) {
  case "openai":
  case "azure":
  case "openrouter":
    return new OpenAIClient(config);
  case "anthropic":
    return new AnthropicClient(config);
  case "ollama":
    return new OllamaClient(config);
  default:
    return new OpenAIClient(config);
  }
}

/** 创建 API 管理器 */
export function createApiManager(): ApiManager {
  return new ApiManager();
}

/** 检测后端类型 */
export function detectBackendType(apiUrl: string): ApiBackendType {
  const url = apiUrl.toLowerCase();
  if (url.includes("anthropic")) return "anthropic";
  if (url.includes("azure")) return "azure";
  if (url.includes("openrouter")) return "openrouter";
  if (url.includes("localhost") || url.includes("127.0.0.1")) return "ollama";
  if (url.includes("generativelanguage.googleapis")) return "gemini";
  return "openai";
}
