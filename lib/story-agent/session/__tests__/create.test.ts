import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultMemoryPolicy } from "@/lib/story-agent/memory";
import type { SessionBlueprint } from "@/lib/story-agent/blueprint";

const characterOps = vi.hoisted(() => ({
  getCharacterById: vi.fn(),
}));
const sessionOps = vi.hoisted(() => ({
  createSession: vi.fn(),
}));
const storyStore = vi.hoisted(() => ({
  getStoryBlueprint: vi.fn(),
  saveStorySession: vi.fn(),
}));

vi.mock("@/lib/data/roleplay/character-record-operation", () => ({
  LocalCharacterRecordOperations: characterOps,
}));

vi.mock("@/lib/data/roleplay/session-operation", () => ({
  SessionOperations: sessionOps,
}));

vi.mock("../store", () => storyStore);

describe("createStorySessionForCharacter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionOps.createSession.mockResolvedValue({
      id: "session-1",
      characterId: "agent-1",
      name: "Agent - 05/29 12:00",
      createdAt: "2026-05-29T00:00:00.000Z",
      updatedAt: "2026-05-29T00:00:00.000Z",
    });
    storyStore.getStoryBlueprint.mockResolvedValue(createBlueprint());
  });

  it("creates a StorySession only for blueprint-backed characters", async () => {
    characterOps.getCharacterById.mockResolvedValue(createRecord("blueprint-1"));

    const { createStorySessionForCharacter } = await import("../create");
    const session = await createStorySessionForCharacter("agent-1");

    expect(session.id).toBe("session-1");
    expect(storyStore.getStoryBlueprint).toHaveBeenCalledWith("blueprint-1");
    expect(storyStore.saveStorySession).toHaveBeenCalledWith(expect.objectContaining({
      dialogueId: "session-1",
      blueprintId: "blueprint-1",
    }));
  });

  it("fails fast when a character is not a compiled Story Agent", async () => {
    characterOps.getCharacterById.mockResolvedValue(createRecord(undefined));

    const { createStorySessionForCharacter } = await import("../create");

    await expect(createStorySessionForCharacter("legacy-char")).rejects.toThrow(
      "not a compiled Story Agent",
    );
    expect(sessionOps.createSession).not.toHaveBeenCalled();
  });
});

function createRecord(blueprintId: string | undefined) {
  return {
    id: "agent-1",
    data: {
      name: "Agent",
      data: {
        name: "Agent",
        extensions: blueprintId ? { storyBlueprintId: blueprintId } : {},
      },
    },
    imagePath: "",
  };
}

function createBlueprint(): SessionBlueprint {
  return {
    id: "blueprint-1",
    schemaVersion: 5,
    sourceHash: "hash",
    createdAt: "2026-05-29T00:00:00.000Z",
    profile: {
      id: "agent-1",
      name: "Agent",
      openings: [],
      promptFragments: [],
    },
    promptStack: { messages: [] },
    modelPolicy: {},
    worldModules: [],
    inputTransforms: [],
    outputTransforms: [],
    promptTransforms: [],
    contentRules: [],
    renderRules: [],
    memoryPolicy: defaultMemoryPolicy(),
    diagnostics: [],
    repairReport: {
      appliedPatches: [],
      manualPatches: [],
      rejectedPatches: [],
    },
    provenance: [],
  };
}
