/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   开场白延迟 LLM 调用显示测试                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { initCharacterDialogue } from "../init";

const getCharacterById = vi.fn();
const processFullContext = vi.fn();

vi.mock("@/lib/data/roleplay/character-record-operation", () => ({
  LocalCharacterRecordOperations: {
    getCharacterById: (...args: unknown[]) => getCharacterById(...args),
  },
}));

vi.mock("@/lib/core/regex-processor", () => ({
  RegexProcessor: {
    processFullContext: (...args: unknown[]) => processFullContext(...args),
  },
}));
vi.mock("@/function/preset/download", () => ({
  getCurrentSystemPresetType: () => "default-preset",
}));

const characterRecord = {
  id: "char-1",
  imagePath: "",
  data: {
    name: "Tester",
    description: "",
    personality: "",
    first_mes: "你好",
    scenario: "",
    creatorcomment: "",
    creator_notes: "",
    data: {
      name: "Tester",
      description: "",
      personality: "",
      first_mes: "你好",
      scenario: "",
      creator_notes: "",
      alternate_greetings: [],
    },
  },
};

describe("initCharacterDialogue", () => {
  beforeEach(() => {
    getCharacterById.mockReset();
    processFullContext.mockReset();

    getCharacterById.mockResolvedValue(characterRecord);
    processFullContext.mockResolvedValue({ replacedText: "screen" });
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

    expect(processFullContext).toHaveBeenCalledTimes(1);
    expect(result.openingMessage?.id).toBe("session-1-opening");
    expect(result.firstMessage).toBe("screen");
    expect(result.openingMessages[0].content).toBe("screen");
  });
});
