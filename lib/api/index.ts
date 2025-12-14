/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         API 模块入口                                       ║
 * ║                                                                            ║
 * ║  统一导出多后端 API 支持                                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

export type {
  ApiBackendType,
  UnifiedMessage,
  ContentPart,
  ToolCall,
  UnifiedRequestParams,
  ToolDefinition,
  UnifiedResponse,
  StreamChunk,
  BackendConfig,
  ApiClient,
} from "./backends";

export {
  OpenAIClient,
  AnthropicClient,
  OllamaClient,
  ApiManager,
  createApiClient,
  createApiManager,
  detectBackendType,
} from "./backends";
