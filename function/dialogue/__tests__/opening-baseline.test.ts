/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   StoryBlueprint 开场白基线                               ║
 * ║  目标：开场阶段只读取已编译的 SessionBlueprint，不再解析角色卡/正则资产。      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultMemoryPolicy } from "@/lib/story-agent/memory";
import type { SessionBlueprint } from "@/lib/story-agent/blueprint";

const loadStoryRuntimeBinding = vi.fn();

vi.mock("@/lib/story-agent/session", () => ({
  loadStoryRuntimeBinding: (...args: unknown[]) => loadStoryRuntimeBinding(...args),
}));

describe("StoryBlueprint 开场白基线", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadStoryRuntimeBinding.mockResolvedValue({
      blueprint: createBlueprint("欢迎 {{user}}，我是 {{char}}。"),
      session: {
        id: "baseline-session",
        blueprintId: "blueprint:baseline",
        dialogueId: "baseline-session",
        recentTranscript: [],
        worldbookActivationState: {},
        renderState: { activeIntentIds: [] },
        turnCount: 0,
        createdAt: "2026-05-29T00:00:00.000Z",
        updatedAt: "2026-05-29T00:00:00.000Z",
      },
    });
  });

  it("用 SessionBlueprint 首句生成开场，不走角色卡 regex runtime", async () => {
    const { initCharacterDialogue } = await import("../init");

    const result = await initCharacterDialogue({
      username: "测试用户",
      dialogueId: "baseline-session",
      characterId: "baseline-char",
      language: "zh",
      modelName: "gpt",
      baseUrl: "http://localhost",
      apiKey: "sk-test",
      llmType: "openai",
    });

    expect(loadStoryRuntimeBinding).toHaveBeenCalledWith("baseline-session");
    expect(result.firstMessage).toBe("欢迎 测试用户，我是 夏瑾。");
    expect(result.openingMessage).toMatchObject({
      id: "baseline-session-opening",
      content: "欢迎 测试用户，我是 夏瑾。",
      fullContent: "欢迎 测试用户，我是 夏瑾。",
    });
  });
});

function createBlueprint(firstMessage: string): SessionBlueprint {
  return {
    id: "blueprint:baseline",
    schemaVersion: 3,
    sourceHash: "hash",
    createdAt: "2026-05-29T00:00:00.000Z",
    profile: {
      id: "baseline-char",
      name: "夏瑾",
      firstMessage,
      promptFragments: [],
    },
    promptStack: { messages: [] },
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
