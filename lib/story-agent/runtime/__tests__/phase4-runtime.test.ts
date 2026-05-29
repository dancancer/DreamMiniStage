import fs from "node:fs";
import path from "node:path";
import extract from "png-chunks-extract";
import PNGtext from "png-chunk-text";
import { describe, expect, it } from "vitest";
import { createImportedAssetBundle } from "@/lib/adapters/import";
import type { AssetSource, ImportedAssetBundle } from "@/lib/adapters/import";
import {
  executeDialogueFlow,
  type DialogueFlowConfig,
} from "@/lib/core/__tests__/dialogue-flow-test-helpers";
import {
  compileSessionBlueprint,
  type SessionBlueprint,
} from "@/lib/story-agent/blueprint";
import { assemblePromptContext } from "../prompt-context";
import { applyTextTransforms } from "../text-transform";
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

function createDialogueFlowBundle(config: DialogueFlowConfig): ImportedAssetBundle {
  const fixturePath = "lib/core/__tests__/fixtures/phase4/regex-flow.json";
  return createImportedAssetBundle({
    bundleId: "phase-4-dialogue-flow",
    sourceHash: "dialogue-flow-hash",
    createdAt: "2026-05-29T00:00:00.000Z",
    characterId: "character:dialogue-flow",
    character: {
      raw: {
        data: {
          name: "Dialogue Flow",
          description: config.characterCard,
          first_mes: "hello",
        },
      },
      source: source(fixturePath, "synthetic-character"),
    },
    worldBooks: [{
      id: "phase4-worldbook",
      name: "phase4-worldbook",
      raw: config.worldBook,
      source: source(fixturePath, "synthetic-worldbook"),
    }],
    preset: {
      id: "phase4-preset",
      name: "phase4-preset",
      raw: {
        name: "phase4-preset",
        prompts: [{
          identifier: "system",
          role: "system",
          content: config.systemPrompt,
          enabled: true,
          group_id: 0,
          position: 0,
        }],
      },
      source: source(fixturePath, "synthetic-preset"),
    },
    regexScripts: [{
      id: "phase4-regex",
      name: "phase4-regex",
      raw: config.regexScripts,
      source: source(fixturePath, "synthetic-regex"),
    }],
  });
}

function createWorldbookBaselineBundle(): ImportedAssetBundle {
  const fixturePath = "lib/core/__tests__/fixtures/phase4/worldbook-import.json";
  return createImportedAssetBundle({
    bundleId: "phase-4-worldbook-baseline",
    sourceHash: "worldbook-baseline-hash",
    createdAt: "2026-05-29T00:00:00.000Z",
    characterId: "character:worldbook-baseline",
    character: {
      raw: { data: { name: "Worldbook Baseline", first_mes: "hello" } },
      source: source(fixturePath, "synthetic-character"),
    },
    worldBooks: [{
      id: "baseline-worldbook",
      name: "baseline-worldbook",
      raw: readJson(fixturePath),
      source: source(fixturePath, "synthetic-worldbook"),
    }],
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

  it("compares blueprint flow against the current regex and worldbook baseline fixture", () => {
    const config = readJson("lib/core/__tests__/fixtures/phase4/regex-flow.json") as DialogueFlowConfig;
    const baseline = executeDialogueFlow(config);
    const blueprint = compileSessionBlueprint(createDialogueFlowBundle(config));
    const input = applyTextTransforms(config.userInput, blueprint.inputTransforms);
    const world = matchWorldModules(blueprint, input.text);
    const response = applyTextTransforms("[模拟响应] baseline", blueprint.outputTransforms);

    expect(input.text).toBe(baseline.processedInput);
    expect(world.hits.some((hit) => hit.entryId.includes("phase4"))).toBe(true);
    expect(response.text).toContain("后处理输出");
  });

  it("compares blueprint world matching against the current worldbook migration fixture", () => {
    const blueprint = compileSessionBlueprint(createWorldbookBaselineBundle());
    const result = matchWorldModules(blueprint, "服装搭配");

    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.hits.some((hit) => hit.depth === 4)).toBe(true);
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
