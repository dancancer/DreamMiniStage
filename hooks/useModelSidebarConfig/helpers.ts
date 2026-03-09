import {
  normalizeModelAdvancedSettings,
  type APIConfig,
  type LLMType,
  type ModelAdvancedSettings,
} from "@/lib/model-runtime";

export const DEFAULT_FORM_ADVANCED_SETTINGS: ModelAdvancedSettings = {
  streaming: true,
  streamUsage: true,
};

export function describeLlmType(type: LLMType): string {
  const map: Record<LLMType, string> = {
    ollama: "Ollama API",
    gemini: "Gemini API",
    openai: "OpenAI API",
  };
  return map[type];
}

export function getBaseUrlPlaceholder(type: LLMType): string {
  const map: Record<LLMType, string> = {
    ollama: "http://localhost:11434",
    gemini: "",
    openai: "https://api.openai.com/v1",
  };
  return map[type];
}

export function getModelPlaceholder(type: LLMType): string {
  const map: Record<LLMType, string> = {
    ollama: "llama3, mistral, mixtral...",
    gemini: "gemini-1.5-flash, gemini-1.5-pro...",
    openai: "gpt-4-turbo, claude-3-opus-20240229...",
  };
  return map[type];
}

function generateConfigId(): string {
  return `api_${Date.now()}`;
}


export function generateConfigName(
  configs: APIConfig[],
  type: LLMType,
  modelName: string,
): string {
  let name = modelName?.trim() || (type === "gemini" ? "Gemini" : type === "ollama" ? "Ollama" : "OpenAI");
  if (name.length > 15) {
    name = name.substring(0, 15);
  }

  const same = configs.filter((config) =>
    config.model === modelName || new RegExp(`【\d+】${name}`).test(config.name),
  );
  if (same.length === 0) {
    return "new model";
  }

  const max = same.reduce((currentMax, config) => {
    const match = config.name.match(/【(\d+)】/);
    return match ? Math.max(currentMax, parseInt(match[1], 10)) : currentMax;
  }, 0);
  return `${name}(${max + 1})`;
}

export function toFormAdvancedSettings(
  settings?: Partial<ModelAdvancedSettings>,
): ModelAdvancedSettings {
  return {
    ...DEFAULT_FORM_ADVANCED_SETTINGS,
    ...normalizeModelAdvancedSettings(settings),
  };
}

export function buildConfigDraft(input: {
  id?: string;
  name: string;
  type: LLMType;
  baseUrl: string;
  model: string;
  apiKey: string;
  availableModels: string[];
  advancedSettings: ModelAdvancedSettings;
}): APIConfig {
  return {
    id: input.id || generateConfigId(),
    name: input.name,
    type: input.type,
    baseUrl: input.type === "gemini" ? "" : input.baseUrl,
    model: input.model,
    availableModels: input.type === "ollama" ? [] : input.availableModels,
    apiKey: input.type === "ollama" ? undefined : input.apiKey,
    advanced: normalizeModelAdvancedSettings(input.advancedSettings),
  };
}
