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

function createCharacterOnlyBundle(filename: string, characterId: string): ImportedAssetBundle {
  return createImportedAssetBundle({
    bundleId: `bundle:${characterId}`,
    sourceHash: "bundle-hash",
    createdAt: "2026-05-29T00:00:00.000Z",
    characterId,
    character: {
      raw: readPngCard(filename),
      source: source(`test-baseline-assets/character-card/${filename}`, "png-character"),
    },
  });
}

describe("compileSessionBlueprint", () => {
  it("builds a core SessionBlueprint from real imported assets", () => {
    const blueprint = compileSessionBlueprint(createBundle());

    expect({
      schemaVersion: blueprint.schemaVersion,
      profileName: blueprint.profile.name,
      openingCount: blueprint.profile.openings.length,
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
      modelPolicy: blueprint.modelPolicy,
      memoryPolicy: blueprint.memoryPolicy,
    }).toMatchInlineSnapshot(`
      {
        "contentRules": {
          "html-ui-unsupported": 36,
          "markdown-only": 40,
        },
        "inputTransforms": 34,
        "memoryPolicy": {
          "episodic": {
            "maxEntries": 24,
          },
          "facts": {
            "maxEntries": 32,
          },
          "failureMode": "degrade",
          "relationships": {
            "maxEntries": 16,
          },
          "status": "active",
          "summary": {
            "maxChars": 1200,
            "preserveRecentEpisodes": 8,
          },
        },
        "modelPolicy": {
          "contextWindow": 2000000,
          "frequencyPenalty": 0,
          "maxTokens": 8192,
          "presencePenalty": 0,
          "repeatPenalty": 1,
          "streaming": true,
          "temperature": 1.01,
          "topK": 0,
          "topP": 1,
        },
        "openingCount": 11,
        "outputTransforms": 0,
        "profileName": "【Sgw】又看一集",
        "promptMessages": 124,
        "promptTransforms": 8,
        "renderRules": [
          {
            "confidence": 0.8,
            "dataTemplate": "$1",
            "fields": [
              {
                "label": "日期",
                "valueTemplate": "$json.date",
              },
              {
                "label": "时间",
                "valueTemplate": "$json.time",
              },
              {
                "label": "地点",
                "valueTemplate": "$json.location",
              },
            ],
            "id": "9da8e3ce-5c72-41f0-befe-e7332d2ab4d2:status-panel",
            "kind": "status-panel",
            "schemaVersion": 1,
            "sourcePattern": "<SFW>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/SFW>",
            "sourceScriptId": "9da8e3ce-5c72-41f0-befe-e7332d2ab4d2",
            "title": "状态栏（Mujica版）（二选一）",
          },
          {
            "bodyTemplate": "$1",
            "collapsedLabel": "点击查看 ▶︎",
            "confidence": 0.82,
            "expandedLabel": "点击隐藏 ▼",
            "id": "1f8cfad6-c1e4-4691-8b76-4a70d940bd6e:collapsible-panel",
            "kind": "collapsible-panel",
            "schemaVersion": 1,
            "sourcePattern": "/<update(?:variable)?>\\s*(.*)\\s*<\\/update(?:variable)?>/gsi",
            "sourceScriptId": "1f8cfad6-c1e4-4691-8b76-4a70d940bd6e",
            "title": "[美化]完整变量更新",
          },
          {
            "confidence": 0.78,
            "dataTemplate": "$1",
            "id": "39caa212-66d8-4536-a530-7214b6fc2c34:state-panel",
            "kind": "state-panel",
            "schemaVersion": 1,
            "sourcePattern": "<StoryState>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/StoryState>",
            "sourceScriptId": "39caa212-66d8-4536-a530-7214b6fc2c34",
            "title": "Story State",
          },
        ],
        "schemaVersion": 5,
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

  it("compiles imported chat-role examples as story instructions", () => {
    const blueprint = compileSessionBlueprint(createRoleExampleBundle());
    const messages = assemblePromptMessages(blueprint);

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "character:character.mes_example",
          role: "system",
          content: "<START>\n{{char}}: example line",
        }),
        expect.objectContaining({
          id: "preset:user-example",
          role: "system",
          content: "{{lastUserMessage}} wrapped by preset",
        }),
        expect.objectContaining({
          id: "preset:assistant-example",
          role: "system",
          content: "assistant exemplar",
        }),
      ]),
    );
  });

  it("compiles theater UpdateVariable semantics into a safe state panel rule", () => {
    const blueprint = compileSessionBlueprint(
      createCharacterOnlyBundle("V2.0Beta.png", "character:theater"),
    );

    expect(blueprint.profile.name).toBe("诡秘剧场");
    expect(blueprint.profile.openings).toHaveLength(1);
    expect(blueprint.profile.openings[0]).toMatchObject({
      id: "opening:synthetic:neutral",
      sourceField: "story-agent.synthetic_opening",
    });
    expect(blueprint.profile.firstMessage).toBe(blueprint.profile.openings[0].content);
    expect(blueprint.profile.firstMessage).not.toContain("<开局>");
    expect(blueprint.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "character.instruction_only_opening",
          targetPath: "profile.openings",
        }),
      ]),
    );
    expect(blueprint.renderRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "state-panel",
          title: "Story State",
          sourcePattern: "<StoryState>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/StoryState>",
        }),
        expect.objectContaining({
          kind: "choice-list",
          title: "Actions",
          sourcePattern: "<StoryActions>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/StoryActions>",
        }),
      ]),
    );
    expect(JSON.stringify(blueprint.renderRules)).not.toContain("dexie");
  });

  it("keeps source patterns on collapsible UI render rules", () => {
    const blueprint = compileSessionBlueprint(
      createCharacterOnlyBundle("2.png", "character:origin"),
    );

    expect(blueprint.renderRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "collapsible-panel",
          title: "UI-状态栏容器",
          sourcePattern: "/<StatusDashboard>([\\s\\S]*?)<\\/StatusDashboard>/g",
        }),
        expect.objectContaining({
          kind: "collapsible-panel",
          title: "📂 UNIT STATUS / 展开数据",
          sourcePattern: "/<UnitCard>([\\s\\S]*?)<\\/UnitCard>/g",
        }),
      ]),
    );
  });
});

function createRoleExampleBundle(): ImportedAssetBundle {
  return createImportedAssetBundle({
    bundleId: "role-example",
    sourceHash: "role-example-hash",
    createdAt: "2026-06-01T00:00:00.000Z",
    characterId: "character:role-example",
    character: {
      raw: {
        data: {
          name: "Role Example",
          mes_example: "<START>\n{{char}}: example line",
        },
      },
      source: source("role-example.card.json", "json-character"),
    },
    preset: {
      id: "preset-role-example",
      name: "Role Example Preset",
      raw: {
        prompts: [
          {
            identifier: "user-example",
            name: "User Example",
            role: "user",
            content: "{{lastUserMessage}} wrapped by preset",
            enabled: true,
          },
          {
            identifier: "assistant-example",
            name: "Assistant Example",
            role: "assistant",
            content: "assistant exemplar",
            enabled: true,
          },
        ],
      },
      source: source("role-example-preset.json", "st-preset"),
    },
  });
}

function countContentRules(rules: Array<{ kind: string }>): Record<string, number> {
  return rules.reduce<Record<string, number>>((counts, rule) => {
    counts[rule.kind] = (counts[rule.kind] ?? 0) + 1;
    return counts;
  }, {});
}
