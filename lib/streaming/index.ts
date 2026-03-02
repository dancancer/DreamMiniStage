/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         流式处理模块入口                                   ║
 * ║                                                                            ║
 * ║  统一导出 Tool Call 解析和 Reasoning 提取功能                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              Tool Call 解析导出
// ============================================================================

export type {
  ToolCallStatus,
  ToolCallEntry,
  StreamDelta,
  ParseResult,
  ToolDefinition,
  ToolExecutionResult,
} from "./tool-call-parser";

export {
  ToolCallParser,
  ToolCallExecutor,
  createToolCallParser,
  createToolCallExecutor,
  extractToolCallsFromResponse,
} from "./tool-call-parser";

// ============================================================================
//                              Reasoning 提取导出
// ============================================================================

export type {
  ReasoningTagConfig,
  ReasoningBlock,
  ExtractionResult,
  ReasoningExtractorConfig,
} from "./reasoning-extractor";

export {
  DEFAULT_REASONING_TAGS,
  DEFAULT_EXTRACTOR_CONFIG,
  ReasoningExtractor,
  extractReasoning,
  stripReasoningTags,
  hasReasoningTags,
  getReasoningContent,
  createReasoningExtractor,
  formatReasoningForDisplay,
} from "./reasoning-extractor";

// ============================================================================
//                              SSE 流式处理导出
// ============================================================================

export type {
  StreamEventType,
  StreamEvent,
  StreamCallbacks,
  StreamResult,
  StreamResponseEvent,
} from "./sse-handler";

export {
  processSSEStream,
  createSSEResponse,
  formatSSEData,
  formatSSEDone,
  createStreamResponseBuilder,
} from "./sse-handler";

// ============================================================================
//                              中断控制导出
// ============================================================================

export type {
  AbortReason,
  AbortEvent,
  AbortListener,
  GenerationStatus,
} from "./abort-controller";

export {
  GenerationAbortController,
  GlobalAbortManager,
  createAbortController,
  createGlobalAbortManager,
  getGlobalAbortManager,
  fetchWithAbort,
  AbortError,
  isAbortError,
} from "./abort-controller";
