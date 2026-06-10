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

  it("extracts supported variable conventions from static extension data", () => {
    const bundle = createImportedAssetBundle({
      bundleId: "extension-variables",
      sourceHash: "bundle-hash",
      createdAt: "2026-06-04T00:00:00.000Z",
      characterId: "character:extension-variables",
      character: {
        raw: {
          data: {
            name: "Extension Variables",
            first_mes: "hello",
            extensions: {
              mvu_replay: readJson("test-baseline-assets/mvu-examples/variable-chain.json"),
              tavern_helper: [
                ["scripts", [{ name: "remote", content: "import 'https://example.test/script.js'" }]],
                ["variables", { hp: 7 }],
              ],
            },
          },
        },
        source: source("extension-variables.card.json", "json-character"),
      },
    });

    expect(bundle.extensionArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          extensionKey: "mvu_replay",
          kind: "variable-convention",
          supported: false,
        }),
        expect.objectContaining({
          extensionKey: "mvu_replay.initial",
          kind: "variable-convention",
          supported: true,
          payload: { hp: 10, nested: { level: 1 } },
          diagnostics: [],
        }),
        expect.objectContaining({
          extensionKey: "tavern_helper",
          kind: "script",
          supported: false,
        }),
        expect.objectContaining({
          extensionKey: "tavern_helper.variables",
          kind: "variable-convention",
          supported: true,
          payload: { hp: 7 },
        }),
      ]),
    );
  });

  it("flags MVU replay mutation with a dedicated diagnostic code", () => {
    const bundle = createImportedAssetBundle({
      bundleId: "replay-mutation",
      sourceHash: "bundle-hash",
      createdAt: "2026-06-10T00:00:00.000Z",
      characterId: "character:replay-mutation",
      character: {
        raw: {
          data: {
            name: "Replay Mutation",
            first_mes: "hello",
            extensions: {
              mvu_replay: readJson("test-baseline-assets/mvu-examples/variable-chain.json"),
              misc_meta: { foo: "bar" },
            },
          },
        },
        source: source("replay-mutation.card.json", "json-character"),
      },
    });

    const replay = bundle.extensionArtifacts.find(
      (artifact) => artifact.extensionKey === "mvu_replay",
    );
    expect(replay?.supported).toBe(false);
    expect(replay?.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "extension.mvu_replay_mutation_unsupported",
    );

    const misc = bundle.extensionArtifacts.find(
      (artifact) => artifact.extensionKey === "misc_meta",
    );
    expect(misc?.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "extension.unsupported",
    );
  });

  it("flags pair-list MVU replay mutation with the dedicated diagnostic code", () => {
    const bundle = createImportedAssetBundle({
      bundleId: "replay-pairs",
      sourceHash: "bundle-hash",
      createdAt: "2026-06-10T00:00:00.000Z",
      characterId: "character:replay-pairs",
      character: {
        raw: {
          data: {
            name: "Replay Pairs",
            first_mes: "hello",
            extensions: {
              mvu_pairs: [
                ["initial", { hp: 5 }],
                ["update", { hp: 9 }],
              ],
            },
          },
        },
        source: source("replay-pairs.card.json", "json-character"),
      },
    });

    const replay = bundle.extensionArtifacts.find(
      (artifact) => artifact.extensionKey === "mvu_pairs",
    );
    expect(replay?.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "extension.mvu_replay_mutation_unsupported",
    );
  });

  it("keeps cards with empty embedded regex_scripts importable", () => {
    const bundle = createImportedAssetBundle({
      bundleId: "empty-embedded-regex",
      sourceHash: "bundle-hash",
      createdAt: "2026-05-29T00:00:00.000Z",
      characterId: "character:seagull",
      character: {
        raw: readPngCard("3.png"),
        source: source("test-baseline-assets/character-card/3.png", "png-character"),
      },
    });

    expect(bundle.character.name).toBe("海鸥小岛与天堂");
    expect(bundle.regexScripts).toHaveLength(0);
    expect(bundle.diagnostics).toContainEqual({
      code: "regex.embedded_empty_or_unsupported",
      severity: "info",
      message: "Embedded regex_scripts contains no importable regex scripts.",
      targetPath: "regexScripts.character-regex",
      sourceField: "data.extensions.regex_scripts",
    });
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
