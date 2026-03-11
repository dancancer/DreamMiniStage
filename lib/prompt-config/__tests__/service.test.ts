import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CONTEXT_PRESET } from "@/lib/core/st-preset-types";

const getPreset = vi.fn();
const getAllPresets = vi.fn();
const updatePreset = vi.fn();
const syncModelConfigToStorage = vi.fn();
const getCharacterById = vi.fn();

vi.mock("@/lib/data/roleplay/preset-operation", () => ({
  PresetOperations: {
    getPreset: (...args: unknown[]) => getPreset(...args),
    getAllPresets: (...args: unknown[]) => getAllPresets(...args),
    updatePreset: (...args: unknown[]) => updatePreset(...args),
  },
}));

vi.mock("@/lib/data/roleplay/character-record-operation", () => ({
  LocalCharacterRecordOperations: {
    getCharacterById: (...args: unknown[]) => getCharacterById(...args),
  },
}));

vi.mock("@/lib/model-runtime", () => ({
  syncModelConfigToStorage: (...args: unknown[]) => syncModelConfigToStorage(...args),
}));

import {
  getActiveModel,
  getActivePromptPreset,
  getActivePromptPresetInfo,
  listPromptEntries,
  listPromptPresets,
  resolvePromptRuntimeConfig,
  setActiveModel,
  setPromptEntriesEnabled,
} from "@/lib/prompt-config/service";
import { createDefaultPromptBehaviorState } from "@/lib/prompt-config/state";
import { useModelStore } from "@/lib/store/model-store";
import { usePromptConfigStore } from "@/lib/store/prompt-config-store";

describe("prompt-config service", () => {
  beforeEach(() => {
    getPreset.mockReset();
    getAllPresets.mockReset();
    updatePreset.mockReset();
    syncModelConfigToStorage.mockReset();
    getCharacterById.mockReset();

    usePromptConfigStore.setState(createDefaultPromptBehaviorState());
    useModelStore.setState({
      configs: [],
      activeConfigId: "",
    });
  });

  it("ignores a cached preset id once that preset is disabled", async () => {
    usePromptConfigStore.setState({
      activePresetId: "preset-old",
      activePresetName: "Old Preset",
    });

    getPreset.mockResolvedValue({
      id: "preset-old",
      name: "Old Preset",
      enabled: false,
      prompts: [],
    });
    getAllPresets.mockResolvedValue([
      {
        id: "preset-old",
        name: "Old Preset",
        enabled: false,
        prompts: [],
      },
      {
        id: "preset-new",
        name: "New Preset",
        enabled: true,
        prompts: [],
      },
    ]);

    const activePreset = await getActivePromptPreset();

    expect(activePreset?.id).toBe("preset-new");
    expect(usePromptConfigStore.getState().activePresetId).toBe("preset-new");
    expect(usePromptConfigStore.getState().activePresetName).toBe("New Preset");
  });

  it("uses stored prompt overrides when no preset is active", async () => {
    usePromptConfigStore.setState({
      context: {
        ...DEFAULT_CONTEXT_PRESET,
        name: "Manual Context",
        story_string: "",
        example_separator: "",
        chat_start: "",
      },
      sysprompt: {
        enabled: true,
        name: "Manual Prompt",
        content: "system override",
        post_history: "post override",
      },
      stopStrings: ["STOP"],
    });

    getAllPresets.mockResolvedValue([]);
    getCharacterById.mockResolvedValue({
      data: {
        name: "角色",
      },
    });

    const runtime = await resolvePromptRuntimeConfig({
      characterId: "char-1",
      username: "用户",
    });

    expect(runtime.contextPreset).toMatchObject({
      name: "Manual Context",
      story_string: "",
      example_separator: "",
      chat_start: "",
    });
    expect(runtime.sysprompt).toMatchObject({
      enabled: true,
      name: "Manual Prompt",
      content: "system override",
      post_history: "post override",
    });
    expect(runtime.stopStrings).toEqual(["STOP"]);
    expect(runtime.effectiveConfig).toMatchObject({
      contextName: "Manual Context",
      syspromptEnabled: true,
      syspromptName: "Manual Prompt",
      stopStrings: ["STOP"],
    });
  });

  it("derives runtime stop strings from the resolved context preset", async () => {
    usePromptConfigStore.setState({
      context: {
        ...DEFAULT_CONTEXT_PRESET,
        name: "Context With Stops",
        use_stop_strings: true,
        names_as_stop_strings: true,
      },
      stopStrings: ["MANUAL_STOP"],
    });

    getAllPresets.mockResolvedValue([]);
    getCharacterById.mockResolvedValue({
      data: {
        name: "角色",
      },
    });

    const runtime = await resolvePromptRuntimeConfig({
      characterId: "char-1",
      username: "用户",
    });

    expect(runtime.stopStrings).toEqual(expect.arrayContaining([
      "MANUAL_STOP",
      "角色:",
      "用户:",
    ]));
    expect(runtime.effectiveConfig.stopStrings).toEqual(expect.arrayContaining([
      "MANUAL_STOP",
      "角色:",
      "用户:",
    ]));
  });

  it("returns the active model from the model store", () => {
    useModelStore.setState({
      configs: [
        {
          id: "config-a",
          name: "A",
          type: "openai",
          baseUrl: "https://example.com",
          model: "gpt-4.1",
        },
        {
          id: "config-b",
          name: "B",
          type: "openai",
          baseUrl: "https://example.com",
          model: "gpt-4.1-mini",
        },
      ],
      activeConfigId: "config-b",
    });

    expect(getActiveModel()).toBe("gpt-4.1-mini");
  });

  it("trims and persists the updated active model", () => {
    useModelStore.setState({
      configs: [
        {
          id: "config-a",
          name: "A",
          type: "openai",
          baseUrl: "https://example.com",
          model: "gpt-4.1",
        },
      ],
      activeConfigId: "config-a",
    });

    const result = setActiveModel("  gpt-4.1-nano  ");

    expect(result).toBe("gpt-4.1-nano");
    expect(useModelStore.getState().configs[0]?.model).toBe("gpt-4.1-nano");
    expect(syncModelConfigToStorage).toHaveBeenCalledWith(expect.objectContaining({
      id: "config-a",
      model: "gpt-4.1-nano",
    }));
  });

  it("returns the active preset info for slash hosts", async () => {
    usePromptConfigStore.setState({
      activePresetId: "preset-a",
      activePresetName: "Preset A",
    });
    getPreset.mockResolvedValue({
      id: "preset-a",
      name: "Preset A",
      enabled: true,
      prompts: [],
    });

    await expect(getActivePromptPresetInfo()).resolves.toEqual({
      name: "Preset A",
      type: "openai",
    });
  });

  it("lists prompt presets with stable slash metadata", async () => {
    getAllPresets.mockResolvedValue([
      { id: "preset-a", name: "Preset A", enabled: true, prompts: [] },
      { id: "preset-b", name: "Preset B", enabled: false, prompts: [] },
    ]);

    await expect(listPromptPresets()).resolves.toEqual([
      { name: "Preset A", type: "openai" },
      { name: "Preset B", type: "openai" },
    ]);
  });

  it("lists prompt entries from the active preset and filters blanks", async () => {
    usePromptConfigStore.setState({
      activePresetId: "preset-a",
      activePresetName: "Preset A",
    });
    getPreset.mockResolvedValue({
      id: "preset-a",
      name: "Preset A",
      enabled: true,
      prompts: [
        { identifier: "entry-a", name: " Entry A ", enabled: true },
        { identifier: " entry-b ", name: "   ", enabled: false },
        { identifier: "   ", name: "Ignored", enabled: true },
      ],
    });

    await expect(listPromptEntries()).resolves.toEqual([
      { identifier: "entry-a", name: "Entry A", enabled: true },
      { identifier: "entry-b", name: "entry-b", enabled: false },
    ]);
  });

  it("writes prompt entry enablement updates back to the active preset", async () => {
    usePromptConfigStore.setState({
      activePresetId: "preset-a",
      activePresetName: "Preset A",
    });
    getPreset.mockResolvedValue({
      id: "preset-a",
      name: "Preset A",
      enabled: true,
      prompts: [
        { identifier: "entry-a", name: "Entry A", enabled: true },
        { identifier: "entry-b", name: "Entry B", enabled: true },
      ],
    });
    updatePreset.mockResolvedValue(true);

    await setPromptEntriesEnabled([{ identifier: "entry-b", enabled: false }]);

    expect(updatePreset).toHaveBeenCalledWith("preset-a", {
      prompts: [
        { identifier: "entry-a", name: "Entry A", enabled: true },
        { identifier: "entry-b", name: "Entry B", enabled: false },
      ],
    });
  });
});
