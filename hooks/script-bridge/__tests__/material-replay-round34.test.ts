import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleApiCall } from "../index";
import type { ApiCallContext } from "../types";
import type { DialogueMessage } from "@/types/character-dialogue";

interface RotationCase {
  name: string;
  begin: number;
  middle: number;
  end: number;
}

interface ScriptTreeNode {
  type: string;
  id: string;
  name: string;
}

interface MaterialFixture {
  messages: DialogueMessage[];
  rotateCases: RotationCase[];
  scriptTreeSeed: {
    character: ScriptTreeNode[];
    preset: ScriptTreeNode[];
    appendNode: ScriptTreeNode;
  };
}

const MATERIAL_PATH = path.join(
  process.cwd(),
  "hooks",
  "script-bridge",
  "__tests__",
  "fixtures",
  "round34-migration-material.json",
);

const fixture = JSON.parse(fs.readFileSync(MATERIAL_PATH, "utf8")) as MaterialFixture;

function createMockContext(overrides: Partial<ApiCallContext> = {}): ApiCallContext {
  return {
    characterId: "char-material-test",
    dialogueId: "dialogue-material-test",
    presetName: "preset-material-test",
    messages: fixture.messages,
    setScriptVariable: vi.fn(),
    deleteScriptVariable: vi.fn(),
    getVariablesSnapshot: () => ({
      global: {},
      character: {},
    }),
    ...overrides,
  };
}

function buildExpectedRotation(
  messages: DialogueMessage[],
  begin: number,
  middle: number,
  end: number,
): {
  ids: string[];
  updates: Array<{ message_id: string; message: string; role: string; name: string | undefined }>;
} {
  const affected = messages.slice(begin, end);
  const movingOffset = middle - begin;
  const rotated = affected.slice(movingOffset).concat(affected.slice(0, movingOffset));

  return {
    ids: affected.map((message) => message.id),
    updates: affected.map((message, index) => ({
      message_id: message.id,
      message: rotated[index]?.content ?? "",
      role: rotated[index]?.role ?? "",
      name: rotated[index]?.name,
    })),
  };
}

async function replayUpdateScriptTreesWith(
  ctx: ApiCallContext,
  updater: (trees: ScriptTreeNode[]) => ScriptTreeNode[],
  options: { scope: "global" | "preset" | "character" },
): Promise<ScriptTreeNode[]> {
  const current = await handleApiCall("getScriptTrees", [options], ctx) as ScriptTreeNode[];
  const next = updater(current);

  if (!Array.isArray(next)) {
    throw new Error("replayUpdateScriptTreesWith updater must return array");
  }

  await handleApiCall("replaceScriptTrees", [next, options], ctx);
  return next;
}

describe("material replay round 34", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem("DreamMiniStage:script-trees");
  });

  it.each(fixture.rotateCases)(
    "replays rotateChatMessages case: $name",
    async (rotationCase: RotationCase) => {
      const ctx = createMockContext();
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");

      const rotatedIds = await handleApiCall(
        "rotateChatMessages",
        [rotationCase.begin, rotationCase.middle, rotationCase.end],
        ctx,
      ) as string[];

      const expected = buildExpectedRotation(
        fixture.messages,
        rotationCase.begin,
        rotationCase.middle,
        rotationCase.end,
      );

      expect(rotatedIds).toEqual(expected.ids);

      const emitted = dispatchSpy.mock.calls.at(-1)?.[0] as CustomEvent;
      expect(emitted.type).toBe("DreamMiniStage:setChatMessages");
      expect(emitted.detail).toEqual(expect.objectContaining({
        messages: expected.updates,
        options: {
          refresh: "affected",
        },
      }));
    },
  );

  it("replays script tree update flow with scope isolation and persistence", async () => {
    const ctx = createMockContext();

    await handleApiCall("replaceScriptTrees", [fixture.scriptTreeSeed.character], ctx);
    await handleApiCall("replaceScriptTrees", [fixture.scriptTreeSeed.preset, { scope: "preset" }], ctx);

    const updatedCharacterTrees = await replayUpdateScriptTreesWith(
      ctx,
      (trees) => [...trees, fixture.scriptTreeSeed.appendNode],
      { scope: "character" },
    );

    expect(updatedCharacterTrees).toEqual([
      ...fixture.scriptTreeSeed.character,
      fixture.scriptTreeSeed.appendNode,
    ]);

    const characterTrees = await handleApiCall(
      "getScriptTrees",
      [{ scope: "character" }],
      ctx,
    ) as ScriptTreeNode[];
    expect(characterTrees).toEqual(updatedCharacterTrees);

    const presetTrees = await handleApiCall(
      "getScriptTrees",
      [{ scope: "preset" }],
      ctx,
    ) as ScriptTreeNode[];
    expect(presetTrees).toEqual(fixture.scriptTreeSeed.preset);

    const allTrees = await handleApiCall(
      "getScriptTrees",
      [{ scope: "all" }],
      ctx,
    ) as {
      global: ScriptTreeNode[];
      preset: Record<string, ScriptTreeNode[]>;
      character: Record<string, ScriptTreeNode[]>;
    };

    expect(allTrees).toEqual(expect.objectContaining({
      global: [],
      preset: {
        "preset-material-test": fixture.scriptTreeSeed.preset,
      },
      character: {
        "char-material-test": updatedCharacterTrees,
      },
    }));

    const reloadedContext = createMockContext({ messages: fixture.messages.slice(0, 2) });
    const persistedTrees = await handleApiCall(
      "getScriptTrees",
      [{ scope: "character" }],
      reloadedContext,
    ) as ScriptTreeNode[];

    expect(persistedTrees).toEqual(updatedCharacterTrees);
  });
});
