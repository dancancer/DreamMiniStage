import { describe, expect, it, vi } from "vitest";
import type { SessionBlueprint, WorldModuleEntry } from "@/lib/story-agent/blueprint";
import { defaultMemoryPolicy } from "@/lib/story-agent/memory";
import {
  createStorySession,
  finalizeStoryTurn,
  prepareStoryTurn,
  type StorySessionState,
} from "../story-session";

describe("SAC-Phase 6a StorySession runtime", () => {
  it("prepares a blueprint-only model request and commits recent transcript plus render state", async () => {
    const blueprint = createBlueprint();
    let saved = createStorySession({
      dialogueId: "dialogue-1",
      blueprint,
      now: "2026-05-29T00:00:00.000Z",
    });
    const commitSession = vi.fn(async (session: StorySessionState) => {
      saved = session;
    });

    const turn = prepareStoryTurn({
      blueprint,
      session: saved,
      userInput: "alpha",
      model: modelInput(),
      commitSession,
    });
    const result = await finalizeStoryTurn(turn, "raw answer");

    expect(turn.llmConfig.messages?.map((message) => message.content)).toContain("Alpha lore");
    expect(turn.llmConfig).not.toHaveProperty("scriptTools");
    expect(result.screenContent).toBe("screen answer");
    expect(saved.recentTranscript.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(saved.renderState.activeIntentIds).toEqual(["choices"]);
  });

  it("keeps sticky, cooldown and delay counters in StorySession state across turns", async () => {
    const blueprint = createBlueprint();
    let session = createStorySession({
      dialogueId: "dialogue-2",
      blueprint,
      now: "2026-05-29T00:00:00.000Z",
    });
    const commitSession = async (next: StorySessionState) => {
      session = next;
    };

    await finalizeStoryTurn(prepareStoryTurn({
      blueprint,
      session,
      userInput: "alpha beta later",
      model: modelInput(),
      commitSession,
    }), "first");

    const second = prepareStoryTurn({
      blueprint,
      session,
      userInput: "no direct key",
      model: modelInput(),
      commitSession,
    });

    expect(second.worldHits.map((hit) => `${hit.entryId}:${hit.reason}`)).toEqual([
      "sticky:sticky",
      "delayed:delayed",
    ]);

    await finalizeStoryTurn(second, "second");
    const third = prepareStoryTurn({
      blueprint,
      session,
      userInput: "alpha",
      model: modelInput(),
      commitSession,
    });

    expect(third.worldHits.map((hit) => hit.entryId)).not.toContain("cooldown");
    expect(blueprint.worldModules[0].entries.find((entry) => entry.id === "sticky")?.content).toBe("Alpha lore");
  });

  it("does not leak ST-shaped prompt_order or runtime placement fields into the prepared request", () => {
    const blueprint = createBlueprint();
    const session = createStorySession({ dialogueId: "dialogue-3", blueprint });
    const turn = prepareStoryTurn({
      blueprint,
      session,
      userInput: "alpha",
      model: modelInput(),
    });

    expect(JSON.stringify(turn.llmConfig)).not.toMatch(/"(prompt_order|placement)":/);
    expect(JSON.stringify(turn.promptMessages)).not.toMatch(/"(prompt_order|placement)":/);
  });

  it("uses summary, facts and relationship memory when recent transcript is trimmed", async () => {
    const blueprint = createBlueprint();
    let session = createStorySession({ dialogueId: "dialogue-4", blueprint });
    const commitSession = async (next: StorySessionState) => {
      session = next;
    };

    for (let index = 0; index < 12; index += 1) {
      await finalizeStoryTurn(prepareStoryTurn({
        blueprint,
        session,
        userInput: `turn ${index} [fact:Alice keeps a silver key] [relationship:trust=warm]`,
        model: modelInput(),
        commitSession,
      }), `reply ${index}`);
    }

    const turn = prepareStoryTurn({
      blueprint,
      session,
      userInput: "what do you remember about Alice?",
      model: { ...modelInput(), maxTokens: 80 },
    });
    const memoryText = turn.promptMessages
      .filter((message) => message.source === "memory")
      .map((message) => message.content)
      .join("\n");

    expect(session.memory.runningSummary.content).toContain("turn 0");
    expect(memoryText).toContain("Alice keeps a silver key");
    expect(memoryText).toContain("trust: warm");
  });

  it("degrades when memory extraction fails without blocking the turn commit", async () => {
    const blueprint = createBlueprint();
    let session = createStorySession({ dialogueId: "dialogue-5", blueprint });
    const commitSession = async (next: StorySessionState) => {
      session = next;
    };

    const turn = prepareStoryTurn({
      blueprint,
      session,
      userInput: "remember this",
      model: modelInput(),
      commitSession,
      memoryExtractor: () => {
        throw new Error("extractor unavailable");
      },
    });

    await expect(finalizeStoryTurn(turn, "reply")).resolves.toMatchObject({
      screenContent: "reply",
    });
    expect(session.recentTranscript).toHaveLength(2);
    expect(session.memory.lastError).toBe("extractor unavailable");
  });
});

function modelInput() {
  return {
    modelName: "gpt-test",
    apiKey: "key",
    llmType: "openai" as const,
    maxTokens: 128,
    streaming: false,
  };
}

function createBlueprint(): SessionBlueprint {
  return {
    id: "blueprint:test",
    schemaVersion: 3,
    sourceHash: "hash",
    createdAt: "2026-05-29T00:00:00.000Z",
    profile: {
      id: "char-1",
      name: "Character",
      promptFragments: [],
    },
    promptStack: {
      messages: [{
        id: "system",
        role: "system",
        content: "Stay in character.",
        enabled: true,
        order: 0,
        sourceKind: "preset",
        sourcePath: "fixture",
        sourceField: "prompt",
      }],
    },
    worldModules: [{
      id: "world",
      name: "World",
      sourcePath: "fixture",
      entries: [
        worldEntry("sticky", "Alpha lore", ["alpha"], { sticky: 2 }),
        worldEntry("cooldown", "Beta lore", ["beta"], { cooldown: 2 }),
        worldEntry("delayed", "Later lore", ["later"], { delay: 1 }),
      ],
    }],
    inputTransforms: [],
    outputTransforms: [{
      id: "output",
      name: "output",
      direction: "output",
      enabled: true,
      pattern: "raw",
      replacement: "screen",
      sourcePath: "fixture",
    }],
    promptTransforms: [],
    contentRules: [],
    renderRules: [{
      schemaVersion: 1,
      id: "choices",
      kind: "choice-list",
      sourceScriptId: "script",
      title: "Choices",
      confidence: 0.8,
      options: [{
        id: "choice-1",
        labelTemplate: "$1",
        action: { type: "append-input", valueTemplate: "$1" },
      }],
    }],
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

function worldEntry(
  id: string,
  content: string,
  primaryKeys: string[],
  activation: Partial<WorldModuleEntry["activation"]>,
): WorldModuleEntry {
  return {
    id,
    enabled: true,
    content,
    primaryKeys,
    secondaryKeys: [],
    secondaryKeyLogic: "AND_ANY",
    constant: false,
    selective: false,
    useRegex: false,
    position: "before",
    depth: 0,
    caseSensitive: false,
    matchWholeWords: false,
    insertionOrder: id === "sticky" ? 1 : id === "cooldown" ? 2 : 3,
    activation: {
      sticky: activation.sticky ?? 0,
      cooldown: activation.cooldown ?? 0,
      delay: activation.delay ?? 0,
    },
    recursion: {
      preventRecursion: false,
      excludeRecursion: false,
    },
    sourceField: "entries",
  };
}
