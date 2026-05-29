import fs from "node:fs";
import path from "node:path";
import extract from "png-chunks-extract";
import PNGtext from "png-chunk-text";
import { describe, expect, it } from "vitest";
import { createImportedAssetBundle } from "../bundle-builder";
import {
  diagnoseImportedAssetBundle,
  summarizeDiagnostics,
} from "../bundle-diagnostics";
import type { AssetSource, ImportedAssetBundle } from "../bundle-types";

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

function createRealBundle(): ImportedAssetBundle {
  return createImportedAssetBundle({
    bundleId: "phase-2-real-bundle",
    sourceHash: "bundle-hash",
    createdAt: "2026-05-29T00:00:00.000Z",
    characterId: "character:sgw3",
    character: {
      raw: readPngCard("Sgw3.png"),
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

describe("diagnoseImportedAssetBundle", () => {
  it("produces deterministic diagnostics for real imported assets", () => {
    const diagnostics = diagnoseImportedAssetBundle(createRealBundle());
    const summary = summarizeDiagnostics(diagnostics);

    expect(summary.errors).toBe(0);
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.codes["extension.unsupported"]).toBe(6);
    expect(Object.keys(summary.codes).sort()).toMatchInlineSnapshot(`
      [
        "character.missing_description",
        "extension.unsupported",
        "preset.empty_enabled_prompt",
        "regex.ui_html_unsupported",
        "worldbook.missing_primary_keys",
        "worldbook.selective_missing_secondary_keys",
      ]
    `);
  });

  it("marks world book entries that need runtime activation state", () => {
    const bundle = createImportedAssetBundle({
      bundleId: "stateful-worldbook",
      sourceHash: "bundle-hash",
      createdAt: "2026-05-29T00:00:00.000Z",
      characterId: "character:stateful",
      character: {
        raw: { data: { name: "Stateful", description: "ok", first_mes: "hello" } },
        source: source("stateful.character.json", "json-character"),
      },
      worldBooks: [{
        id: "stateful-book",
        name: "stateful-book",
        raw: [{
          content: "remember this for two turns",
          key: ["memory"],
          sticky: 2,
        }],
        source: source("stateful-worldbook.json", "st-worldbook"),
      }],
    });

    const codes = diagnoseImportedAssetBundle(bundle).map((diagnostic) => diagnostic.code);

    expect(codes).toContain("worldbook.stateful_activation_required");
  });

  it("flags invalid regex and unsafe HTML UI output without executing it", () => {
    const bundle = createImportedAssetBundle({
      bundleId: "regex-diagnostics",
      sourceHash: "bundle-hash",
      createdAt: "2026-05-29T00:00:00.000Z",
      characterId: "character:diagnostics",
      character: {
        raw: { data: { name: "Diagnostics", description: "ok", first_mes: "hello" } },
        source: source("diagnostics.character.json", "json-character"),
      },
      regexScripts: [{
        id: "bad-regex",
        name: "bad-regex",
        raw: [{
          scriptKey: "bad",
          scriptName: "bad",
          findRegex: "[",
          replaceString: "<!DOCTYPE html><html><style></style></html>",
        }],
        source: source("bad-regex.json", "st-regex"),
      }],
    });

    const codes = diagnoseImportedAssetBundle(bundle).map((diagnostic) => diagnostic.code);

    expect(codes).toContain("regex.invalid_pattern");
    expect(codes).toContain("regex.ui_html_unsupported");
  });
});
