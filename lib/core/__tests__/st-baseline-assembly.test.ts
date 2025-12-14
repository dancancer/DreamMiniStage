/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     ST 基线装配对比（SillyTavern vs 本项目）               ║
 * ║                                                                            ║
 * ║  使用 test-baseline-assets 中的角色卡、预设、世界书，模拟一次请求装配，    ║
 * ║  对比 SillyTavern 期望的消息数组与当前项目的装配结果，给出差异摘要。       ║
 * ║                                                                            ║
 * ║  目的：建立可重复的基线，后续修复兼容性后更新快照即可校验一致性。          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { STPromptManager } from "@/lib/core/st-prompt-manager";
import { STMacroEvaluator } from "@/lib/core/st-macro-evaluator";
import { WorldBookManager } from "@/lib/core/world-book";
import type { WorldBookEntry } from "@/lib/models/world-book-model";
import type { DialogueMessage } from "@/lib/models/character-dialogue-model";
import type { STOpenAIPreset, MacroEnv, ChatMessage } from "@/lib/core/st-preset-types";

/* ─────────────────────────────────────────────────────────────────────────────
   基础常量
   ───────────────────────────────────────────────────────────────────────────── */

const ASSET_DIR = path.join(process.cwd(), "test-baseline-assets");
const CARD_PATH = path.join(ASSET_DIR, "character-card", "Sgw3.card.json");
const WORLD_BOOK_PATH = path.join(ASSET_DIR, "worldbook", "服装随机化.json");

const PRESET_CASES = [
  { name: "明月秋青 v3.94", filename: "明月秋青v3.94.json" },
  { name: "夏瑾 Pro - Beta 0.70", filename: "夏瑾 Pro - Beta 0.70.json" },
] as const;

const USER_INPUT = "推进剧情";

/* ─────────────────────────────────────────────────────────────────────────────
   工具方法
   ───────────────────────────────────────────────────────────────────────────── */

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function preview(content: string, limit: number = 120): string {
  return content.replace(/\s+/g, " ").slice(0, limit);
}

function normalizeWorldBookInput(
  cardBook: WorldBookEntry[],
  externalBook: WorldBookEntry[],
): WorldBookEntry[] {
  const merged = [...cardBook, ...externalBook];
  return merged.filter((entry) => entry?.enabled !== false && entry?.disable !== true);
}

function normalizePosition(entry: WorldBookEntry): number {
  const raw = (entry as unknown).position ?? (entry as unknown).extensions?.position;

  if (typeof raw === "number") {
    return raw;
  }

  if (typeof raw === "string") {
    if (raw === "before_char") return 0;
    if (raw === "after_char") return 2;
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return typeof (entry as unknown).extensions?.position === "number"
    ? (entry as unknown).extensions.position
    : 4;
}

function buildWorldInfoBaseline(
  entries: WorldBookEntry[],
  userInput: string,
  chatHistory: DialogueMessage[],
): { wiBefore: string; wiAfter: string } {
  const matched = WorldBookManager.getMatchingEntries(entries, userInput, chatHistory, {
    contextWindow: 5,
  });

  const before = matched.filter((entry) => {
    const pos = normalizePosition(entry);
    return pos === 0 || pos === 1;
  });
  const after = matched.filter((entry) => normalizePosition(entry) === 2);

  return {
    wiBefore: before.map((e) => e.content).join("\n\n"),
    wiAfter: after.map((e) => e.content).join("\n\n"),
  };
}

function buildWorldInfoProject(
  entries: WorldBookEntry[],
  userInput: string,
  chatHistory: DialogueMessage[],
): { wiBefore: string; wiAfter: string } {
  const matched = WorldBookManager.getMatchingEntries(entries, userInput, chatHistory, {
    contextWindow: 5,
  });

  const before = matched.filter((entry) => {
    const pos = Number((entry as unknown).position || 0);
    return pos === 0 || pos === 1;
  });
  const after = matched.filter((entry) => Number((entry as unknown).position || 0) === 2);

  return {
    wiBefore: before.map((e) => e.content).join("\n\n"),
    wiAfter: after.map((e) => e.content).join("\n\n"),
  };
}

function buildEnv(
  card: any,
  worldInfo: { wiBefore: string; wiAfter: string },
): MacroEnv {
  const data = card.data ?? card;
  return {
    user: "用户",
    char: data.name || "角色",
    description: data.description || "",
    personality: data.personality || "",
    scenario: data.scenario || "",
    persona: "",
    mesExamples: data.mes_example || "",
    wiBefore: worldInfo.wiBefore,
    wiAfter: worldInfo.wiAfter,
    chatHistory: "",
    chatHistoryMessages: [],
    userInput: USER_INPUT,
    lastUserMessage: USER_INPUT,
    number: 200,
    language: "zh",
  };
}

function summarizeMessages(messages: ChatMessage[]) {
  return messages.map((msg) => ({
    role: msg.role,
    identifier: (msg as unknown).identifier,
    hash: hashContent(typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)),
    preview: preview(typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)),
  }));
}

function diffMessages(baseline: ChatMessage[], project: ChatMessage[]) {
  const maxLen = Math.max(baseline.length, project.length);
  const diffs: Array<{
    index: number;
    kind: "missing" | "mismatch";
    baseline?: ReturnType<typeof summarizeMessages>[number];
    project?: ReturnType<typeof summarizeMessages>[number];
  }> = [];

  const baselineSummary = summarizeMessages(baseline);
  const projectSummary = summarizeMessages(project);

  for (let i = 0; i < maxLen; i++) {
    const b = baselineSummary[i];
    const p = projectSummary[i];

    if (!b || !p) {
      diffs.push({
        index: i,
        kind: "missing",
        baseline: b,
        project: p,
      });
      continue;
    }

    if (b.role !== p.role || b.hash !== p.hash) {
      diffs.push({
        index: i,
        kind: "mismatch",
        baseline: b,
        project: p,
      });
    }
  }

  return {
    baselineCount: baseline.length,
    projectCount: project.length,
    diffs,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   测试主体
   ───────────────────────────────────────────────────────────────────────────── */

describe("SillyTavern 基线拼装对比", () => {
  const characterCard = readJson<any>(CARD_PATH);
  const characterBookEntries = Object.values(
    (characterCard.data?.character_book?.entries ?? {}) as Record<string, WorldBookEntry>,
  );
  const externalWorldBook = Object.values(
    (readJson<any>(WORLD_BOOK_PATH).entries ?? {}) as Record<string, WorldBookEntry>,
  );
  const worldBookEntries = normalizeWorldBookInput(characterBookEntries, externalWorldBook);
  const chatHistory: DialogueMessage[] = [];

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    vi.spyOn(Math, "random").mockReturnValue(0.25);
  });

  afterAll(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each(PRESET_CASES)("预设 %s：基线与当前装配差异", ({ filename, name }) => {
    const presetPath = path.join(ASSET_DIR, "preset", filename);
    const openaiPreset = readJson<STOpenAIPreset>(presetPath);

    /* SillyTavern 基线：接受字符串 position/扩展位置 */
    const baselineWorldInfo = buildWorldInfoBaseline(worldBookEntries, USER_INPUT, chatHistory);
    const baselineEnv = buildEnv(characterCard, baselineWorldInfo);
    const baselineManager = new STPromptManager({ openai: openaiPreset }, new STMacroEvaluator());
    const baselineMessages = baselineManager.buildMessages(baselineEnv, {
      userInput: USER_INPUT,
    });

    /* 本项目当前逻辑：复用 loadWorldBookContent 的 Number(position) 语义 */
    const projectWorldInfo = buildWorldInfoProject(worldBookEntries, USER_INPUT, chatHistory);
    const projectEnv = buildEnv(characterCard, projectWorldInfo);
    const projectManager = new STPromptManager({ openai: openaiPreset }, new STMacroEvaluator());
    const projectMessages = projectManager.buildMessages(projectEnv, {
      userInput: USER_INPUT,
    });

    const diff = diffMessages(
      baselineMessages as ChatMessage[],
      projectMessages as ChatMessage[],
    );

    expect(diff).toMatchSnapshot();

    // 便于快速理解差异来源
    expect(name).toBe(name); // 防止 Vitest 折叠空用例
  });
});
