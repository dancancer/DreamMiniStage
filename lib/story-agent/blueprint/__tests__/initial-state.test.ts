import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createImportedAssetBundle } from "@/lib/adapters/import";
import type { AssetSource, ImportedAssetBundle } from "@/lib/adapters/import";
import { compileSessionBlueprint } from "../index";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), path), "utf8"));
}

function source(sourcePath: string): AssetSource {
  return {
    sourcePath,
    sourceKind: "manual",
    detectedFormat: "json-character",
    sourceHash: "fixture-hash",
  };
}

function createBundle(raw: unknown, sourcePath: string): ImportedAssetBundle {
  return createImportedAssetBundle({
    bundleId: `bundle:${sourcePath}`,
    sourceHash: "bundle-hash",
    createdAt: "2026-06-04T00:00:00.000Z",
    characterId: `character:${sourcePath}`,
    character: {
      raw,
      source: source(sourcePath),
    },
  });
}

describe("compileInitialState extension sources", () => {
  it("compiles static state snapshot tags into initial variables", () => {
    const blueprint = compileSessionBlueprint(
      createImportedAssetBundle({
        bundleId: "state-snapshot",
        sourceHash: "bundle-hash",
        createdAt: "2026-06-04T00:00:00.000Z",
        characterId: "character:state-snapshot",
        character: {
          raw: { data: { name: "State Snapshot", first_mes: "hello" } },
          source: source("state-snapshot.card.json"),
        },
        worldBooks: [{
          id: "state-book",
          name: "state-book",
          raw: [{
            content: "<status_current_variables>{\"hp\":4,\"route\":{\"day\":2}}</status_current_variables>",
            key: ["state"],
          }],
          source: source("state-book.json"),
        }],
      }),
    );

    expect(blueprint.initialState.sources).toEqual([
      "state-book.json:state-book.entry.0:status_current_variables",
    ]);
    expect(blueprint.initialState.variables).toEqual({
      hp: 4,
      route: {
        day: 2,
      },
    });
  });

  it("diagnoses dynamic state sources and templates without seeding fake values", () => {
    const blueprint = compileSessionBlueprint(
      createImportedAssetBundle({
        bundleId: "state-template",
        sourceHash: "bundle-hash",
        createdAt: "2026-06-04T00:00:00.000Z",
        characterId: "character:state-template",
        character: {
          raw: { data: { name: "State Template", first_mes: "hello" } },
          source: source("state-template.card.json"),
        },
        worldBooks: [{
          id: "state-book",
          name: "state-book",
          raw: [
            {
              content: "<status_current_variables>{{get_message_variable::stat_data}}</status_current_variables>",
              key: ["state"],
            },
            {
              content: "<StatusDashboard>{资源: {余额} EP}</StatusDashboard>",
              key: ["status"],
            },
          ],
          source: source("state-template-book.json"),
        }],
      }),
    );

    expect(blueprint.initialState.variables).toEqual({});
    expect(blueprint.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "story.initial_state.dynamic_source_unsupported",
          sourceField: "state-template-book.json:state-book.entry.0",
        }),
        expect.objectContaining({
          code: "story.initial_state.template_only",
          sourceField: "state-template-book.json:state-book.entry.1",
        }),
      ]),
    );
  });

  it("compiles MVU replay initial objects without executing extension code", () => {
    const mvuReplay = readJson("test-baseline-assets/mvu-examples/variable-chain.json");
    const blueprint = compileSessionBlueprint(
      createBundle({
        data: {
          name: "MVU Replay",
          first_mes: "hello",
          extensions: {
            mvu_replay: mvuReplay,
          },
        },
      }, "mvu-replay.card.json"),
    );

    expect(blueprint.initialState.sources).toEqual([
      "mvu-replay.card.json:data.extensions.mvu_replay.initial",
    ]);
    expect(blueprint.initialState.variables).toEqual({
      hp: 10,
      nested: {
        level: 1,
      },
    });
    expect(blueprint.initialState.errors).toEqual([]);
    expect(blueprint.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "extension.mvu_replay_mutation_unsupported",
          sourceField: "data.extensions.mvu_replay",
        }),
      ]),
    );
  });

  it("compiles TavernHelper variables while keeping scripts unsupported", () => {
    const blueprint = compileSessionBlueprint(
      createBundle({
        data: {
          name: "TavernHelper Variables",
          first_mes: "hello",
          extensions: {
            tavern_helper: [
              ["scripts", [{ name: "remote", content: "import 'https://example.test/script.js'" }]],
              ["variables", { hp: 7, route: { day: 1 } }],
            ],
          },
        },
      }, "tavern-helper-vars.card.json"),
    );

    expect(blueprint.initialState.sources).toEqual([
      "tavern-helper-vars.card.json:data.extensions.tavern_helper.variables",
    ]);
    expect(blueprint.initialState.variables).toEqual({
      hp: 7,
      route: {
        day: 1,
      },
    });
    expect(blueprint.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "extension.unsupported",
          sourceField: "data.extensions.tavern_helper",
        }),
      ]),
    );
  });
});
