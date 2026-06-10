import type { LLMConfig } from "./llm-config";

// 只保留模型调用本身需要的字段，剔除会话级污染（tools / mvuToolEnabled / scriptTools /
// promptNames / postProcessingMode / prefill / placeholder / stopStrings / 会话标识 / messages /
// streaming 等）。用于导入期的纯非流式 JSON 模型调用（QA-repair、widget synthesis）——
// 调用方拿到后自行设置 messages 与 streaming。白名单方式，新增会话字段默认被排除。
export function cleanModelCallConfig(config: LLMConfig): LLMConfig {
  return {
    modelName: config.modelName,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    llmType: config.llmType,
    temperature: config.temperature,
    contextWindow: config.contextWindow,
    maxTokens: config.maxTokens,
    timeout: config.timeout,
    maxRetries: config.maxRetries,
    topP: config.topP,
    frequencyPenalty: config.frequencyPenalty,
    presencePenalty: config.presencePenalty,
    topK: config.topK,
    repeatPenalty: config.repeatPenalty,
    language: config.language,
  };
}
