import { beforeEach, describe, expect, it, vi } from "vitest";

const getCharacterById = vi.fn();
const getAllPresets = vi.fn();
const getPreset = vi.fn();
const retrieve = vi.fn();
const isEnabled = vi.fn();
const getEvaluatorForDialogue = vi.fn();
const persistVariables = vi.fn();
const loadWorldBookContent = vi.fn();
const getDialogueSummaryInjectionContent = vi.fn();

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

vi.mock("@/lib/core/world-book-loader", () => ({
  loadWorldBookContent: (...args: unknown[]) => loadWorldBookContent(...args),
}));

vi.mock("@/function/dialogue/dialogue-summary", () => ({
  getDialogueSummaryInjectionContent: (...args: unknown[]) => getDialogueSummaryInjectionContent(...args),
}));

import { PresetNodeTools } from "@/lib/nodeflow/PresetNode/PresetNodeTools";

describe("PresetNodeTools summary injection", () => {
  beforeEach(() => {
    getCharacterById.mockReset();
    getAllPresets.mockReset();
    getPreset.mockReset();
    retrieve.mockReset();
    isEnabled.mockReset();
    getEvaluatorForDialogue.mockReset();
    persistVariables.mockReset();
    loadWorldBookContent.mockReset();
    getDialogueSummaryInjectionContent.mockReset();

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
    loadWorldBookContent.mockResolvedValue({ wiBefore: "", wiAfter: "" });
    getDialogueSummaryInjectionContent.mockResolvedValue("[Story Summary]\n- 旧剧情摘要");
  });

  it("injects dialogue summary before recent history", async () => {
    const preset = {
      id: "preset-runtime",
      name: "Runtime Preset",
      enabled: true,
      prompts: [
        { identifier: "main", name: "Main", role: "system", content: "RUNTIME_MAIN", enabled: true },
        { identifier: "chatHistory", name: "History", marker: true, enabled: true },
      ],
      sampling: {},
    };

    getAllPresets.mockResolvedValue([preset]);
    getPreset.mockResolvedValue(preset);

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
      [
        { role: "assistant", content: "旧回复" },
      ],
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

    expect(result.messages.some((message) => message.content.includes("[Story Summary]"))).toBe(true);
  });
});
