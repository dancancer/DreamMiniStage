import type { STOpenAIPreset } from "@/lib/core/st-preset-types";
import {
  getString,
  removeItem,
  setBoolean,
  setString,
} from "@/lib/storage/client-storage";

export type LLMType = "openai" | "ollama" | "gemini";

export interface ModelAdvancedSettings {
  temperature?: number;
  contextWindow?: number;
  maxTokens?: number;
  timeout?: number;
  maxRetries?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  topK?: number;
  repeatPenalty?: number;
  streaming?: boolean;
  streamUsage?: boolean;
}

export interface APIConfig {
  id: string;
  name: string;
  type: LLMType;
  baseUrl: string;
  model: string;
  apiKey?: string;
  availableModels?: string[];
  advanced?: ModelAdvancedSettings;
}

export const MODEL_STORAGE_KEYS: Record<LLMType, {
  model: string;
  baseUrl: string;
  apiKey?: string;
}> = {
  openai: { model: "openaiModel", baseUrl: "openaiBaseUrl", apiKey: "openaiApiKey" },
  ollama: { model: "ollamaModel", baseUrl: "ollamaBaseUrl" },
  gemini: { model: "geminiModel", baseUrl: "geminiBaseUrl", apiKey: "geminiApiKey" },
};

export const MODEL_ADVANCED_STORAGE_KEYS = {
  temperature: "temperature",
  contextWindow: "contextWindow",
  maxTokens: "maxTokens",
  timeout: "llmTimeout",
  maxRetries: "llmMaxRetries",
  topP: "topP",
  frequencyPenalty: "frequencyPenalty",
  presencePenalty: "presencePenalty",
  topK: "topK",
  repeatPenalty: "repeatPenalty",
  streaming: "streamingEnabled",
  streamUsage: "streamUsageEnabled",
} as const;

export type NumericModelSettingKey = Exclude<keyof ModelAdvancedSettings, "streaming" | "streamUsage">;
export type BooleanModelSettingKey = Extract<keyof ModelAdvancedSettings, "streaming" | "streamUsage">;

type PresetSamplingSource = Partial<Pick<
  STOpenAIPreset,
  | "temperature"
  | "top_p"
  | "top_k"
  | "frequency_penalty"
  | "presence_penalty"
  | "repetition_penalty"
  | "openai_max_context"
  | "openai_max_tokens"
  | "stream_openai"
>>;

const NUMERIC_SETTING_KEYS: NumericModelSettingKey[] = [
  "temperature",
  "contextWindow",
  "maxTokens",
  "timeout",
  "maxRetries",
  "topP",
  "frequencyPenalty",
  "presencePenalty",
  "topK",
  "repeatPenalty",
];

const BOOLEAN_SETTING_KEYS: BooleanModelSettingKey[] = ["streaming", "streamUsage"];

function pickDefined<T>(...values: Array<T | undefined>): T | undefined {
  return values.find((value) => value !== undefined);
}

function parseStoredNumber(key: string): number | undefined {
  const raw = getString(key);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function parseStoredBoolean(key: string): boolean | undefined {
  const raw = getString(key);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return undefined;
}

function writeOptionalNumber(key: string, value: number | undefined): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    setString(key, String(value));
    return;
  }
  removeItem(key);
}

function writeOptionalBoolean(key: string, value: boolean | undefined): void {
  if (typeof value === "boolean") {
    setBoolean(key, value);
    return;
  }
  removeItem(key);
}

export function normalizeModelAdvancedSettings(
  settings?: Partial<ModelAdvancedSettings>,
): ModelAdvancedSettings {
  if (!settings) return {};

  const normalized: ModelAdvancedSettings = {};

  for (const key of NUMERIC_SETTING_KEYS) {
    const value = settings[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      normalized[key] = value;
    }
  }

  for (const key of BOOLEAN_SETTING_KEYS) {
    const value = settings[key];
    if (typeof value === "boolean") {
      normalized[key] = value;
    }
  }

  return normalized;
}

export function convertPresetToModelAdvancedSettings(
  preset?: PresetSamplingSource,
): ModelAdvancedSettings {
  if (!preset) return {};

  return normalizeModelAdvancedSettings({
    temperature: preset.temperature,
    contextWindow: preset.openai_max_context,
    maxTokens: preset.openai_max_tokens,
    topP: preset.top_p,
    frequencyPenalty: preset.frequency_penalty,
    presencePenalty: preset.presence_penalty,
    topK: preset.top_k,
    repeatPenalty: preset.repetition_penalty,
    streaming: preset.stream_openai,
  });
}

export function resolveModelAdvancedSettings(input: {
  request?: Partial<ModelAdvancedSettings>;
  session?: Partial<ModelAdvancedSettings>;
  preset?: Partial<ModelAdvancedSettings>;
}): ModelAdvancedSettings {
  const request = normalizeModelAdvancedSettings(input.request);
  const session = normalizeModelAdvancedSettings(input.session);
  const preset = normalizeModelAdvancedSettings(input.preset);

  return normalizeModelAdvancedSettings({
    temperature: pickDefined(request.temperature, session.temperature, preset.temperature),
    contextWindow: pickDefined(request.contextWindow, session.contextWindow, preset.contextWindow),
    maxTokens: pickDefined(request.maxTokens, session.maxTokens, preset.maxTokens),
    timeout: pickDefined(request.timeout, session.timeout, preset.timeout),
    maxRetries: pickDefined(request.maxRetries, session.maxRetries, preset.maxRetries),
    topP: pickDefined(request.topP, session.topP, preset.topP),
    frequencyPenalty: pickDefined(
      request.frequencyPenalty,
      session.frequencyPenalty,
      preset.frequencyPenalty,
    ),
    presencePenalty: pickDefined(
      request.presencePenalty,
      session.presencePenalty,
      preset.presencePenalty,
    ),
    topK: pickDefined(request.topK, session.topK, preset.topK),
    repeatPenalty: pickDefined(request.repeatPenalty, session.repeatPenalty, preset.repeatPenalty),
    streaming: pickDefined(request.streaming, session.streaming, preset.streaming),
    streamUsage: pickDefined(request.streamUsage, session.streamUsage, preset.streamUsage),
  });
}

export function readStoredModelAdvancedSettings(): ModelAdvancedSettings {
  return normalizeModelAdvancedSettings({
    temperature: parseStoredNumber(MODEL_ADVANCED_STORAGE_KEYS.temperature),
    contextWindow: parseStoredNumber(MODEL_ADVANCED_STORAGE_KEYS.contextWindow),
    maxTokens: parseStoredNumber(MODEL_ADVANCED_STORAGE_KEYS.maxTokens),
    timeout: parseStoredNumber(MODEL_ADVANCED_STORAGE_KEYS.timeout),
    maxRetries: parseStoredNumber(MODEL_ADVANCED_STORAGE_KEYS.maxRetries),
    topP: parseStoredNumber(MODEL_ADVANCED_STORAGE_KEYS.topP),
    frequencyPenalty: parseStoredNumber(MODEL_ADVANCED_STORAGE_KEYS.frequencyPenalty),
    presencePenalty: parseStoredNumber(MODEL_ADVANCED_STORAGE_KEYS.presencePenalty),
    topK: parseStoredNumber(MODEL_ADVANCED_STORAGE_KEYS.topK),
    repeatPenalty: parseStoredNumber(MODEL_ADVANCED_STORAGE_KEYS.repeatPenalty),
    streaming: parseStoredBoolean(MODEL_ADVANCED_STORAGE_KEYS.streaming),
    streamUsage: parseStoredBoolean(MODEL_ADVANCED_STORAGE_KEYS.streamUsage),
  });
}

export function syncModelConfigToStorage(config: APIConfig): void {
  const keys = MODEL_STORAGE_KEYS[config.type];
  const advanced = normalizeModelAdvancedSettings(config.advanced);

  setString("llmType", config.type);
  setString("modelName", config.model);
  setString(keys.model, config.model);
  setString("modelBaseUrl", config.baseUrl);
  setString(keys.baseUrl, config.baseUrl);

  if (keys.apiKey) {
    if (typeof config.apiKey === "string") {
      setString(keys.apiKey, config.apiKey);
      if (config.apiKey.trim().length > 0) {
        setString("apiKey", config.apiKey);
      }
    } else {
      removeItem(keys.apiKey);
    }
  }

  writeOptionalNumber(MODEL_ADVANCED_STORAGE_KEYS.temperature, advanced.temperature);
  writeOptionalNumber(MODEL_ADVANCED_STORAGE_KEYS.contextWindow, advanced.contextWindow);
  writeOptionalNumber(MODEL_ADVANCED_STORAGE_KEYS.maxTokens, advanced.maxTokens);
  writeOptionalNumber(MODEL_ADVANCED_STORAGE_KEYS.timeout, advanced.timeout);
  writeOptionalNumber(MODEL_ADVANCED_STORAGE_KEYS.maxRetries, advanced.maxRetries);
  writeOptionalNumber(MODEL_ADVANCED_STORAGE_KEYS.topP, advanced.topP);
  writeOptionalNumber(MODEL_ADVANCED_STORAGE_KEYS.frequencyPenalty, advanced.frequencyPenalty);
  writeOptionalNumber(MODEL_ADVANCED_STORAGE_KEYS.presencePenalty, advanced.presencePenalty);
  writeOptionalNumber(MODEL_ADVANCED_STORAGE_KEYS.topK, advanced.topK);
  writeOptionalNumber(MODEL_ADVANCED_STORAGE_KEYS.repeatPenalty, advanced.repeatPenalty);
  writeOptionalBoolean(MODEL_ADVANCED_STORAGE_KEYS.streaming, advanced.streaming);
  writeOptionalBoolean(MODEL_ADVANCED_STORAGE_KEYS.streamUsage, advanced.streamUsage);
}

export function resolveStreamingEnabled(settings?: Partial<ModelAdvancedSettings>): boolean {
  return settings?.streaming ?? true;
}

export function resolveStreamUsageEnabled(settings?: Partial<ModelAdvancedSettings>): boolean {
  return settings?.streamUsage ?? true;
}

export interface ChatMessageLike {
  role: string;
  content: string;
}

export function estimateMessageTokens(text: string): number {
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const otherCount = text.length - cjkCount;
  return Math.ceil(cjkCount / 1.5 + otherCount / 4);
}

export function applyContextWindowToMessages<T extends ChatMessageLike>(
  messages: readonly T[],
  settings?: Pick<ModelAdvancedSettings, "contextWindow" | "maxTokens">,
): T[] {
  const contextWindow = settings?.contextWindow;
  if (typeof contextWindow !== "number" || !Number.isFinite(contextWindow) || contextWindow <= 0) {
    return [...messages];
  }

  const reservedOutput = Math.max(settings?.maxTokens ?? 0, 0);
  const availableInputBudget = Math.max(contextWindow - reservedOutput, 0);
  if (availableInputBudget === 0) {
    return messages.length > 0 ? [messages[messages.length - 1]] : [];
  }

  const systemTokenCost = messages.reduce((total, message) => {
    if (message.role !== "system") return total;
    return total + estimateMessageTokens(message.content || "");
  }, 0);

  const conversationBudget = Math.max(availableInputBudget - systemTokenCost, 0);
  const keepConversation = new Set<number>();
  let usedBudget = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "system") continue;

    const tokenCost = estimateMessageTokens(message.content || "");
    if (keepConversation.size === 0 || usedBudget + tokenCost <= conversationBudget) {
      keepConversation.add(index);
      usedBudget += tokenCost;
    }
  }

  return messages.filter((message, index) => {
    if (message.role === "system") return true;
    return keepConversation.has(index);
  });
}
