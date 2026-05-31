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
      id: "baseline-session-opening-0",
      content: "欢迎 测试用户，我是 夏瑾。",
      fullContent: "欢迎 测试用户，我是 夏瑾。",
    });
  });

  it("保留 SessionBlueprint 中的多个开场供会话页切换", async () => {
    loadStoryRuntimeBinding.mockResolvedValueOnce({
      blueprint: {
        ...createBlueprint("默认开场"),
        profile: {
          ...createBlueprint("默认开场").profile,
          openings: [
            { id: "opening:first_mes", content: "第一幕 {{user}}/<user>", sourceField: "data.first_mes" },
            { id: "opening:alternate:0", content: "第二幕 {{char}}/<char>", sourceField: "data.alternate_greetings.0" },
          ],
        },
      },
      session: {},
    });
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

    expect(result.openingMessages.map((opening) => opening.content)).toEqual([
      "第一幕 测试用户/测试用户",
      "第二幕 夏瑾/夏瑾",
    ]);
  });

  it("把说明型首开场排到可游玩开场之后", async () => {
    loadStoryRuntimeBinding.mockResolvedValueOnce({
      blueprint: {
        ...createBlueprint("默认开场"),
        profile: {
          ...createBlueprint("默认开场").profile,
          openings: [
            { id: "opening:first_mes", content: documentationOpening() },
            { id: "opening:alternate:0", content: "夜色里，{{char}}向{{user}}递来一封信。" },
          ],
        },
      },
      session: {},
    });
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

    expect(result.openingMessages.map((opening) => opening.content)).toEqual([
      "夜色里，夏瑾向测试用户递来一封信。",
      documentationOpening(),
    ]);
  });
});

function documentationOpening(): string {
  return [
    "游玩前说明：这张卡需要插件和状态栏配合使用。",
    "开场白、自带user人设、变量和状态栏会在后续对话中生效。",
    "请确保 MagVarUpdate 与 TavernHelper 已经启用。",
    "说明 ".repeat(260),
  ].join("\n");
}

function createBlueprint(firstMessage: string): SessionBlueprint {
  return {
    id: "blueprint:baseline",
    schemaVersion: 5,
    sourceHash: "hash",
    createdAt: "2026-05-29T00:00:00.000Z",
    profile: {
      id: "baseline-char",
      name: "夏瑾",
      firstMessage,
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
