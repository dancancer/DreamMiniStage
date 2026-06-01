/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   开场白延迟 LLM 调用显示测试                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { initCharacterDialogue } from "../init";
import { defaultMemoryPolicy } from "@/lib/story-agent/memory";
import type { SessionBlueprint } from "@/lib/story-agent/blueprint";

const loadStoryRuntimeBinding = vi.fn();

vi.mock("@/lib/story-agent/session", () => ({
  loadStoryRuntimeBinding: (...args: unknown[]) => loadStoryRuntimeBinding(...args),
}));

describe("initCharacterDialogue", () => {
  beforeEach(() => {
    loadStoryRuntimeBinding.mockReset();
    loadStoryRuntimeBinding.mockResolvedValue({
      blueprint: createBlueprint(),
      session: {
        id: "session-1",
        blueprintId: "blueprint:init",
        dialogueId: "session-1",
        recentTranscript: [],
        worldbookActivationState: {},
        renderState: { activeIntentIds: [] },
        turnCount: 0,
        createdAt: "2026-05-29T00:00:00.000Z",
        updatedAt: "2026-05-29T00:00:00.000Z",
      },
    });
  });

  it("仅生成展示用开场白，不创建对话树且不调用 LLM", async () => {
    const result = await initCharacterDialogue({
      username: "user",
      dialogueId: "session-1",
      characterId: "char-1",
      language: "zh",
      modelName: "gpt",
      baseUrl: "",
      apiKey: "key",
      llmType: "openai",
    });

    expect(loadStoryRuntimeBinding).toHaveBeenCalledWith("session-1");
    expect(result.openingMessage?.id).toBe("session-1-opening-0");
    expect(result.firstMessage).toBe("你好 user。");
    expect(result.openingMessages[0].content).toBe("你好 user。");
  });
});

function createBlueprint(): SessionBlueprint {
  return {
    id: "blueprint:init",
    schemaVersion: 6,
    sourceHash: "hash",
    createdAt: "2026-05-29T00:00:00.000Z",
    profile: {
      id: "char-1",
      name: "Tester",
      firstMessage: "你好 {{user}}。",
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
    initialState: { variables: {}, sources: [], errors: [] },
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
