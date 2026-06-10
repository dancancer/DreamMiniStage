import {
  normalizeModelAdvancedSettings,
  resolveModelAdvancedSettings,
  type ModelAdvancedSettings,
} from "@/lib/model-runtime";

export const DEFAULT_RESPONSE_LENGTH = 8192;
export const MIN_RESPONSE_LENGTH = 100;
export const MAX_RESPONSE_LENGTH = 12000;
export const RESPONSE_LENGTH_STORAGE_KEY = "storyResponseLength";

export const STORY_DEFAULT_CONTEXT_WINDOW = 32768;
export const STORY_DEFAULT_MAX_TOKENS = DEFAULT_RESPONSE_LENGTH;

const DEEPSEEK_V4_PRO_CONTEXT_WINDOW = 1_000_000;
const DEEPSEEK_V4_PRO_MAX_OUTPUT_TOKENS = 384_000;
const DEEPSEEK_V4_PRO_DEFAULT_MAX_TOKENS = DEFAULT_RESPONSE_LENGTH;

interface ModelCapability {
  defaults: ModelAdvancedSettings;
  limits: Pick<ModelAdvancedSettings, "contextWindow" | "maxTokens">;
  sampling: "supported" | "ignored";
}

export interface StoryModelPolicyInput {
  modelName: string;
  baseUrl?: string;
  /** 会话级覆盖（最高优先）。 */
  sessionOverride?: Partial<ModelAdvancedSettings>;
  /** 导入预设的采样策略（中优先）。 */
  blueprint?: Partial<ModelAdvancedSettings>;
  /** 全局默认采样（含全局模型 advanced；最低优先）。 */
  globalDefault?: Partial<ModelAdvancedSettings>;
  /** 全局默认输出长度，并入全局默认层的 maxTokens。 */
  responseLength?: number;
}

export function inferModelCapability(input: {
  modelName?: string;
  baseUrl?: string;
}): ModelCapability | undefined {
  const modelName = input.modelName?.trim().toLowerCase() ?? "";
  if (modelName !== "deepseek-v4-pro") return undefined;

  return {
    defaults: {
      contextWindow: DEEPSEEK_V4_PRO_CONTEXT_WINDOW,
      maxTokens: DEEPSEEK_V4_PRO_DEFAULT_MAX_TOKENS,
      streamUsage: true,
    },
    limits: {
      contextWindow: DEEPSEEK_V4_PRO_CONTEXT_WINDOW,
      maxTokens: DEEPSEEK_V4_PRO_MAX_OUTPUT_TOKENS,
    },
    sampling: "ignored",
  };
}

export function resolveStoryModelPolicy(input: StoryModelPolicyInput): ModelAdvancedSettings {
  const capability = inferModelCapability(input);
  // 全局默认（最低层）：story 兜底 + 模型能力默认 + 全局 advanced，输出长度并入 maxTokens。
  const globalDefault = normalizeModelAdvancedSettings({
    contextWindow: STORY_DEFAULT_CONTEXT_WINDOW,
    streamUsage: true,
    ...capability?.defaults,
    ...input.globalDefault,
    maxTokens:
      input.responseLength ??
      input.globalDefault?.maxTokens ??
      capability?.defaults?.maxTokens ??
      STORY_DEFAULT_MAX_TOKENS,
  });
  // 叠加顺序：会话覆盖 > 导入预设 > 全局默认。
  const resolved = resolveModelAdvancedSettings({
    request: input.sessionOverride,
    session: input.blueprint,
    preset: globalDefault,
  });

  return stripIgnoredSampling(capModelPolicy(resolved, capability), capability);
}

function capModelPolicy(
  settings: ModelAdvancedSettings,
  capability?: ModelCapability,
): ModelAdvancedSettings {
  if (!capability) return settings;

  return normalizeModelAdvancedSettings({
    ...settings,
    contextWindow: floorNumber(
      capNumber(settings.contextWindow, capability.limits.contextWindow),
      capability.defaults.contextWindow,
    ),
    maxTokens: capNumber(settings.maxTokens, capability.limits.maxTokens),
  });
}

function stripIgnoredSampling(
  settings: ModelAdvancedSettings,
  capability?: ModelCapability,
): ModelAdvancedSettings {
  if (capability?.sampling !== "ignored") return settings;

  const {
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    repeatPenalty,
    ...rest
  } = settings;
  void temperature;
  void topP;
  void topK;
  void frequencyPenalty;
  void presencePenalty;
  void repeatPenalty;
  return rest;
}

function capNumber(value: number | undefined, limit: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  if (typeof limit !== "number" || !Number.isFinite(limit)) return value;
  return Math.min(value, limit);
}

function floorNumber(value: number | undefined, floor: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  if (typeof floor !== "number" || !Number.isFinite(floor)) return value;
  return Math.max(value, floor);
}
