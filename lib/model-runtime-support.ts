import type {
  BooleanModelSettingKey,
  LLMType,
  NumericModelSettingKey,
} from "@/lib/model-runtime";

const SUPPORTED_NUMBER_SETTINGS: Record<LLMType, readonly NumericModelSettingKey[]> = {
  openai: [
    "temperature",
    "contextWindow",
    "maxTokens",
    "timeout",
    "maxRetries",
    "topP",
    "frequencyPenalty",
    "presencePenalty",
  ],
  ollama: [
    "temperature",
    "contextWindow",
    "maxTokens",
    "topP",
    "topK",
    "repeatPenalty",
  ],
  gemini: [
    "temperature",
    "contextWindow",
    "maxTokens",
    "timeout",
    "topP",
    "topK",
  ],
};

export function supportsModelAdvancedNumberSetting(
  type: LLMType,
  key: NumericModelSettingKey,
): boolean {
  return SUPPORTED_NUMBER_SETTINGS[type].includes(key);
}

export function supportsModelAdvancedBooleanSetting(
  type: LLMType,
  key: BooleanModelSettingKey,
): boolean {
  if (key === "streamUsage") {
    return type === "openai";
  }

  return key === "streaming";
}
