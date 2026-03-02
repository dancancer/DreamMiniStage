/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Prompt 模块统一入口                                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// 核心类
export { STPromptManager } from "./manager";
export type { BuildMessagesOptions, SamplingParams, BuildMessagesForModelOptions } from "./manager";

// 工具函数
export {
  createPromptManager,
  createPromptManagerFromOpenAI,
  validateOpenAIPreset,
  mergePresets,
} from "./preset-utils";

// 后处理函数 (Requirements: 1.1-1.5, 2.1-2.5, 3.1-3.4, 4.1-4.3, 5.1-5.4)
export {
  getTextContent,
  prependToContent,
  mergeContent,
  normalizeNames,
  mergeConsecutiveRoles,
  convertMidSystemToUser,
  ensureUserStart,
  ensureNonEmpty,
  stripTools,
} from "./post-processor";

// 模型转换器 (Requirements: 7.1, 8.1)
export {
  convertForClaude,
  convertForGoogle,
  getConverterForModel,
  requiresConversion,
  type ModelType,
  type ClaudeConversionResult,
  type ClaudeConvertOptions,
  type ClaudeMessage,
  type GoogleConversionResult,
  type GoogleConvertOptions,
  type GoogleMessage,
} from "./converters";

// 类型（从 st-preset-types 重导出）
export type {
  STOpenAIPreset,
  STPrompt,
  STPromptOrder,
  STPromptOrderEntry,
  STCombinedPreset,
  STContextPreset,
  STSyspromptPreset,
  MacroEnv,
  ChatMessage,
  GenerationType,
  ExtendedChatMessage,
  PromptNames,
  ContentPart,
  PostProcessingMode,
  PostProcessOptions,
} from "../st-preset-types";

export {
  ST_PROMPT_IDENTIFIERS,
  ST_MARKER_IDENTIFIERS,
  DEFAULT_CONTEXT_PRESET,
  DEFAULT_SAMPLING_PARAMS,
} from "../st-preset-types";
