/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   开场 Regex 处理基线（夏瑾 + 2.png）                        ║
 * ║  目标：模拟开场阶段，确保首条展示内容按角色卡的 regex 脚本完成替换。          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { adaptText } from "@/lib/adapter/tagReplacer";

const ASSET_DIR = path.join(process.cwd(), "test-baseline-assets");
const PRESET_NAME = "夏瑾 Pro - Beta 0.70";
const CARD_PNG_PATH = path.join(ASSET_DIR, "character-card", "2.png");
const characterId = "baseline-char";
const dialogueId = "baseline-session";

type CardData = {
  data: {
    name: string;
    description?: string;
    personality?: string;
    scenario?: string;
    first_mes?: string;
    alternate_greetings?: string[];
    extensions?: {
      regex_scripts?: any[];
    };
  };
};

function decodePngCard(pngPath: string): CardData {
  const buf = fs.readFileSync(pngPath);
  let offset = 8; // 跳过 PNG header

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.slice(offset + 4, offset + 8).toString("ascii");
    if (type === "tEXt") {
      const chunk = buf.slice(offset + 8, offset + 8 + length);
      const nul = chunk.indexOf(0);
      const payload = chunk.slice(nul + 1).toString();
      const decoded = Buffer.from(payload, "base64").toString("utf8");
      try {
        return JSON.parse(decoded) as CardData;
      } catch {
        // ignore and continue
      }
    }
    offset += 12 + length;
  }

  throw new Error("Failed to decode PNG card");
}

describe("开场 Regex 处理基线", () => {
  const card = decodePngCard(CARD_PNG_PATH);
  const regexScripts = card.data.extensions?.regex_scripts || [];
  const openingRaw = card.data.alternate_greetings?.[0] || card.data.first_mes || "";
  let initCharacterDialogue: typeof import("../init").initCharacterDialogue;
  let RegexProcessor: typeof import("@/lib/core/regex-processor").RegexProcessor;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const normalizedScripts = regexScripts.map((script, idx) => ({
      ...script,
      id: script.id || `script_${idx}`,
      scriptKey: script.scriptKey || script.id || `script_${idx}`,
      source: "character",
      sourceId: characterId,
    }));

    // Mock IndexedDB 存储为内存 Map
    const store = new Map<string, Map<string, any>>();
    const ensureStore = (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      return store.get(name)!;
    };

    vi.doMock("@/lib/data/local-storage", () => ({
      REGEX_SCRIPTS_FILE: "regex_scripts",
      clearStore: async (name: string) => {
        store.set(name, new Map());
      },
      getAllEntries: async (name: string) => {
        const entries = ensureStore(name);
        return Array.from(entries.entries()).map(([key, value]) => ({ key, value }));
      },
      getRecordByKey: async (name: string, key: string) => {
        return ensureStore(name).get(key) ?? null;
      },
      putRecord: async (name: string, key: string, value: any) => {
        ensureStore(name).set(key, value);
      },
    }));

    vi.doMock("@/lib/data/roleplay/regex-script-operation", () => ({
      RegexScriptOperations: {
        getRegexScriptSettings: vi.fn().mockResolvedValue({
          enabled: true,
          applyToPrompt: false,
          applyToResponse: true,
        }),
        getAllScriptsForProcessing: vi.fn().mockResolvedValue(normalizedScripts),
      },
    }));

    // Mock 预设类型
    vi.doMock("@/function/preset/download", () => ({
      getCurrentSystemPresetType: () => PRESET_NAME,
    }));

    // Mock 角色记录
    vi.doMock("@/lib/data/roleplay/character-record-operation", () => ({
      LocalCharacterRecordOperations: {
        getCharacterById: vi.fn().mockResolvedValue({
          id: characterId,
          imagePath: CARD_PNG_PATH,
          data: { data: card.data },
        }),
      },
    }));

    const initModule = await import("../init");
    const regexModule = await import("@/lib/core/regex-processor");
    initCharacterDialogue = initModule.initCharacterDialogue;
    RegexProcessor = regexModule.RegexProcessor;
  });

  it("应将开场文本按角色卡 regex 脚本完成替换（<sep> → HTML 分隔符）", async () => {
    const adapted = adaptText(openingRaw, "zh", "测试用户");
    const expected = await RegexProcessor.processFullContext(adapted, {
      ownerId: characterId,
      isMarkdown: true,
      presetSource: { ownerId: PRESET_NAME, presetName: PRESET_NAME },
    });

    const result = await initCharacterDialogue({
      username: "测试用户",
      dialogueId,
      characterId,
      language: "zh",
      modelName: "gpt",
      baseUrl: "http://localhost",
      apiKey: "sk-test",
      llmType: "openai",
    });

    expect(result.firstMessage).toBe(expected.replacedText);
    expect(result.firstMessage).not.toContain("<sep>");
    expect(result.firstMessage).toContain("<div style=");
  });
});
