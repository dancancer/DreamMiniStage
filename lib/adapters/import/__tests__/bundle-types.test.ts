import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  IMPORTED_ASSET_BUNDLE_SCHEMA_VERSION,
  type AssetSource,
  type ImportedAssetBundle,
} from "../bundle-types";
import { importPreset } from "../preset-import";
import { importRegexScripts } from "../regex-import";
import { importWorldBookEntries } from "../worldbook-import";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), path), "utf8"));
}

function source(sourcePath: string, detectedFormat: string): AssetSource {
  return {
    sourcePath,
    sourceKind: "manual",
    detectedFormat,
    sourceHash: "test-hash",
  };
}

describe("ImportedAssetBundle contract", () => {
  it("composes existing normalized imports into one bundle shape", () => {
    const worldPath = "test-baseline-assets/worldbook/服装随机化.json";
    const presetPath = "test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json";
    const regexPath = "test-baseline-assets/regex-scripts/sgw3-sample.json";
    const worldSource = source(worldPath, "st-worldbook");
    const regexSource = source(regexPath, "st-regex-scripts");
    const presetSource = source(presetPath, "st-preset");

    const worldEntries = importWorldBookEntries(readJson(worldPath));
    const regexScripts = importRegexScripts(readJson(regexPath));
    const preset = importPreset(readJson(presetPath));

    const bundle: ImportedAssetBundle = {
      schemaVersion: IMPORTED_ASSET_BUNDLE_SCHEMA_VERSION,
      bundleId: "bundle-test",
      sourceHash: "bundle-hash",
      createdAt: "2026-05-29T00:00:00.000Z",
      character: {
        id: "character-test",
        name: "fixture-character",
        source: source("test-baseline-assets/character-card/Sgw3.png", "png-character"),
        promptFragments: [],
        diagnostics: [],
      },
      worldBooks: [{
        id: "worldbook-test",
        name: "服装随机化",
        source: worldSource,
        entries: worldEntries.map((normalized, index) => ({
          id: `world-entry-${index}`,
          sourceBookId: "worldbook-test",
          normalized,
          provenance: [{
            targetPath: `worldBooks[0].entries[${index}].normalized`,
            sourcePath: worldPath,
            sourceField: `entries.${index}`,
          }],
          unsupported: [],
        })),
        diagnostics: [],
      }],
      preset: {
        id: "preset-test",
        name: preset.name,
        normalized: preset,
        source: presetSource,
        diagnostics: [],
      },
      regexScripts: regexScripts.map((raw, index) => ({
        id: raw.id ?? `regex-${index}`,
        source: regexSource,
        raw,
        provenance: [{
          targetPath: `regexScripts[${index}].raw`,
          sourcePath: regexPath,
          sourceField: `scripts.${index}`,
        }],
        diagnostics: [],
      })),
      extensionArtifacts: [],
      diagnostics: [],
    };

    expect(bundle.worldBooks[0].entries).toHaveLength(3);
    expect(bundle.worldBooks[0].entries[0].normalized.selectiveLogic).toBe("AND_ANY");
    expect(bundle.preset?.normalized.prompts).toHaveLength(124);
    expect(bundle.regexScripts).toHaveLength(3);
  });
});
