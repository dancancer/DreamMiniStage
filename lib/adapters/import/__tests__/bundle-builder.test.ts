import fs from "node:fs";
import path from "node:path";
import extract from "png-chunks-extract";
import PNGtext from "png-chunk-text";
import { describe, expect, it } from "vitest";
import { createImportedAssetBundle } from "../bundle-builder";
import type { AssetSource, ImportedAssetBundle } from "../bundle-types";

const CHARACTER_DIR = path.join(process.cwd(), "test-baseline-assets", "character-card");

function readJson(pathname: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), pathname), "utf8"));
}

function readPngCard(filename: string): unknown {
  const chunks = extract(new Uint8Array(fs.readFileSync(path.join(CHARACTER_DIR, filename))));
  const textChunks = chunks
    .filter((chunk) => chunk.name === "tEXt")
    .map((chunk) => PNGtext.decode(chunk.data));
  const metadata = textChunks.find((chunk) => chunk.keyword.toLowerCase() === "ccv3")
    ?? textChunks.find((chunk) => chunk.keyword.toLowerCase() === "chara");

  if (!metadata) {
    throw new Error(`No character metadata in ${filename}`);
  }

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

function createBundle(raw: unknown, sourcePath: string): ImportedAssetBundle {
  return createImportedAssetBundle({
    bundleId: `bundle:${sourcePath}`,
    sourceHash: "bundle-hash",
    createdAt: "2026-05-29T00:00:00.000Z",
    characterId: `character:${sourcePath}`,
    character: {
      raw,
      source: source(sourcePath, sourcePath.endsWith(".png") ? "png-character" : "json-character"),
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

describe("createImportedAssetBundle", () => {
  it("builds POC-1.1 bundle from PNG character plus external assets", () => {
    const bundle = createBundle(
      readPngCard("Sgw3.png"),
      "test-baseline-assets/character-card/Sgw3.png",
    );

    expect(bundle.character.name).toBe("【Sgw】又看一集");
    expect(bundle.worldBooks).toHaveLength(2);
    expect(bundle.worldBooks[0].entries).toHaveLength(140);
    expect(bundle.worldBooks[1].entries).toHaveLength(3);
    expect(bundle.regexScripts).toHaveLength(47);
    expect(bundle.preset?.normalized.prompts).toHaveLength(124);
    expect(bundle.extensionArtifacts.map((artifact) => artifact.extensionKey)).toEqual([
      "talkativeness",
      "fav",
      "world",
      "depth_prompt",
      "TavernHelper_scripts",
      "tavern_helper",
    ]);
  });

  it("keeps PNG and JSON versions of the same card semantically aligned", () => {
    const png = createBundle(
      readPngCard("Sgw3.png"),
      "test-baseline-assets/character-card/Sgw3.png",
    );
    const json = createBundle(
      readJson("test-baseline-assets/character-card/Sgw3.card.json"),
      "test-baseline-assets/character-card/Sgw3.card.json",
    );

    expect(png.character.name).toBe(json.character.name);
    expect(png.worldBooks[0].entries).toHaveLength(json.worldBooks[0].entries.length);
    expect(png.regexScripts.length).toBe(json.regexScripts.length);
    expect(png.extensionArtifacts.map((artifact) => artifact.extensionKey)).toEqual(
      json.extensionArtifacts.map((artifact) => artifact.extensionKey),
    );
  });

  it("fails fast when character identity is missing", () => {
    expect(() =>
      createImportedAssetBundle({
        bundleId: "broken",
        sourceHash: "broken-hash",
        createdAt: "2026-05-29T00:00:00.000Z",
        characterId: "broken-character",
        character: {
          raw: { data: { description: "missing name" } },
          source: source("broken.json", "json-character"),
        },
      }),
    ).toThrow("Character card is missing data.name");
  });
});
