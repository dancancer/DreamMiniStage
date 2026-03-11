import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Preset } from "@/lib/models/preset-model";
import {
  applyPresetPromptDefaults,
  buildEffectivePromptConfigSummary,
  createDefaultPromptBehaviorState,
  normalizeContextPreset,
  normalizePromptPostProcessing,
  normalizeStopStrings,
  normalizeSyspromptState,
  type EffectivePromptConfigSummary,
  type PromptBehaviorInstructState,
  type PromptBehaviorState,
  type PromptBehaviorSyspromptState,
} from "@/lib/prompt-config/state";
import type { PostProcessingMode, STContextPreset } from "@/lib/core/st-preset-types";

interface PromptConfigStore extends PromptBehaviorState {
  setActivePreset: (preset?: Preset | null) => void;
  clearActivePreset: () => void;
  setInstruct: (patch: Partial<PromptBehaviorInstructState>) => PromptBehaviorInstructState;
  setContext: (patch: Partial<STContextPreset>) => STContextPreset;
  replaceContext: (context: STContextPreset) => STContextPreset;
  setSysprompt: (patch: Partial<PromptBehaviorSyspromptState>) => PromptBehaviorSyspromptState;
  setStopStrings: (stopStrings: string[]) => string[];
  setPromptPostProcessing: (mode: PostProcessingMode) => PostProcessingMode;
  getEffectiveConfig: () => EffectivePromptConfigSummary;
}

const DEFAULT_STATE = createDefaultPromptBehaviorState();

export const usePromptConfigStore = create<PromptConfigStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,
      setActivePreset: (preset) => {
        const next = applyPresetPromptDefaults(preset);
        set(next);
      },
      clearActivePreset: () => {
        set({
          activePresetId: null,
          activePresetName: null,
          context: DEFAULT_STATE.context,
          sysprompt: DEFAULT_STATE.sysprompt,
        });
      },
      setInstruct: (patch) => {
        const next = {
          enabled: patch.enabled ?? get().instruct.enabled,
          preset: typeof patch.preset === "string"
            ? patch.preset.trim() || null
            : get().instruct.preset,
        };
        set({ instruct: next });
        return next;
      },
      setContext: (patch) => {
        const next = normalizeContextPreset({
          ...get().context,
          ...patch,
        });
        set({ context: next });
        return next;
      },
      replaceContext: (context) => {
        const next = normalizeContextPreset(context);
        set({ context: next });
        return next;
      },
      setSysprompt: (patch) => {
        const current = get().sysprompt;
        const next = normalizeSyspromptState({
          ...current,
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.content !== undefined ? { content: patch.content } : {}),
          ...(patch.post_history !== undefined ? { post_history: patch.post_history } : {}),
        });
        set({ sysprompt: next });
        return next;
      },
      setStopStrings: (stopStrings) => {
        const next = normalizeStopStrings(stopStrings);
        set({ stopStrings: next });
        return next;
      },
      setPromptPostProcessing: (mode) => {
        const next = normalizePromptPostProcessing(mode);
        set({ promptPostProcessing: next });
        return next;
      },
      getEffectiveConfig: () => {
        const state = get();
        return buildEffectivePromptConfigSummary(state);
      },
    }),
    {
      name: "prompt-config-storage",
      partialize: (state) => ({
        activePresetId: state.activePresetId,
        activePresetName: state.activePresetName,
        instruct: state.instruct,
        context: state.context,
        sysprompt: state.sysprompt,
        stopStrings: state.stopStrings,
        promptPostProcessing: state.promptPostProcessing,
      }),
    },
  ),
);

export function getPromptConfigSnapshot(): PromptBehaviorState {
  const state = usePromptConfigStore.getState();
  return {
    activePresetId: state.activePresetId,
    activePresetName: state.activePresetName,
    instruct: state.instruct,
    context: state.context,
    sysprompt: state.sysprompt,
    stopStrings: state.stopStrings,
    promptPostProcessing: state.promptPostProcessing,
  };
}
