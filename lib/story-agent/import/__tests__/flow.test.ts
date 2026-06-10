import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetSource } from "@/lib/adapters/import";

const characterOps = vi.hoisted(() => ({
  createCharacter: vi.fn(),
}));
const blobStore = vi.hoisted(() => ({
  setBlob: vi.fn(),
}));
const storySession = vi.hoisted(() => ({
  createStoryAgentCharacterData: vi.fn((blueprint) => ({
    id: blueprint.profile.id,
    name: blueprint.profile.name,
    data: {
      name: blueprint.profile.name,
      extensions: { storyBlueprintId: blueprint.id },
    },
  })),
  createStorySessionForCharacter: vi.fn(),
  saveStoryBlueprint: vi.fn(),
}));

vi.mock("@/lib/data/roleplay/character-record-operation", () => ({
  LocalCharacterRecordOperations: characterOps,
}));

vi.mock("@/lib/data/local-storage", () => blobStore);

vi.mock("@/lib/story-agent/session", () => storySession);

describe("story agent import flow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    storySession.createStorySessionForCharacter.mockResolvedValue({
      id: "session-1",
      characterId: "agent-fixture",
      name: "Fixture Session",
      createdAt: "2026-05-29T00:00:00.000Z",
      updatedAt: "2026-05-29T00:00:00.000Z",
    });
  });

  it("compiles selected ST assets into a blueprint preview", async () => {
    const { compileStoryAgentImport } = await import("../flow");
    const preview = compileStoryAgentImport(createInput());

    expect(preview.blueprint.profile.name).toBe("【Sgw】又看一集");
    expect(preview.blueprint.schemaVersion).toBe(6);
    expect(preview.summary.openingCount).toBe(11);
    expect(preview.summary.worldBookCount).toBeGreaterThan(0);
    expect(preview.summary.worldBookEntryCount).toBeGreaterThan(0);
    expect(preview.summary.regexScriptCount).toBeGreaterThan(0);
    expect(preview.confirmation.required).toBe(false);
  });

  it("commits preview as blueprint, character shell and StorySession", async () => {
    const { compileStoryAgentImport, commitStoryAgentImport } = await import("../flow");
    const preview = compileStoryAgentImport(createInput());
    const avatar = new Blob(["avatar"], { type: "image/png" });

    const result = await commitStoryAgentImport({
      blueprint: preview.blueprint,
      avatar,
    });

    expect(result.sessionId).toBe("session-1");
    expect(storySession.saveStoryBlueprint).toHaveBeenCalledWith(preview.blueprint);
    expect(characterOps.createCharacter).toHaveBeenCalledWith(
      "agent-fixture",
      expect.objectContaining({
        data: expect.objectContaining({
          extensions: expect.objectContaining({
            storyBlueprintId: preview.blueprint.id,
          }),
        }),
      }),
      "agent-fixture.png",
    );
    expect(blobStore.setBlob).toHaveBeenCalledWith("agent-fixture.png", avatar);
    expect(storySession.createStorySessionForCharacter).toHaveBeenCalledWith("agent-fixture", {
      name: undefined,
    });
  });

  it("prepares the first user turn from the imported blueprint", async () => {
    const { compileStoryAgentImport } = await import("../flow");
    const { createStorySession, prepareStoryTurn } = await import("@/lib/story-agent/runtime/story-session");
    const preview = compileStoryAgentImport(createInput());
    const session = createStorySession({
      dialogueId: "session-1",
      blueprint: preview.blueprint,
    });

    const turn = prepareStoryTurn({
      blueprint: preview.blueprint,
      session,
      userInput: "你好",
      model: {
        modelName: "gpt-test",
        apiKey: "test-key",
        contextWindow: 4096,
      },
    });

    expect(turn.runtime).toBe("story");
    expect(turn.llmConfig.messages.length).toBeGreaterThan(0);
    expect(turn.llmConfig.dialogueKey).toBe("session-1");
  });

  it("runs import QA repair: an offered high-risk patch becomes a pending confirmation", async () => {
    const { compileStoryAgentImportWithQaRepair } = await import("../flow");
    const qaModel = async (qaInput: { repairablePaths: string[] }) => ({
      patches: [
        {
          id: "p1",
          operation: "replace",
          targetPath: qaInput.repairablePaths[0],
          value: "filled description",
          reason: "fill empty description",
        },
      ],
    });
    const input = {
      characterId: "agent-qa",
      createdAt: "2026-06-10T00:00:00.000Z",
      character: {
        raw: { data: { name: "QA Card", first_mes: "hi" } },
        source: source("qa.card.json", "json-character"),
      },
    };

    const preview = await compileStoryAgentImportWithQaRepair(input, qaModel);

    expect(preview.qaRepair?.pendingConfirmation.map((entry) => entry.patch.targetPath)).toContain(
      "/character/description",
    );
    expect(preview.confirmation.required).toBe(true);
    expect(preview.blueprint.profile.name).toBe("QA Card");
  });

  it("synthesizes an unsupported UI widget into an extra render rule", async () => {
    const { compileStoryAgentImport, synthesizeImportWidgets } = await import("../flow");
    const preview = compileStoryAgentImport(widgetInput());
    const before = preview.blueprint.renderRules.length;
    const model = async () => ({
      kind: "status-panel",
      title: "好感度",
      sourceTag: "Dashboard",
      fields: [{ label: "好感", valueTemplate: "$json.aff" }],
    });

    const next = await synthesizeImportWidgets(preview, model);

    expect(next.blueprint.renderRules.length).toBe(before + 1);
    expect(next.blueprint.renderRules.some((rule) => rule.kind === "status-panel")).toBe(true);
    expect(next.summary.renderRuleCount).toBe(before + 1);
  });

  it("records a diagnostic when an unsupported widget cannot be synthesized", async () => {
    const { compileStoryAgentImport, synthesizeImportWidgets } = await import("../flow");
    const preview = compileStoryAgentImport(widgetInput());
    const before = preview.blueprint.renderRules.length;
    const model = async () => ({ nope: true });

    const next = await synthesizeImportWidgets(preview, model);

    expect(next.blueprint.renderRules.length).toBe(before);
    expect(next.diagnostics.some((diagnostic) => diagnostic.code === "render.widget_synthesis_failed")).toBe(true);
  });
});

function widgetInput() {
  return {
    characterId: "agent-widget",
    createdAt: "2026-06-10T00:00:00.000Z",
    character: {
      raw: { data: { name: "Widget Card", first_mes: "hi" } },
      source: source("widget.card.json", "json-character"),
    },
    regexScripts: [{
      id: "widget-regex",
      name: "widget-regex",
      raw: {
        scripts: [{
          id: "dash-1",
          scriptName: "好感度面板",
          findRegex: "<Dashboard>([\\s\\S]*?)</Dashboard>",
          replaceString: "<div class='dash'><script>render()</script></div>",
          trimStrings: [],
          placement: [2],
        }],
      },
      source: source("widget.regex.json", "regex"),
    }],
  };
}

function createInput() {
  return {
    characterId: "agent-fixture",
    createdAt: "2026-05-29T00:00:00.000Z",
    character: {
      raw: readJson("test-baseline-assets/character-card/Sgw3.card.json"),
      source: source("test-baseline-assets/character-card/Sgw3.card.json", "json-character"),
    },
    preset: {
      id: "preset-fixture",
      name: "preset-fixture",
      raw: readJson("test-baseline-assets/preset/明月秋青v3.94.json"),
      source: source("test-baseline-assets/preset/明月秋青v3.94.json", "preset"),
    },
    worldBooks: [{
      id: "world-fixture",
      name: "world-fixture",
      raw: readJson("test-baseline-assets/worldbook/服装随机化.json"),
      source: source("test-baseline-assets/worldbook/服装随机化.json", "worldbook"),
    }],
    regexScripts: [{
      id: "regex-fixture",
      name: "regex-fixture",
      raw: readJson("test-baseline-assets/regex-scripts/sgw3-sample.json"),
      source: source("test-baseline-assets/regex-scripts/sgw3-sample.json", "regex"),
    }],
  };
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), path), "utf8"));
}

function source(path: string, kind: AssetSource["sourceKind"]): AssetSource {
  return {
    sourcePath: path,
    sourceKind: kind,
    detectedFormat: kind,
    sourceHash: `${kind}:fixture`,
  };
}
