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
//                              重导出提供者实现
// ============================================================================

export { OpenAIClient, AnthropicClient, OllamaClient } from "./backend-providers";

// ============================================================================
//                              API 管理器
// ============================================================================

import { OpenAIClient, AnthropicClient, OllamaClient } from "./backend-providers";

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
