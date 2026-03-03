import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiCallContext } from "../types";

const mocks = vi.hoisted(() => ({
  importPresetFromJson: vi.fn(),
  importWorldBookFromJson: vi.fn(),
  importDialogueJsonl: vi.fn(),
  canImportRegexScripts: vi.fn(),
  importRegexScripts: vi.fn(),
  updateRegexScripts: vi.fn(),
  getScriptButtons: vi.fn(),
}));

vi.mock("@/function/preset/import", () => ({
  importPresetFromJson: mocks.importPresetFromJson,
}));

vi.mock("@/function/worldbook/import", () => ({
  importWorldBookFromJson: mocks.importWorldBookFromJson,
}));

vi.mock("@/function/dialogue/jsonl", () => ({
  importDialogueJsonl: mocks.importDialogueJsonl,
}));

vi.mock("@/lib/adapters/import", () => ({
  canImportRegexScripts: mocks.canImportRegexScripts,
  importRegexScripts: mocks.importRegexScripts,
}));

vi.mock("@/lib/data/roleplay/regex-script-operation", () => ({
  RegexScriptOperations: {
    updateRegexScripts: mocks.updateRegexScripts,
  },
}));

vi.mock("@/lib/script-runner/script-storage", () => ({
  getScriptButtons: mocks.getScriptButtons,
}));

import { compatHandlers } from "../compat-handlers";

function createMockContext(overrides: Partial<ApiCallContext> = {}): ApiCallContext {
  return {
    characterId: "char-p3-test",
    dialogueId: "dialogue-p3-test",
    presetName: "preset-p3-test",
    messages: [],
    setScriptVariable: vi.fn(),
    deleteScriptVariable: vi.fn(),
    getVariablesSnapshot: () => ({
      global: {},
      character: {},
    }),
    ...overrides,
  };
}

describe("P3 compat API gaps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns grouped enabled script buttons", () => {
    mocks.getScriptButtons.mockReturnValue([
      { id: "b1", scriptId: "s1", label: "A", visible: true, order: 0 },
      { id: "b2", scriptId: "s1", label: "B", visible: true, order: 1 },
      { id: "b3", scriptId: "s2", label: "C", visible: true, order: 2 },
    ]);

    const grouped = compatHandlers.getAllEnabledScriptButtons([], createMockContext()) as Record<
      string,
      Array<{ button_id: string; button_name: string }>
    >;

    expect(mocks.getScriptButtons).toHaveBeenCalledWith({
      characterId: "char-p3-test",
      presetId: "preset-p3-test",
    });
    expect(grouped).toEqual({
      s1: [
        { button_id: "b1", button_name: "A" },
        { button_id: "b2", button_name: "B" },
      ],
      s2: [
        { button_id: "b3", button_name: "C" },
      ],
    });
  });

  it("imports raw preset and fails fast on import error", async () => {
    mocks.importPresetFromJson.mockResolvedValueOnce({ success: true });
    await expect(compatHandlers.importRawPreset(
      ["PresetA", { temperature: 0.7 }],
      createMockContext(),
    )).resolves.toBe(true);
    expect(mocks.importPresetFromJson).toHaveBeenCalledWith(
      JSON.stringify({ temperature: 0.7 }),
      "PresetA",
    );

    mocks.importPresetFromJson.mockResolvedValueOnce({ success: false, error: "bad preset" });
    await expect(compatHandlers.importRawPreset(
      ["PresetB", { broken: true }],
      createMockContext(),
    )).rejects.toThrow("bad preset");
  });

  it("imports raw worldbook and validates context/content", async () => {
    mocks.importWorldBookFromJson.mockResolvedValueOnce({ success: true, message: "ok" });

    await expect(compatHandlers.importRawWorldbook(
      ["WB", "{\"entries\":[]}"],
      createMockContext({ characterId: "char-1" }),
    )).resolves.toBe(true);
    expect(mocks.importWorldBookFromJson).toHaveBeenCalledWith("char-1", { entries: [] });

    await expect(compatHandlers.importRawWorldbook(
      ["WB", "{}"],
      createMockContext({ characterId: undefined }),
    )).rejects.toThrow("requires characterId");
  });

  it("imports tavern regex scripts and validates payload", async () => {
    mocks.canImportRegexScripts.mockReturnValueOnce(true);
    mocks.importRegexScripts.mockReturnValueOnce([
      { findRegex: "foo", scriptName: "" },
    ]);
    mocks.updateRegexScripts.mockResolvedValueOnce(true);

    await expect(compatHandlers.importRawTavernRegex(
      ["RegexPack", { scripts: [{ findRegex: "foo", replaceString: "bar" }] }],
      createMockContext({ characterId: "char-2" }),
    )).resolves.toBe(true);
    expect(mocks.updateRegexScripts).toHaveBeenCalledWith(
      "char-2",
      expect.arrayContaining([
        expect.objectContaining({ scriptName: "RegexPack" }),
      ]),
    );

    mocks.canImportRegexScripts.mockReturnValueOnce(false);
    await expect(compatHandlers.importRawTavernRegex(
      ["RegexPack", { nope: true }],
      createMockContext(),
    )).rejects.toThrow("unsupported payload");
  });

  it("imports raw chat with strict JSONL string guard", async () => {
    mocks.importDialogueJsonl.mockResolvedValueOnce({});

    await expect(compatHandlers.importRawChat(
      ["chat.jsonl", "{\"id\":\"x\"}\n"],
      createMockContext({ characterId: "char-3", dialogueId: "dialogue-3" }),
    )).resolves.toBe(true);
    expect(mocks.importDialogueJsonl).toHaveBeenCalledWith({
      dialogueId: "dialogue-3",
      characterId: "char-3",
      jsonlText: "{\"id\":\"x\"}\n",
    });

    await expect(compatHandlers.importRawChat(
      ["chat.jsonl", { invalid: true }],
      createMockContext({ characterId: "char-3", dialogueId: "dialogue-3" }),
    )).rejects.toThrow("JSONL string content");
  });

  it("keeps unsupported import/update paths fail-fast", () => {
    expect(() => compatHandlers.importRawCharacter([], createMockContext()))
      .toThrow("not supported");

    expect(() => compatHandlers.updateTavernHelper([], createMockContext()))
      .toThrow("not supported");

    expect(() => compatHandlers.updateFrontendVersion([], createMockContext()))
      .toThrow("not supported");
  });

  it("returns stable frontend/tavern version strings", () => {
    const helperVersion = compatHandlers.getTavernHelperVersion([], createMockContext()) as string;
    const frontendVersion = compatHandlers.getFrontendVersion([], createMockContext()) as string;
    const tavernVersion = compatHandlers.getTavernVersion([], createMockContext()) as string;

    expect(helperVersion.length).toBeGreaterThan(0);
    expect(frontendVersion).toBe(helperVersion);
    expect(tavernVersion).toContain("DreamMiniStage/");
  });
});
