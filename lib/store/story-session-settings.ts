import { create } from "zustand";
import type { ModelAdvancedSettings } from "@/lib/model-runtime";
import type { SessionBlueprint } from "@/lib/story-agent/blueprint";
import type {
  StorySessionPromptOverride,
  StorySessionSettings,
} from "@/lib/story-agent/runtime/story-session";
import {
  getStoryBlueprint,
  getStorySession,
  setStoryBlueprintPromptOverride,
  updateStoryBlueprintModelPolicy,
  updateStorySessionSettings,
} from "@/lib/story-agent/session";

// 当前打开会话的分层设置（会话 > 导入预设 > 全局默认）。给侧栏「会话设置」面板绑定，
// 同时给派发层提供 modelConfigId（覆盖 active 模型）。actions 直接落 IndexedDB 并回写 store。

/** UI 列表用：预设提示词条目的当前有效形态。 */
export interface StoryPromptEntryView {
  id: string;
  role: string;
  enabled: boolean;
  content: string;
  sourcePath?: string;
}

interface StorySessionSettingsState {
  dialogueId: string | null;
  blueprintId: string | null;
  settings: StorySessionSettings;
  promptEntries: StoryPromptEntryView[];
  loading: boolean;
  /** 当前会话锁定的模型配置 id（无则用 active）。供派发层读取。 */
  modelConfigId: string | undefined;

  load: (dialogueId: string) => Promise<void>;
  reset: () => void;
  /** 会话级采样覆盖（仅本会话）。 */
  setSessionSampling: (patch: Partial<ModelAdvancedSettings>) => Promise<void>;
  /** 会话级锁定模型配置（仅本会话）。 */
  setSessionModelConfig: (modelConfigId: string | undefined) => Promise<void>;
  /** 会话级提示词覆盖（仅本会话）。 */
  setSessionPromptOverride: (promptId: string, override: StorySessionPromptOverride) => Promise<void>;
  /** 预设级采样改写（该角色所有会话）。 */
  setPresetSampling: (patch: Partial<ModelAdvancedSettings>) => Promise<void>;
  /** 预设级提示词改写（该角色所有会话）。 */
  setPresetPromptOverride: (promptId: string, override: StorySessionPromptOverride) => Promise<void>;
}

const EMPTY_SETTINGS: StorySessionSettings = {};

function toPromptEntries(blueprint: SessionBlueprint): StoryPromptEntryView[] {
  return blueprint.promptStack.messages.map((message) => ({
    id: message.id,
    role: message.role,
    enabled: message.enabled,
    content: message.content,
    sourcePath: message.sourcePath,
  }));
}

export const useStorySessionSettings = create<StorySessionSettingsState>((set, get) => ({
  dialogueId: null,
  blueprintId: null,
  settings: EMPTY_SETTINGS,
  promptEntries: [],
  loading: false,
  modelConfigId: undefined,

  load: async (dialogueId) => {
    set({ loading: true });
    try {
      const session = await getStorySession(dialogueId);
      if (!session) {
        set({ dialogueId, blueprintId: null, settings: EMPTY_SETTINGS, promptEntries: [], loading: false, modelConfigId: undefined });
        return;
      }
      const blueprint = await getStoryBlueprint(session.blueprintId);
      set({
        dialogueId,
        blueprintId: session.blueprintId,
        settings: session.settings ?? EMPTY_SETTINGS,
        promptEntries: blueprint ? toPromptEntries(blueprint) : [],
        modelConfigId: session.settings?.modelConfigId,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  reset: () => set({
    dialogueId: null,
    blueprintId: null,
    settings: EMPTY_SETTINGS,
    promptEntries: [],
    loading: false,
    modelConfigId: undefined,
  }),

  setSessionSampling: async (patch) => {
    const { dialogueId } = get();
    if (!dialogueId) return;
    const next = await updateStorySessionSettings(dialogueId, { modelPolicy: patch });
    set({ settings: next.settings ?? EMPTY_SETTINGS, modelConfigId: next.settings?.modelConfigId });
  },

  setSessionModelConfig: async (modelConfigId) => {
    const { dialogueId } = get();
    if (!dialogueId) return;
    const next = await updateStorySessionSettings(dialogueId, { modelConfigId });
    set({ settings: next.settings ?? EMPTY_SETTINGS, modelConfigId: next.settings?.modelConfigId });
  },

  setSessionPromptOverride: async (promptId, override) => {
    const { dialogueId } = get();
    if (!dialogueId) return;
    const next = await updateStorySessionSettings(dialogueId, { promptOverrides: { [promptId]: override } });
    set({ settings: next.settings ?? EMPTY_SETTINGS });
  },

  setPresetSampling: async (patch) => {
    const { blueprintId } = get();
    if (!blueprintId) return;
    await updateStoryBlueprintModelPolicy(blueprintId, patch);
  },

  setPresetPromptOverride: async (promptId, override) => {
    const { blueprintId } = get();
    if (!blueprintId) return;
    const blueprint = await setStoryBlueprintPromptOverride(blueprintId, promptId, override);
    set({ promptEntries: toPromptEntries(blueprint) });
  },
}));
