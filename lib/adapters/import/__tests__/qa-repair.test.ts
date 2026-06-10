import { describe, expect, it } from "vitest";
import { createImportedAssetBundle } from "../bundle-builder";
import type { AssetSource, ImportedAssetBundle } from "../bundle-types";
import { runImportQaRepair } from "../qa-repair";
import type { LlmQaInput } from "../repair-patch";

function source(sourcePath: string): AssetSource {
  return {
    sourcePath,
    sourceKind: "manual",
    detectedFormat: "json-character",
    sourceHash: "fixture-hash",
  };
}

function makeBundle(): ImportedAssetBundle {
  return createImportedAssetBundle({
    bundleId: "bundle:qa",
    sourceHash: "bundle-hash",
    createdAt: "2026-06-10T00:00:00.000Z",
    characterId: "character:qa",
    character: {
      raw: {
        data: {
          name: "QA Card",
          description: "original description",
          creator: "orig",
          first_mes: "hi",
        },
      },
      source: source("qa.card.json"),
    },
  });
}

function makeBundleMissingDescription(): ImportedAssetBundle {
  return createImportedAssetBundle({
    bundleId: "bundle:qa-empty",
    sourceHash: "bundle-hash",
    createdAt: "2026-06-10T00:00:00.000Z",
    characterId: "character:qa-empty",
    character: {
      raw: { data: { name: "QA Card", first_mes: "hi" } },
      source: source("qa-empty.card.json"),
    },
  });
}

describe("runImportQaRepair", () => {
  it("rejects a patch targeting a path outside the offered allowlist", async () => {
    const bundle = makeBundleMissingDescription();
    const qaModel = async () => ({
      patches: [
        {
          id: "p1",
          operation: "replace",
          targetPath: "/character/creator",
          value: "qa-bot",
          reason: "unsolicited change outside repairablePaths",
        },
      ],
    });

    await expect(runImportQaRepair(bundle, qaModel)).rejects.toThrow();
  });

  it("offers JSON Pointer repairable paths the model can echo and validate", async () => {
    const bundle = makeBundleMissingDescription();
    let received: LlmQaInput | undefined;
    const qaModel = async (input: LlmQaInput) => {
      received = input;
      return {
        patches: [
          {
            id: "p1",
            operation: "replace",
            targetPath: input.repairablePaths[0],
            value: "filled description",
            reason: "fill empty description",
          },
        ],
      };
    };

    const outcome = await runImportQaRepair(bundle, qaModel);

    expect(received?.repairablePaths).toContain("/character/description");
    expect(outcome.pendingConfirmation.map((entry) => entry.patch.targetPath)).toContain(
      "/character/description",
    );
    // /character/description is high-risk → deferred, not auto-applied.
    expect(outcome.autoApplied).toEqual([]);
    expect(outcome.bundle.character.description).toBeUndefined();
  });

  it("propagates patch validation errors instead of swallowing them", async () => {
    const bundle = makeBundle();
    const qaModel = async () => ({
      patches: [
        {
          id: "p1",
          operation: "replace",
          targetPath: "/character/creator",
          value: "x",
          reason: "mislabeled risk",
          claimedRisk: "high",
        },
      ],
    });

    await expect(runImportQaRepair(bundle, qaModel)).rejects.toThrow();
  });

  it("includes caller-supplied extra diagnostics in the QA input", async () => {
    const bundle = makeBundle();
    let received: LlmQaInput | undefined;
    const qaModel = async (input: LlmQaInput) => {
      received = input;
      return { patches: [] };
    };

    await runImportQaRepair(bundle, qaModel, {
      extraDiagnostics: [
        {
          code: "story.initial_state.template_only",
          severity: "warning",
          message: "template only",
          targetPath: "initialState.variables",
        },
      ],
    });

    expect(received?.diagnostics.some((d) => d.code === "story.initial_state.template_only")).toBe(
      true,
    );
    // state-source diagnostics add context but must NOT widen the patchable allowlist.
    expect(received?.repairablePaths).toEqual([]);
  });

  it("passes bundle id, schema version and diagnostics to the QA model", async () => {
    const bundle = makeBundle();
    let received: LlmQaInput | undefined;
    const qaModel = async (input: LlmQaInput) => {
      received = input;
      return { patches: [] };
    };

    await runImportQaRepair(bundle, qaModel);

    expect(received?.bundleId).toBe("bundle:qa");
    expect(received?.schemaVersion).toBe(bundle.schemaVersion);
    expect(Array.isArray(received?.diagnostics)).toBe(true);
    expect(Array.isArray(received?.repairablePaths)).toBe(true);
  });
});
