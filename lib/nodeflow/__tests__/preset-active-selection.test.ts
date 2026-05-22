import { beforeEach, describe, expect, it, vi } from "vitest";

const getCharacterById = vi.fn();
const getAllPresets = vi.fn();
const getPreset = vi.fn();
const retrieve = vi.fn();
const isEnabled = vi.fn();
const getEvaluatorForDialogue = vi.fn();
const persistVariables = vi.fn();
const loadWorldBooksFromSources = vi.fn();

vi.mock("@/lib/data/roleplay/character-record-operation", () => ({
  LocalCharacterRecordOperations: {
    getCharacterById: (...args: unknown[]) => getCharacterById(...args),
  },
}));

vi.mock("@/lib/data/roleplay/preset-operation", () => ({
  PresetOperations: {
    getAllPresets: (...args: unknown[]) => getAllPresets(...args),
    getPreset: (...args: unknown[]) => getPreset(...args),
  },
}));

vi.mock("@/lib/vector-memory/manager", () => ({
  getVectorMemoryManager: () => ({
    retrieve: (...args: unknown[]) => retrieve(...args),
    isEnabled: (...args: unknown[]) => isEnabled(...args),
  }),
}));

vi.mock("@/lib/core/macro-evaluator-manager", () => ({
  getEvaluatorForDialogue: (...args: unknown[]) => getEvaluatorForDialogue(...args),
  persistVariables: (...args: unknown[]) => persistVariables(...args),
}));

vi.mock("@/lib/core/world-book-cascade-loader", () => ({
  loadWorldBooksFromSources: (...args: unknown[]) => loadWorldBooksFromSources(...args),
}));

import { PresetNodeTools } from "@/lib/nodeflow/PresetNode/PresetNodeTools";

describe("PresetNodeTools runtime preset selection", () => {
  beforeEach(() => {
    getCharacterById.mockReset();
    getAllPresets.mockReset();
    getPreset.mockReset();
    retrieve.mockReset();
    isEnabled.mockReset();
    getEvaluatorForDialogue.mockReset();
    persistVariables.mockReset();
    loadWorldBooksFromSources.mockReset();

    getCharacterById.mockResolvedValue({
      data: {
        name: "Alice",
        description: "",
        personality: "",
        scenario: "",
        mes_example: "",
      },
    });
    retrieve.mockResolvedValue({ formattedText: "" });
    isEnabled.mockReturnValue(false);
    getEvaluatorForDialogue.mockResolvedValue({
      evaluate: (text: string) => text,
    });
    persistVariables.mockResolvedValue(undefined);
    loadWorldBooksFromSources.mockResolvedValue({ wiBefore: "", wiAfter: "" });
  });

  it("uses the runtime selected preset instead of silently falling back to another enabled preset", async () => {
    const enabledPreset = {
      id: "preset-enabled",
      name: "Enabled Preset",
      enabled: true,
      prompts: [
        { identifier: "main", name: "Main", role: "system", content: "ENABLED_MAIN", enabled: true },
        { identifier: "chatHistory", name: "History", marker: true, enabled: true },
      ],
      sampling: {},
    };

    const runtimeSelectedPreset = {
      id: "preset-runtime",
      name: "Runtime Preset",
      enabled: false,
      prompts: [
        { identifier: "main", name: "Main", role: "system", content: "RUNTIME_MAIN", enabled: true },
        { identifier: "chatHistory", name: "History", marker: true, enabled: true },
      ],
      sampling: {},
    };

    getAllPresets.mockResolvedValue([enabledPreset]);
    getPreset.mockImplementation(async (presetId: string) => {
      if (presetId === "preset-runtime") {
        return runtimeSelectedPreset;
      }
      if (presetId === "preset-enabled") {
        return enabledPreset;
      }
      return null;
    });

    const result = await PresetNodeTools.buildPromptFramework(
      "char-1",
      "zh",
      "User",
      undefined,
      200,
      false,
      "none",
      "dialogue-1",
      "HELLO",
      [],
      undefined,
      undefined,
      {
        charName: "Alice",
        userName: "User",
        groupNames: [],
        startsWithGroupName: () => false,
      },
      "none" as never,
      "preset-runtime",
    );

    expect(result.presetId).toBe("preset-runtime");
    expect(result.messages[0]?.content).toContain("RUNTIME_MAIN");
  });
});
