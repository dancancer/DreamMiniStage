import fs from "node:fs";
import path from "node:path";
import extract from "png-chunks-extract";
import PNGtext from "png-chunk-text";
import { describe, expect, it } from "vitest";
import { createImportedAssetBundle } from "@/lib/adapters/import";
import type { AssetSource, ImportedAssetBundle } from "@/lib/adapters/import";
import {
  compileSessionBlueprint,
  type SessionBlueprint,
} from "@/lib/story-agent/blueprint";
import { assemblePromptContext } from "../prompt-context";
import { matchWorldModules } from "../world-module";

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

function createBundle(presetPath = "test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json"): ImportedAssetBundle {
  return createImportedAssetBundle({
    bundleId: `phase-4:${presetPath}`,
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
      name: path.basename(presetPath, ".json"),
      raw: readJson(presetPath),
      source: source(presetPath, "st-preset"),
    },
  });
}

describe("SAC-Phase 4 blueprint runtime harness", () => {
  it("POC-4.1 matches world modules from real assets", () => {
    const blueprint = compileSessionBlueprint(createBundle());
    const result = matchWorldModules(blueprint, "丰川祥子在RiNG排练春日影。");

    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.hits[0]).toMatchObject({
      moduleId: "character-book",
      reason: "constant",
      sourcePath: "test-baseline-assets/character-card/Sgw3.png",
    });
  });

  it("POC-4.2 assembles prompt context for two real presets", () => {
    const presetA = compileSessionBlueprint(createBundle("test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json"));
    const presetB = compileSessionBlueprint(createBundle("test-baseline-assets/preset/明月秋青v3.94.json"));

    const assembledA = assemblePromptContext({ blueprint: presetA });
    const assembledB = assemblePromptContext({ blueprint: presetB });

    expect(assembledA.messages.length).toBeGreaterThan(0);
    expect(assembledB.messages.length).toBeGreaterThan(0);
    expect(assembledA.messages[0].source).toBe("prompt-stack");
    expect(assembledB.messages[0].source).toBe("prompt-stack");
  });

  it("POC-4.3 drops history before memory, world hits and prompt stack under budget", () => {
    const blueprint = shortPromptBlueprint();
    const worldHits = matchWorldModules(blueprint, "alpha").hits;
    const result = assemblePromptContext({
      blueprint,
      worldHits,
      memoryMessages: ["important memory"],
      history: [
        { role: "user", content: "old user message that should be cut first" },
        { role: "assistant", content: "old assistant message that should be cut first" },
      ],
      maxTokens: 20,
    });

    expect(result.messages.map((message) => message.source)).toEqual([
      "prompt-stack",
      "world",
      "memory",
    ]);
    expect(result.omitted.map((message) => message.source)).toEqual(["history", "history"]);
  });

  it("POC-4.4 keeps sticky cooldown and delay in activation state", () => {
    const blueprint = statefulBlueprint();
    const first = matchWorldModules(blueprint, "alpha beta later");
    const second = matchWorldModules(blueprint, "no direct keys", first.activationState);
    const third = matchWorldModules(blueprint, "alpha", second.activationState);

    expect(first.hits.map((hit) => hit.reason)).toEqual(["keyword", "keyword"]);
    expect(Object.keys(first.activationState).sort()).toEqual([
      "stateful:cooldown",
      "stateful:delayed",
      "stateful:sticky",
    ]);
    expect(second.hits.map((hit) => hit.reason)).toEqual(["sticky", "delayed"]);
    expect(third.hits.some((hit) => hit.entryId === "cooldown")).toBe(false);
  });

  it("POC-4.4 follows recursive worldbook hits without mutating definitions", () => {
    const blueprint = recursionBlueprint();
    const result = matchWorldModules(blueprint, "alpha", {}, { maxRecursionDepth: 1 });

    expect(result.hits.map((hit) => [hit.entryId, hit.reason])).toEqual([
      ["alpha", "keyword"],
      ["beta", "recursive"],
    ]);
    expect(blueprint.worldModules[0].entries[0].content).toBe("beta appears in injected content");
  });
});

function shortPromptBlueprint(): SessionBlueprint {
  const blueprint = statefulBlueprint();
  return {
    ...blueprint,
    promptStack: {
      messages: [{
        id: "system",
        role: "system",
        content: "core prompt",
        enabled: true,
        order: 0,
        sourceKind: "character",
        sourcePath: "synthetic",
        sourceField: "system",
      }],
    },
  };
}

function statefulBlueprint(): SessionBlueprint {
  const blueprint = compileSessionBlueprint(createBundle());
  return {
    ...blueprint,
    worldModules: [{
      id: "stateful",
      name: "stateful",
      sourcePath: "synthetic-worldbook.json",
      entries: [
        worldEntry("sticky", "alpha", { sticky: 2, cooldown: 0, delay: 0 }),
        worldEntry("cooldown", "beta", { sticky: 0, cooldown: 2, delay: 0 }),
        worldEntry("delayed", "later", { sticky: 0, cooldown: 0, delay: 1 }),
      ],
    }],
  };
}

function worldEntry(
  id: string,
  key: string,
  activation: { sticky: number; cooldown: number; delay: number },
): SessionBlueprint["worldModules"][number]["entries"][number] {
  return {
    id,
    enabled: true,
    content: `${id} content`,
    primaryKeys: [key],
    secondaryKeys: [],
    secondaryKeyLogic: "AND_ANY",
    constant: false,
    selective: false,
    useRegex: false,
    position: 4,
    depth: 1,
    caseSensitive: false,
    matchWholeWords: false,
    insertionOrder: id === "sticky" ? 1 : id === "cooldown" ? 2 : 3,
    activation,
    recursion: {
      preventRecursion: false,
      excludeRecursion: false,
    },
    sourceField: id,
  };
}

function recursionBlueprint(): SessionBlueprint {
  const blueprint = statefulBlueprint();
  return {
    ...blueprint,
    worldModules: [{
      id: "recursive",
      name: "recursive",
      sourcePath: "recursive-worldbook.json",
      entries: [
        {
          ...worldEntry("alpha", "alpha", { sticky: 0, cooldown: 0, delay: 0 }),
          content: "beta appears in injected content",
        },
        worldEntry("beta", "beta", { sticky: 0, cooldown: 0, delay: 0 }),
      ],
    }],
  };
}
