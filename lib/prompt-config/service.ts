import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import { PresetOperations } from "@/lib/data/roleplay/preset-operation";
import { syncModelConfigToStorage } from "@/lib/model-runtime";
import type { Preset } from "@/lib/models/preset-model";
import { findBuiltInContextPreset } from "@/lib/prompt-config/catalog";
import {
  applyPresetPromptDefaults,
  buildEffectivePromptConfigSummary,
  buildPromptNames,
  normalizeContextPreset,
  normalizeStopStrings,
  normalizeSyspromptState,
  resolveEffectivePostProcessingMode,
  type PromptBehaviorState,
  type PromptBehaviorSyspromptState,
  type ResolvedPromptRuntimeConfig,
} from "@/lib/prompt-config/state";
import { useModelStore } from "@/lib/store/model-store";
import { getPromptConfigSnapshot, usePromptConfigStore } from "@/lib/store/prompt-config-store";

const MODEL_STORAGE_KEY = "dreamministage.current-model";

export interface PromptPresetInfo {
  name: string;
  type: "openai";
}

export interface PromptEntryState {
  identifier: string;
  name: string;
  enabled: boolean;
}

export interface PromptEntryStateUpdate {
  identifier: string;
  enabled: boolean;
}

function isEnabledPreset(preset: Preset | null | undefined): preset is Preset {
  if (!preset || !preset.id) {
    return false;
  }
  return preset.enabled !== false;
}

function syncPromptPresetStore(preset: Preset | null): void {
  const store = usePromptConfigStore.getState();
  if (preset && preset.id) {
    store.setActivePreset(preset);
    return;
  }
  store.clearActivePreset();
}

async function updateEnabledPresetFlags(targetId: string): Promise<Preset | null> {
  const presets = await PresetOperations.getAllPresets();
  const target = presets.find((preset) => preset.id === targetId);
  if (!target?.id) {
    return null;
  }

  for (const preset of presets) {
    if (!preset.id) {
      continue;
    }
    const enabled = preset.id === target.id;
    if ((preset.enabled !== false) !== enabled) {
      await PresetOperations.updatePreset(preset.id, { enabled });
    }
  }

  return {
    ...target,
    enabled: true,
  };
}

function getActiveModelConfig() {
  const { configs, activeConfigId, getActiveConfig } = useModelStore.getState();
  return getActiveConfig?.() || configs.find((config) => config.id === activeConfigId) || configs[0];
}

function toPromptEntryState(prompt: Preset["prompts"][number]): PromptEntryState | null {
  const identifier = (prompt.identifier || "").trim();
  if (!identifier) {
    return null;
  }

  const normalizedName = (prompt.name || identifier).trim();
  return {
    identifier,
    name: normalizedName || identifier,
    enabled: prompt.enabled !== false,
  };
}

function syncActivePresetIfNeeded(
  snapshot: PromptBehaviorState,
  activePreset: Preset | null,
): {
  activePresetId: string | null;
  activePresetName: string | null;
} {
  const useSnapshotPreset = Boolean(snapshot.activePresetId && activePreset?.id === snapshot.activePresetId);
  if (useSnapshotPreset || !activePreset) {
    return {
      activePresetId: useSnapshotPreset ? snapshot.activePresetId : activePreset?.id || null,
      activePresetName: useSnapshotPreset
        ? snapshot.activePresetName || activePreset?.name || null
        : activePreset?.name || null,
    };
  }

  const defaults = applyPresetPromptDefaults(activePreset);
  usePromptConfigStore.setState((state) => ({
    ...state,
    ...defaults,
  }));

  return {
    activePresetId: defaults.activePresetId,
    activePresetName: defaults.activePresetName,
  };
}

export async function getPromptPresetById(presetId?: string | null): Promise<Preset | null> {
  const target = (presetId || "").trim();
  if (!target) {
    return null;
  }
  return PresetOperations.getPreset(target);
}

export async function getActivePromptPreset(): Promise<Preset | null> {
  const snapshot = getPromptConfigSnapshot();
  const byId = await getPromptPresetById(snapshot.activePresetId);
  if (isEnabledPreset(byId)) {
    if (snapshot.activePresetName !== byId.name) {
      usePromptConfigStore.setState((state) => ({
        ...state,
        activePresetName: byId.name,
      }));
    }
    return byId;
  }

  const presets = await PresetOperations.getAllPresets();
  const activePreset = presets.find((preset) => isEnabledPreset(preset)) || null;
  if (activePreset || snapshot.activePresetId) {
    syncPromptPresetStore(activePreset);
  }
  return activePreset;
}

export async function selectPromptPresetById(presetId: string): Promise<Preset> {
  const target = await updateEnabledPresetFlags(presetId);
  if (!target) {
    throw new Error(`preset not found: ${presetId}`);
  }

  usePromptConfigStore.getState().setActivePreset(target);
  return target;
}

export async function selectPromptPresetByName(name: string): Promise<Preset> {
  const presets = await PresetOperations.getAllPresets();
  const targetName = name.trim();
  const target = presets.find((preset) => preset.name === targetName || preset.id === targetName);
  if (!target?.id) {
    throw new Error(`preset not found: ${targetName}`);
  }
  return selectPromptPresetById(target.id);
}

export function selectPromptContextPreset(name?: string): string {
  const trimmed = (name || "").trim();
  const store = usePromptConfigStore.getState();

  if (!trimmed) {
    return store.context.name;
  }

  const preset = findBuiltInContextPreset(trimmed);
  if (!preset) {
    throw new Error(`/context preset not found: ${trimmed}`);
  }

  store.replaceContext(preset);
  return preset.name;
}

export function getPromptInstructState() {
  return usePromptConfigStore.getState().instruct;
}

export function updatePromptInstructState(patch: {
  enabled?: boolean;
  preset?: string;
}) {
  return usePromptConfigStore.getState().setInstruct(patch);
}

export function getPromptPostProcessingValue(): string {
  return usePromptConfigStore.getState().promptPostProcessing;
}

export function setPromptPostProcessingValue(value: string): string {
  return usePromptConfigStore.getState().setPromptPostProcessing(value as PromptBehaviorState["promptPostProcessing"]);
}

export function getPromptStopStrings(): string[] {
  return usePromptConfigStore.getState().stopStrings;
}

export function setPromptStopStrings(stopStrings: string[]): string[] {
  return usePromptConfigStore.getState().setStopStrings(stopStrings);
}

export function getPromptSyspromptState(): PromptBehaviorSyspromptState {
  return usePromptConfigStore.getState().sysprompt;
}

export function setPromptSyspromptState(patch: Partial<PromptBehaviorSyspromptState>): PromptBehaviorSyspromptState {
  return usePromptConfigStore.getState().setSysprompt(patch);
}

export function getActiveModel(): string {
  const active = getActiveModelConfig();
  if (!active) {
    throw new Error("/model requires an active model preset");
  }
  return active.model;
}

export function setActiveModel(model: string): string {
  const nextModel = model.trim();
  if (!nextModel) {
    throw new Error("/model requires model name");
  }

  const { updateConfig } = useModelStore.getState();
  const active = getActiveModelConfig();
  if (!active) {
    throw new Error("/model requires an active model preset");
  }

  updateConfig(active.id, { model: nextModel });
  syncModelConfigToStorage({ ...active, model: nextModel });
  return nextModel;
}

function readModelFallback(): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return (window.localStorage.getItem(MODEL_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

function writeModelFallback(model: string): string {
  if (typeof window === "undefined") {
    return model;
  }

  try {
    window.localStorage.setItem(MODEL_STORAGE_KEY, model);
  } catch {
    // ignore storage failures and still return normalized value
  }

  return model;
}

export function getPromptModelValue(): string {
  try {
    return getActiveModel();
  } catch {
    return readModelFallback();
  }
}

export function setPromptModelValue(model: string): string {
  const nextModel = model.trim();
  if (!nextModel) {
    throw new Error("/model requires model name");
  }

  try {
    return setActiveModel(nextModel);
  } catch {
    return writeModelFallback(nextModel);
  }
}

export async function getActivePromptPresetInfo(): Promise<PromptPresetInfo | undefined> {
  const active = await getActivePromptPreset();
  return active ? { name: active.name, type: "openai" } : undefined;
}

export async function listPromptPresets(): Promise<PromptPresetInfo[]> {
  const presets = await PresetOperations.getAllPresets();
  return presets.map((preset) => ({ name: preset.name, type: "openai" as const }));
}

export async function listPromptEntries(): Promise<PromptEntryState[]> {
  const active = await getActivePromptPreset();
  if (!active) {
    return [];
  }

  return (active.prompts || [])
    .map((prompt) => toPromptEntryState(prompt))
    .filter((entry): entry is PromptEntryState => !!entry);
}

export async function setPromptEntriesEnabled(
  updates: PromptEntryStateUpdate[],
): Promise<void> {
  if (updates.length === 0) {
    return;
  }

  const active = await getActivePromptPreset();
  if (!active?.id) {
    throw new Error("active preset is not available");
  }

  const enabledMap = new Map(updates.map((item) => [item.identifier, item.enabled] as const));
  const nextPrompts = (active.prompts || []).map((prompt) => {
    const identifier = (prompt.identifier || "").trim();
    if (!identifier || !enabledMap.has(identifier)) {
      return prompt;
    }
    return {
      ...prompt,
      enabled: enabledMap.get(identifier),
    };
  });

  const saved = await PresetOperations.updatePreset(active.id, { prompts: nextPrompts });
  if (!saved) {
    throw new Error("failed to update prompt entries");
  }
}

function resolveRuntimeContext(
  snapshot: PromptBehaviorState,
  activePreset: Preset | null,
) {
  if (!activePreset) {
    return normalizeContextPreset(snapshot.context);
  }

  if (snapshot.activePresetId && activePreset.id === snapshot.activePresetId) {
    return normalizeContextPreset(snapshot.context);
  }

  return normalizeContextPreset(activePreset.context);
}

function resolveRuntimeSysprompt(
  snapshot: PromptBehaviorState,
  activePreset: Preset | null,
): PromptBehaviorSyspromptState {
  if (!activePreset) {
    return normalizeSyspromptState(snapshot.sysprompt);
  }

  if (snapshot.activePresetId && activePreset.id === snapshot.activePresetId) {
    return normalizeSyspromptState(snapshot.sysprompt);
  }

  return normalizeSyspromptState(activePreset.sysprompt);
}

function deriveContextStopStrings(
  contextPreset: PromptBehaviorState["context"],
  promptNames: ReturnType<typeof buildPromptNames>,
): string[] {
  if (!contextPreset.use_stop_strings || !contextPreset.names_as_stop_strings) {
    return [];
  }

  const names = [
    promptNames.charName,
    promptNames.userName,
    ...promptNames.groupNames,
  ];

  return names
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .map((name) => `${name}:`);
}

export async function resolvePromptRuntimeConfig(input: {
  characterId: string;
  username?: string;
}): Promise<ResolvedPromptRuntimeConfig> {
  const { characterId, username } = input;
  const activePreset = await getActivePromptPreset();
  const snapshot = getPromptConfigSnapshot();
  const character = await LocalCharacterRecordOperations.getCharacterById(characterId);
  const charName = character?.data?.data?.name || character?.data?.name || characterId;
  const userName = username?.trim() || "用户";
  const contextPreset = resolveRuntimeContext(snapshot, activePreset);
  const sysprompt = resolveRuntimeSysprompt(snapshot, activePreset);
  const promptNames = buildPromptNames(charName, userName);
  const stopStrings = normalizeStopStrings([
    ...snapshot.stopStrings,
    ...deriveContextStopStrings(contextPreset, promptNames),
  ]);
  const syncedPreset = syncActivePresetIfNeeded(snapshot, activePreset);
  const effectiveState: PromptBehaviorState = {
    ...snapshot,
    activePresetId: syncedPreset.activePresetId,
    activePresetName: syncedPreset.activePresetName,
    context: contextPreset,
    sysprompt,
    stopStrings,
  };

  return {
    activePresetId: effectiveState.activePresetId,
    contextPreset,
    sysprompt,
    stopStrings,
    promptNames,
    postProcessingMode: resolveEffectivePostProcessingMode(effectiveState),
    effectiveConfig: buildEffectivePromptConfigSummary(effectiveState),
  };
}
