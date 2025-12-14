/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         扩展模块入口                                       ║
 * ║                                                                            ║
 * ║  统一导出 Summarize 等扩展功能                                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              Summarize 扩展导出
// ============================================================================

export type {
  SummarizeConfig,
  SummaryEntry,
  SummarizeState,
  SummarizeRequest,
  SummarizeResult,
  SummaryGenerator,
} from "./summarize";

export type { MemoryStorageConfig } from "./summarize";

export {
  DEFAULT_SUMMARIZE_CONFIG,
  DEFAULT_SUMMARIZE_STATE,
  DEFAULT_MEMORY_STORAGE_CONFIG,
  SummarizeManager,
  MemoryStorageManager,
  buildSummarizePrompt,
  estimateTokenCount,
  selectMessagesForSummary,
  createSummarizeManager,
  createDefaultGenerator,
  createMemoryStorageManager,
} from "./summarize";
