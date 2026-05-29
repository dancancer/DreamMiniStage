import { describe, expect, it, vi } from "vitest";
import { prepareDialogueExecution } from "@/lib/generation-runtime/prepare/prepare-dialogue-execution";
import { finalizeDialogueResult } from "@/lib/generation-runtime/postprocess/finalize-dialogue-result";

const mockStore = vi.hoisted(() => ({
  saveStorySession: vi.fn(),
  blueprint: {
    id: "blueprint:test",
    schemaVersion: 2,
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
    worldModules: [],
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
    memoryPolicy: {
      status: "deferred",
      phase: "SAC-Phase 6b",
      reason: "Long-term memory policy is defined in SAC-Phase 6b.",
    },
    diagnostics: [],
    repairReport: {
      appliedPatches: [],
      manualPatches: [],
      rejectedPatches: [],
    },
    provenance: [],
  },
}));

vi.mock("@/lib/story-agent/session", async () => {
  const runtime = await vi.importActual<typeof import("@/lib/story-agent/runtime/story-session")>(
    "@/lib/story-agent/runtime/story-session",
  );
  return {
    saveStorySession: (...args: unknown[]) => mockStore.saveStorySession(...args),
    loadStoryRuntimeBinding: async () => ({
      blueprint: mockStore.blueprint,
      session: runtime.createStorySession({
        dialogueId: "dialogue-1",
        blueprint: mockStore.blueprint,
        now: "2026-05-29T00:00:00.000Z",
      }),
    }),
  };
});

describe("prepareDialogueExecution", () => {
  it("returns a story runtime execution plan before model invocation", async () => {
    const prepared = await prepareDialogueExecution({
      dialogueKey: "dialogue-1",
      characterId: "char-1",
      userInput: "hello",
      modelName: "gpt-test",
      apiKey: "key",
      llmType: "openai",
      number: 128,
    });

    expect(prepared.runtime).toBe("story");
    expect(prepared.postprocessNodeId).toBe("story-runtime");
    expect(prepared.llmConfig.messages?.map((message) => message.content)).toContain("Stay in character.");
    expect(JSON.stringify(prepared)).not.toMatch(/"(prompt_order|placement)":/);
  });
});

describe("finalizeDialogueResult", () => {
  it("finalizes through StorySession transforms and commits session state", async () => {
    mockStore.saveStorySession.mockClear();
    const prepared = await prepareDialogueExecution({
      dialogueKey: "dialogue-1",
      characterId: "char-1",
      userInput: "hello",
      modelName: "gpt-test",
      apiKey: "key",
      llmType: "openai",
      number: 128,
    });

    const result = await finalizeDialogueResult(prepared.context, "raw reply");

    expect(result).toEqual({
      screenContent: "screen reply",
      fullResponse: "raw reply",
      thinkingContent: "",
      parsedContent: { nextPrompts: [] },
      event: "",
      isPostProcessed: true,
    });
    expect(mockStore.saveStorySession).toHaveBeenCalledWith(expect.objectContaining({
      dialogueId: "dialogue-1",
      blueprintId: "blueprint:test",
      renderState: expect.objectContaining({ activeIntentIds: ["choices"] }),
    }));
  });

  it("fails fast for non-story runtime context", async () => {
    await expect(finalizeDialogueResult({ id: "legacy" }, "reply"))
      .rejects.toThrow("Story runtime context is required");
  });
});
