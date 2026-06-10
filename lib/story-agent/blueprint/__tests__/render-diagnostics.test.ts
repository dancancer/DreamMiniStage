import { describe, expect, it } from "vitest";
import {
  createImportedAssetBundle,
  type AssetSource,
  type ImportedAssetBundle,
} from "@/lib/adapters/import";
import { compileSessionBlueprint } from "../index";

describe("Story Agent render contract diagnostics", () => {
  it("warns when a status-like JSON source tag has no RenderIntent", () => {
    const blueprint = compileSessionBlueprint(createBundle({
      description: "<status>{\"mode\":\"status\",\"characters\":[]}</status>",
    }));

    expect(blueprint.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "render.status_contract_unsupported",
          targetPath: "profile.promptFragments.character.description",
          sourceField: "data.description",
        }),
      ]),
    );
  });

  it("does not warn when the status source tag is covered by a RenderIntent", () => {
    const blueprint = compileSessionBlueprint(createBundle({
      description: "<SFW>{\"mode\":\"sfw\",\"characters\":[]}</SFW>",
      regexScripts: [{
        scriptName: "状态栏",
        findRegex: "<SFW>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/SFW>",
        replaceString: "<div class=\"status-panel\"><div data-field=\"日期\">$1</div></div>",
        placement: [2],
        markdownOnly: true,
      }],
    }));

    expect(blueprint.renderRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "status-panel",
          sourcePattern: "<SFW>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/SFW>",
        }),
      ]),
    );
    expect(blueprint.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "render.status_contract_unsupported",
        }),
      ]),
    );
  });

  it("does not warn when a custom status dashboard source tag is covered by a RenderIntent", () => {
    const blueprint = compileSessionBlueprint(createBundle({
      description: "<StatusDashboard>{\"sections\":[],\"meters\":[]}</StatusDashboard>",
      regexScripts: [{
        scriptName: "战术终端",
        findRegex: "<StatusDashboard>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/StatusDashboard>",
        replaceString: "<div class=\"status-panel\"><div data-field=\"资源\">$1</div></div>",
        placement: [2],
        markdownOnly: true,
      }],
    }));

    expect(blueprint.renderRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "status-panel",
          sourcePattern: "<StatusDashboard>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/StatusDashboard>",
        }),
      ]),
    );
    expect(blueprint.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "render.status_contract_unsupported",
        }),
      ]),
    );
  });
});

function createBundle(input: {
  description: string;
  regexScripts?: unknown[];
}): ImportedAssetBundle {
  return createImportedAssetBundle({
    bundleId: "render-diagnostics",
    sourceHash: "render-diagnostics-hash",
    createdAt: "2026-06-01T00:00:00.000Z",
    characterId: "character:render-diagnostics",
    character: {
      raw: {
        data: {
          name: "Render Diagnostics",
          description: input.description,
          first_mes: "Opening.",
        },
      },
      source: source("render-diagnostics.card.json", "json-character"),
    },
    regexScripts: input.regexScripts ? [{
      id: "status-regex",
      name: "status-regex",
      raw: input.regexScripts,
      source: source("status-regex.json", "regex"),
    }] : undefined,
  });
}

function source(path: string, kind: AssetSource["sourceKind"]): AssetSource {
  return {
    sourcePath: path,
    sourceKind: kind,
    detectedFormat: kind,
    sourceHash: `${kind}:fixture`,
  };
}
