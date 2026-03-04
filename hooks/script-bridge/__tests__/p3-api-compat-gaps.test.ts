import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiCallContext } from "../types";

const mocks = vi.hoisted(() => ({
  importPresetFromJson: vi.fn(),
  importWorldBookFromJson: vi.fn(),
  importDialogueJsonl: vi.fn(),
  canImportRegexScripts: vi.fn(),
  importRegexScripts: vi.fn(),
  updateRegexScripts: vi.fn(),
  getRegexScriptsBySource: vi.fn(),
  getAllRegexScriptsForProcessing: vi.fn(),
  getRegexScriptSettings: vi.fn(),
  processRegexFullContext: vi.fn(),
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
    getScriptsBySource: mocks.getRegexScriptsBySource,
    getAllScriptsForProcessing: mocks.getAllRegexScriptsForProcessing,
    getRegexScriptSettings: mocks.getRegexScriptSettings,
  },
}));

vi.mock("@/lib/core/regex-processor", () => ({
  RegexPlacement: {
    USER_INPUT: 1,
    AI_OUTPUT: 2,
    SLASH_COMMAND: 3,
    WORLD_INFO: 5,
    REASONING: 6,
  },
  RegexProcessor: {
    processFullContext: mocks.processRegexFullContext,
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

  it("supports extension discovery APIs and keeps host status deterministic", () => {
    expect(compatHandlers.isAdmin([], createMockContext())).toBe(false);
    expect(compatHandlers.getTavernHelperExtensionId([], createMockContext())).toBe("JS-Slash-Runner");

    expect(compatHandlers.getExtensionType(["JS-Slash-Runner"], createMockContext())).toBe("system");
    expect(compatHandlers.getExtensionType(["DreamMiniStage"], createMockContext())).toBe("system");
    expect(compatHandlers.getExtensionType(["unknown-extension"], createMockContext())).toBeNull();

    expect(compatHandlers.isInstalledExtension(["JS-Slash-Runner"], createMockContext())).toBe(true);
    expect(compatHandlers.isInstalledExtension(["unknown-extension"], createMockContext())).toBe(false);

    expect(compatHandlers.getExtensionStatus(["JS-Slash-Runner"], createMockContext())).toEqual({
      current_branch_name: "host-mode",
      current_commit_hash: expect.any(String),
      is_up_to_date: true,
      remote_url: "dreamministage://extensions/JS-Slash-Runner",
    });
    expect(compatHandlers.getExtensionStatus(["unknown-extension"], createMockContext())).toBeNull();
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

    expect(() => compatHandlers.installExtension([], createMockContext()))
      .toThrow("not supported");

    expect(() => compatHandlers.uninstallExtension([], createMockContext()))
      .toThrow("not supported");

    expect(() => compatHandlers.reinstallExtension([], createMockContext()))
      .toThrow("not supported");

    expect(() => compatHandlers.updateExtension([], createMockContext()))
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

  it("provides util macro APIs with deterministic fail-fast guards", () => {
    const macroContext = createMockContext({
      characterId: "char-macro",
      messages: [
        { id: "m1", role: "user", content: "hello" },
        { id: "m2", role: "assistant", content: "world" },
      ],
      getVariablesSnapshot: () => ({
        global: {
          foo: "globalFoo",
          ignoreMe: { nested: true },
        },
        character: {
          "char-macro": {
            bar: "characterBar",
            count: 3,
          },
        },
      }),
    });

    expect(compatHandlers.substitudeMacros(
      ["{{foo}}-{{bar}}-{{lastMessageId}}-{{lastUserMessage}}"],
      macroContext,
    )).toBe("globalFoo-characterBar-1-hello");

    expect(compatHandlers.getLastMessageId([], macroContext)).toBe(1);
    expect(compatHandlers.getLastMessageId([], createMockContext({ messages: [] }))).toBeNull();

    expect(compatHandlers.getMessageId(["TH-message--12--99"], macroContext)).toBe(12);

    expect(() => compatHandlers.substitudeMacros([123], macroContext))
      .toThrow("requires text string");

    expect(() => compatHandlers.getMessageId(["iframe_123"], macroContext))
      .toThrow("无法从 iframe 名称解析消息 id");
  });

  it("formats regexed string through processor and validates source/destination", async () => {
    mocks.processRegexFullContext.mockResolvedValueOnce({
      originalText: "hello",
      replacedText: "HELLO",
      appliedScripts: ["r1"],
      success: true,
    });

    await expect(compatHandlers.formatAsTavernRegexedString(
      ["hello", "user_input", "display", { depth: 2, character_name: "Alice" }],
      createMockContext({ characterId: "char-regex" }),
    )).resolves.toBe("HELLO");

    expect(mocks.processRegexFullContext).toHaveBeenCalledWith("hello", expect.objectContaining({
      ownerId: "char-regex",
      placement: 1,
      isMarkdown: true,
      isPrompt: false,
      depth: 2,
      macroParams: expect.objectContaining({
        char: "Alice",
      }),
    }));

    await expect(compatHandlers.formatAsTavernRegexedString(
      ["hello", "bad-source", "display"],
      createMockContext(),
    )).rejects.toThrow("source is invalid");
  });

  it("exposes tavern regex list with scope and enable_state filter", async () => {
    mocks.getAllRegexScriptsForProcessing.mockResolvedValueOnce([
      {
        id: "g1",
        scriptKey: "global_one",
        scriptName: "Global One",
        findRegex: "foo",
        replaceString: "bar",
        placement: [1, 2],
        source: "global",
        disabled: false,
        runOnEdit: false,
      },
      {
        id: "c1",
        scriptKey: "char_one",
        scriptName: "Char One",
        findRegex: "baz",
        replaceString: "qux",
        placement: [3],
        source: "character",
        disabled: true,
        runOnEdit: true,
      },
    ]);

    const regexes = await compatHandlers.getTavernRegexes(
      [{ scope: "all", enable_state: "disabled" }],
      createMockContext({ characterId: "char-regex" }),
    ) as Array<Record<string, unknown>>;

    expect(regexes).toEqual([
      expect.objectContaining({
        id: "c1",
        script_name: "Char One",
        enabled: false,
        scope: "character",
        run_on_edit: true,
      }),
    ]);
    expect(mocks.getAllRegexScriptsForProcessing).toHaveBeenCalledWith("char-regex", {
      includeGlobal: true,
    });

    await expect(compatHandlers.getTavernRegexes(
      [{ scope: "character" }],
      createMockContext({ characterId: undefined }),
    )).rejects.toThrow("scope=character requires characterId");
  });

  it("reads character regex enable state from settings", async () => {
    mocks.getRegexScriptSettings.mockResolvedValueOnce({ enabled: true });
    await expect(compatHandlers.isCharacterTavernRegexesEnabled(
      [],
      createMockContext({ characterId: "char-enabled" }),
    )).resolves.toBe(true);
    expect(mocks.getRegexScriptSettings).toHaveBeenCalledWith("char-enabled");

    await expect(compatHandlers.isCharacterTavernRegexesEnabled(
      [],
      createMockContext({ characterId: undefined }),
    )).resolves.toBe(false);
  });
});
