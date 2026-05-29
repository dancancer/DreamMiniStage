import fs from "node:fs";
import path from "node:path";
import extract from "png-chunks-extract";
import PNGtext from "png-chunk-text";
import { describe, expect, it } from "vitest";
import { createImportedAssetBundle } from "@/lib/adapters/import";
import type { AssetSource, ImportedAssetBundle } from "@/lib/adapters/import";
import {
  assemblePromptMessages,
  compileSessionBlueprint,
} from "../index";

const CHARACTER_DIR = path.join(process.cwd(), "test-baseline-assets", "character-card");

function readJson(pathname: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), pathname), "utf8"));
}

function readPngCard(filename: string): unknown {
  const chunks = extract(new Uint8Array(fs.readFileSync(path.join(CHARACTER_DIR, filename))));
  const metadata = chunks
    .filter((chunk) => chunk.name === "tEXt")
    .map((chunk) => PNGtext.decode(chunk.data))
    .find((chunk) => ["ccv3", "chara"].includes(chunk.keyword.toLowerCase()));

  if (!metadata) throw new Error(`No character metadata in ${filename}`);
  return JSON.parse(Buffer.from(metadata.text, "base64").toString("utf8"));
}

function source(sourcePath: string, detectedFormat: string): AssetSource {
  return {
    sourcePath,
    sourceKind: "manual",
    detectedFormat,
    sourceHash: "fixture-hash",
  };
}

function createBundle(rawCharacter = readPngCard("Sgw3.png")): ImportedAssetBundle {
  return createImportedAssetBundle({
    bundleId: "phase-3-real-bundle",
    sourceHash: "bundle-hash",
    createdAt: "2026-05-29T00:00:00.000Z",
    characterId: "character:sgw3",
    character: {
      raw: rawCharacter,
      source: source("test-baseline-assets/character-card/Sgw3.png", "png-character"),
    },
    worldBooks: [{
      id: "external-worldbook",
      name: "服装随机化",
      raw: readJson("test-baseline-assets/worldbook/服装随机化.json"),
      source: source("test-baseline-assets/worldbook/服装随机化.json", "st-worldbook"),
    }],
    preset: {
      id: "preset",
      name: "夏瑾 Pro - Beta 0.70",
      raw: readJson("test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json"),
      source: source("test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json", "st-preset"),
    },
    regexScripts: [{
      id: "external-regex",
      name: "sgw3-sample",
      raw: readJson("test-baseline-assets/regex-scripts/sgw3-sample.json"),
      source: source("test-baseline-assets/regex-scripts/sgw3-sample.json", "st-regex"),
    }],
  });
}

describe("compileSessionBlueprint", () => {
  it("builds a core SessionBlueprint from real imported assets", () => {
    const blueprint = compileSessionBlueprint(createBundle());

    expect({
      schemaVersion: blueprint.schemaVersion,
      profileName: blueprint.profile.name,
      promptMessages: blueprint.promptStack.messages.length,
      worldModules: blueprint.worldModules.map((module) => ({
        id: module.id,
        entries: module.entries.length,
      })),
      inputTransforms: blueprint.inputTransforms.length,
      outputTransforms: blueprint.outputTransforms.length,
      promptTransforms: blueprint.promptTransforms.length,
      contentRules: countContentRules(blueprint.contentRules),
      renderRules: blueprint.renderRules,
      memoryPolicy: blueprint.memoryPolicy,
    }).toMatchInlineSnapshot(`
      {
        "contentRules": {
          "html-ui-unsupported": 38,
          "markdown-only": 40,
        },
        "inputTransforms": 39,
        "memoryPolicy": {
          "phase": "SAC-Phase 6b",
          "reason": "Long-term memory policy is defined in SAC-Phase 6b.",
          "status": "deferred",
        },
        "outputTransforms": 47,
        "profileName": "【Sgw】又看一集",
        "promptMessages": 125,
        "promptTransforms": 8,
        "renderRules": [
          {
            "bodyTemplate": "$1",
            "collapsedLabel": "点击查看 ▶︎",
            "confidence": 0.82,
            "expandedLabel": "点击隐藏 ▼",
            "id": "1f8cfad6-c1e4-4691-8b76-4a70d940bd6e:collapsible-panel",
            "kind": "collapsible-panel",
            "schemaVersion": 1,
            "sourceScriptId": "1f8cfad6-c1e4-4691-8b76-4a70d940bd6e",
            "title": "[美化]完整变量更新",
          },
        ],
        "schemaVersion": 2,
        "worldModules": [
          {
            "entries": 140,
            "id": "character-book",
          },
          {
            "entries": 3,
            "id": "external-worldbook",
          },
        ],
      }
    `);
  });

  it("keeps the stable hash repeatable and sensitive to asset content", () => {
    const bundle = createBundle();
    const first = compileSessionBlueprint(bundle);
    const second = compileSessionBlueprint(bundle);
    const changedCard = readPngCard("Sgw3.png") as { data: { first_mes: string } };
    changedCard.data.first_mes = `${changedCard.data.first_mes}\nchanged`;
    const changed = compileSessionBlueprint(createBundle(changedCard));

    expect(second.sourceHash).toBe(first.sourceHash);
    expect(second.id).toBe(first.id);
    expect(changed.sourceHash).not.toBe(first.sourceHash);
  });

  it("assembles prompts from blueprint only", () => {
    const blueprint = compileSessionBlueprint(createBundle());
    const serialized = JSON.stringify(blueprint);
    const messages = assemblePromptMessages(JSON.parse(serialized));

    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0]).toHaveProperty("role");
    expect(serialized).not.toMatch(/"(prompt_order|keysecondary|placement)":/);
  });
});

function countContentRules(rules: Array<{ kind: string }>): Record<string, number> {
  return rules.reduce<Record<string, number>>((counts, rule) => {
    counts[rule.kind] = (counts[rule.kind] ?? 0) + 1;
    return counts;
  }, {});
}
