import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { createImportedAssetBundle, type AssetSource } from "@/lib/adapters/import";
import {
  getCharacterRegexScripts,
  getCharacterWorldBookEntries,
} from "../import";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), path), "utf8"));
}

const source: AssetSource = {
  sourcePath: "test-baseline-assets/character-card/Sgw3.card.json",
  sourceKind: "json-character",
  detectedFormat: "chara_card_v3",
  sourceHash: "fixture-hash",
};

describe("character import bundle asset selection", () => {
  it("selects normalized embedded worldbook and regex assets from bundle", () => {
    const bundle = createImportedAssetBundle({
      bundleId: "bundle-test",
      sourceHash: "bundle-hash",
      createdAt: "2026-05-29T00:00:00.000Z",
      characterId: "character-test",
      character: {
        raw: readJson("test-baseline-assets/character-card/Sgw3.card.json"),
        source,
      },
    });

    const worldBookEntries = getCharacterWorldBookEntries(bundle);
    const regexScripts = getCharacterRegexScripts(bundle);

    expect(worldBookEntries).toHaveLength(140);
    expect(worldBookEntries[0]).toHaveProperty("secondary_keys");
    expect(worldBookEntries[0]).not.toHaveProperty("keysecondary");
    expect(regexScripts).toHaveLength(44);
    expect(regexScripts.every((script) => script.scriptKey.length > 0)).toBe(true);
  });
});
