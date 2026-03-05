/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║        素材驱动 Regex 回归（V2.0Beta + Sgw3.*）                            ║
 * ║                                                                           ║
 * ║  目标：锁定真实素材中的关键组合字段，避免后续重构破坏迁移语义。             ║
 * ║  关注字段：runOnEdit / substituteRegex / minDepth / maxDepth              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import fs from "node:fs";
import path from "node:path";
import extract from "png-chunks-extract";
import PNGtext from "png-chunk-text";
import { describe, expect, it } from "vitest";
import { importRegexScripts } from "@/lib/adapters/import/regex-import";
import { RegexPlacement, shouldExecuteScript } from "@/lib/core/regex-processor";
import { normalizeRegexScript, type RegexScript } from "@/lib/models/regex-script-model";

interface CardPayload {
  data?: {
    extensions?: {
      regex_scripts?: unknown;
    };
  };
}

const CARD_ASSET_DIR = path.join(process.cwd(), "test-baseline-assets", "character-card");
const REGEX_SAMPLE_PATH = path.join(
  process.cwd(),
  "test-baseline-assets",
  "regex-scripts",
  "sgw3-sample.json",
);
const WORLDBOOK_REGEX_PATH = path.join(
  process.cwd(),
  "test-baseline-assets",
  "worldbook",
  "regex-1美化夜空多选追加收起.json",
);

function readJsonCard(filePath: string): CardPayload {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as CardPayload;
}

function readPngCard(filePath: string): CardPayload {
  const raw = fs.readFileSync(filePath);
  const chunks = extract(new Uint8Array(raw));
  const textChunks = chunks
    .filter((chunk) => chunk.name === "tEXt")
    .map((chunk) => PNGtext.decode(chunk.data));
  const metadata = textChunks.find((chunk) => chunk.keyword.toLowerCase() === "ccv3")
    || textChunks.find((chunk) => chunk.keyword.toLowerCase() === "chara");

  if (!metadata) {
    throw new Error(`No ccv3/chara metadata found in ${filePath}`);
  }

  return JSON.parse(Buffer.from(metadata.text, "base64").toString("utf8")) as CardPayload;
}

function loadRegexScripts(raw: unknown): RegexScript[] {
  if (!raw) return [];
  const scripts = Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>);
  return scripts.map((script) => normalizeRegexScript(script));
}

function summarizeRegexFields(scripts: RegexScript[]) {
  let runOnEditTrue = 0;
  let substituteDefined = 0;
  let minDepthDefined = 0;
  let maxDepthDefined = 0;

  for (const script of scripts) {
    if (script.runOnEdit === true) runOnEditTrue++;
    if (typeof script.substituteRegex === "number") substituteDefined++;
    if (typeof script.minDepth === "number") minDepthDefined++;
    if (typeof script.maxDepth === "number") maxDepthDefined++;
  }

  return {
    total: scripts.length,
    runOnEditTrue,
    substituteDefined,
    minDepthDefined,
    maxDepthDefined,
  };
}

describe("素材驱动 Regex 回归", () => {
  it("Sgw3.png 与 Sgw3.card.json 的关键字段分布应一致", () => {
    const jsonCard = readJsonCard(path.join(CARD_ASSET_DIR, "Sgw3.card.json"));
    const pngCard = readPngCard(path.join(CARD_ASSET_DIR, "Sgw3.png"));

    const jsonScripts = loadRegexScripts(jsonCard.data?.extensions?.regex_scripts);
    const pngScripts = loadRegexScripts(pngCard.data?.extensions?.regex_scripts);

    expect(summarizeRegexFields(pngScripts)).toEqual(summarizeRegexFields(jsonScripts));
    expect(jsonScripts.length).toBeGreaterThan(0);
  });

  it("Sgw3 素材的 minDepth/maxDepth 边界在过滤器中应按预期生效", () => {
    const card = readJsonCard(path.join(CARD_ASSET_DIR, "Sgw3.card.json"));
    const scripts = loadRegexScripts(card.data?.extensions?.regex_scripts);
    const maxDepthScript = scripts.find((script) => typeof script.maxDepth === "number"
      && script.placement.includes(RegexPlacement.AI_OUTPUT));
    const minDepthScript = scripts.find((script) => typeof script.minDepth === "number"
      && script.placement.includes(RegexPlacement.AI_OUTPUT));

    expect(maxDepthScript).toBeDefined();
    expect(minDepthScript).toBeDefined();

    expect(shouldExecuteScript(maxDepthScript!, {
      ownerId: "material-regression",
      placement: RegexPlacement.AI_OUTPUT,
      isMarkdown: true,
      isPrompt: true,
      depth: maxDepthScript!.maxDepth!,
    })).toBe(true);

    expect(shouldExecuteScript(maxDepthScript!, {
      ownerId: "material-regression",
      placement: RegexPlacement.AI_OUTPUT,
      isMarkdown: true,
      isPrompt: true,
      depth: maxDepthScript!.maxDepth! + 1,
    })).toBe(false);

    expect(shouldExecuteScript(minDepthScript!, {
      ownerId: "material-regression",
      placement: RegexPlacement.AI_OUTPUT,
      isMarkdown: true,
      isPrompt: true,
      depth: minDepthScript!.minDepth! - 1,
    })).toBe(false);

    expect(shouldExecuteScript(minDepthScript!, {
      ownerId: "material-regression",
      placement: RegexPlacement.AI_OUTPUT,
      isMarkdown: true,
      isPrompt: true,
      depth: minDepthScript!.minDepth!,
    })).toBe(true);
  });

  it("V2.0Beta 素材应保留 runOnEdit + substituteRegex 元信息", () => {
    const card = readPngCard(path.join(CARD_ASSET_DIR, "V2.0Beta.png"));
    const scripts = loadRegexScripts(card.data?.extensions?.regex_scripts);
    const summary = summarizeRegexFields(scripts);

    expect(summary.total).toBe(12);
    expect(summary.runOnEditTrue).toBe(summary.total);
    expect(summary.substituteDefined).toBe(summary.total);
    expect(summary.minDepthDefined).toBe(0);
    expect(summary.maxDepthDefined).toBe(0);
  });

  it("sgw3-sample 素材应复现 scripts-wrapper 导入与深度标志位行为", () => {
    const raw = JSON.parse(fs.readFileSync(REGEX_SAMPLE_PATH, "utf8")) as unknown;
    const scripts = importRegexScripts(raw);
    const depthLimited = scripts.find((script) => script.maxDepth === 1);
    const promptOnly = scripts.find((script) => script.promptOnly === true);

    expect(scripts.length).toBe(3);
    expect(scripts.every((script) => script.runOnEdit === true)).toBe(true);
    expect(depthLimited?.markdownOnly).toBe(true);
    expect(promptOnly?.scriptName).toBe("歌曲隐藏");

    expect(shouldExecuteScript(depthLimited!, {
      ownerId: "regex-sample",
      placement: RegexPlacement.AI_OUTPUT,
      isMarkdown: true,
      isPrompt: true,
      depth: 1,
    })).toBe(true);

    expect(shouldExecuteScript(depthLimited!, {
      ownerId: "regex-sample",
      placement: RegexPlacement.AI_OUTPUT,
      isMarkdown: true,
      isPrompt: true,
      depth: 2,
    })).toBe(false);
  });

  it("worldbook 单脚本素材应复现 disabled + markdownOnly + depth 过滤语义", () => {
    const raw = JSON.parse(fs.readFileSync(WORLDBOOK_REGEX_PATH, "utf8")) as unknown;
    const [script] = importRegexScripts(raw);
    const enabledScript = { ...script, disabled: false };

    expect(script.scriptName).toBe("1美化夜空多选追加收起");
    expect(script.disabled).toBe(true);
    expect(script.maxDepth).toBe(2);
    expect(script.markdownOnly).toBe(true);

    expect(shouldExecuteScript(script, {
      ownerId: "worldbook-regex",
      placement: RegexPlacement.AI_OUTPUT,
      isMarkdown: true,
      isPrompt: false,
      depth: 1,
    })).toBe(false);

    expect(shouldExecuteScript(enabledScript, {
      ownerId: "worldbook-regex",
      placement: RegexPlacement.AI_OUTPUT,
      isMarkdown: true,
      isPrompt: false,
      depth: 2,
    })).toBe(true);

    expect(shouldExecuteScript(enabledScript, {
      ownerId: "worldbook-regex",
      placement: RegexPlacement.AI_OUTPUT,
      isMarkdown: true,
      isPrompt: false,
      depth: 3,
    })).toBe(false);
  });
});
