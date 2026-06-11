// Story Agent 分层设置的会话/预设两路写入 + 纯合并/解析。
// 会话级覆盖写进 StorySessionState.settings（仅本会话）；预设级编辑直接改 blueprint
// （影响该角色所有会话）。叠加优先级见 resolveStoryModelPolicy：会话 > 预设 > 全局默认。
import type { APIConfig, ModelAdvancedSettings } from "@/lib/model-runtime";
import type { SessionBlueprint } from "@/lib/story-agent/blueprint";
import type {
  StorySessionPromptOverride,
  StorySessionSettings,
  StorySessionState,
} from "@/lib/story-agent/runtime/story-session";
import {
  getStoryBlueprint,
  getStorySession,
  saveStoryBlueprint,
  saveStorySession,
} from "./store";

function pruneUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
}

/** 纯合并：会话设置补丁叠加到现有 settings；modelPolicy 深合并并剔除显式 undefined（回落预设）。 */
export function mergeStorySessionSettings(
  current: StorySessionSettings | undefined,
  patch: StorySessionSettings,
): StorySessionSettings {
  return {
    ...current,
    ...patch,
    modelPolicy: pruneUndefined({ ...current?.modelPolicy, ...patch.modelPolicy }),
    promptOverrides: { ...current?.promptOverrides, ...patch.promptOverrides },
  };
}

/** 纯解析：会话指定了存在的 modelConfigId 则用它，否则回落 active 配置。 */
export function resolveSessionModelConfig(
  configs: APIConfig[],
  activeConfigId: string,
  modelConfigId?: string,
): APIConfig | undefined {
  const byId = (id: string) => configs.find((config) => config.id === id);
  return (modelConfigId ? byId(modelConfigId) : undefined) ?? byId(activeConfigId);
}

/** 会话级（仅本会话）：合并写入 StorySessionState.settings。 */
export async function updateStorySessionSettings(
  dialogueId: string,
  patch: StorySessionSettings,
  now = new Date().toISOString(),
): Promise<StorySessionState> {
  const session = await getStorySession(dialogueId);
  if (!session) {
    throw new Error(`StorySession not found: ${dialogueId}`);
  }
  const next: StorySessionState = {
    ...session,
    settings: mergeStorySessionSettings(session.settings, patch),
    updatedAt: now,
  };
  await saveStorySession(next);
  return next;
}

/** 预设级（该角色所有会话）：改写导入 blueprint 的采样策略。 */
export async function updateStoryBlueprintModelPolicy(
  blueprintId: string,
  patch: Partial<ModelAdvancedSettings>,
  now = new Date().toISOString(),
): Promise<SessionBlueprint> {
  const blueprint = await getStoryBlueprint(blueprintId);
  if (!blueprint) {
    throw new Error(`SessionBlueprint not found: ${blueprintId}`);
  }
  const next: SessionBlueprint = {
    ...blueprint,
    modelPolicy: pruneUndefined({ ...blueprint.modelPolicy, ...patch }),
  };
  await saveStoryBlueprint(next, now);
  return next;
}

/** 预设级（该角色所有会话）：改写导入 blueprint 单条提示词条目的开关/内容。 */
export async function setStoryBlueprintPromptOverride(
  blueprintId: string,
  promptId: string,
  override: StorySessionPromptOverride,
  now = new Date().toISOString(),
): Promise<SessionBlueprint> {
  const blueprint = await getStoryBlueprint(blueprintId);
  if (!blueprint) {
    throw new Error(`SessionBlueprint not found: ${blueprintId}`);
  }
  const messages = blueprint.promptStack.messages.map((message) =>
    message.id === promptId
      ? {
        ...message,
        enabled: override.enabled ?? message.enabled,
        content: override.content ?? message.content,
      }
      : message,
  );
  const next: SessionBlueprint = {
    ...blueprint,
    promptStack: { ...blueprint.promptStack, messages },
  };
  await saveStoryBlueprint(next, now);
  return next;
}
