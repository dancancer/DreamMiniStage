import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { scopedVariables } from "../scoped-variables";
import { variableHandlers } from "../variable-handlers";
import type { ApiCallContext } from "../types";

function createEmptySnapshot() {
  return {
    global: {},
    preset: {},
    character: {},
    chat: {},
    message: {},
    script: {},
  };
}

interface VariableChainFixture {
  scope: {
    type: "chat";
  };
  initial: Record<string, unknown>;
  update: Record<string, unknown>;
  insert: Record<string, unknown>;
  expect: Record<string, unknown>;
}

const VARIABLE_CHAIN_FIXTURE_PATH = path.join(
  process.cwd(),
  "test-baseline-assets",
  "mvu-examples",
  "variable-chain.json",
);

const variableChainFixture = JSON.parse(
  fs.readFileSync(VARIABLE_CHAIN_FIXTURE_PATH, "utf8"),
) as VariableChainFixture;

function createMockContext(overrides: Partial<ApiCallContext> = {}): ApiCallContext {
  return {
    characterId: "char-test",
    dialogueId: "dialogue-test",
    chatId: "dialogue-test",
    messages: [
      { id: "m0", role: "user", content: "hello" },
      { id: "m1", role: "assistant", content: "world" },
      { id: "m2", role: "assistant", content: "latest" },
    ],
    setScriptVariable: vi.fn(),
    deleteScriptVariable: vi.fn(),
    getVariablesSnapshot: () => ({
      global: {},
      character: {},
    }),
    ...overrides,
  };
}

describe("variable handlers option semantics", () => {
  beforeEach(() => {
    scopedVariables.restoreFromSnapshot(createEmptySnapshot());
  });

  it("defaults collection APIs to chat scope", () => {
    const ctx = createMockContext();

    variableHandlers.replaceVariables([{ hp: 12 }, { type: "chat" }], ctx);
    variableHandlers.replaceVariables([{ world: "alpha" }, { type: "global" }], ctx);

    const defaultVars = variableHandlers.getVariables([], ctx) as Record<string, unknown>;

    expect(defaultVars).toMatchObject({ hp: 12 });
    expect(defaultVars).not.toHaveProperty("world");
  });

  it("supports upstream type/message_id option shape", () => {
    const ctx = createMockContext();

    variableHandlers.replaceVariables(
      [{ hp: 99, stamina: 8 }, { type: "message", message_id: -1 }],
      ctx,
    );

    const latestVars = variableHandlers.getVariables(
      [{ type: "message", message_id: "latest" }],
      ctx,
    ) as Record<string, unknown>;
    const indexedVars = variableHandlers.getVariables(
      [{ type: "message", message_id: 2 }],
      ctx,
    ) as Record<string, unknown>;

    expect(latestVars).toMatchObject({ hp: 99, stamina: 8 });
    expect(indexedVars).toMatchObject({ hp: 99, stamina: 8 });
  });

  it("throws on out-of-range message_id", () => {
    const ctx = createMockContext();

    expect(() => {
      variableHandlers.getVariables([{ type: "message", message_id: 3 }], ctx);
    }).toThrow("超出范围");
  });

  it("accepts legacy string scope and new option object on single variable APIs", () => {
    const ctx = createMockContext();

    variableHandlers.setVariable(["legacy", "ok", "global"], ctx);
    variableHandlers.setVariable(["counter", 1, { type: "chat" }], ctx);

    const globalValue = variableHandlers.getVariable(["legacy", "global"], ctx);
    const chatValue = variableHandlers.getVariable(["counter", { type: "chat" }], ctx);

    expect(globalValue).toBe("ok");
    expect(chatValue).toBe(1);

    variableHandlers.deleteVariable(["counter", { type: "chat" }], ctx);
    const deleted = variableHandlers.getVariable(["counter", { type: "chat" }], ctx);

    expect(deleted).toBeUndefined();
  });

  it("supports registerVariableSchema/updateVariablesWith/insertVariables", () => {
    const ctx = createMockContext();

    const registered = variableHandlers.registerVariableSchema(
      [{ type: "object", properties: { hp: { type: "number" } } }, { type: "chat" }],
      ctx,
    );
    expect(registered).toBe(true);

    variableHandlers.replaceVariables([{ hp: 10, nested: { level: 1 } }, { type: "chat" }], ctx);
    const updated = variableHandlers.updateVariablesWith(
      [{ hp: 15, nested: { level: 2 } }, { type: "chat" }],
      ctx,
    ) as Record<string, unknown>;
    expect(updated).toMatchObject({ hp: 15, nested: { level: 2 } });

    const inserted = variableHandlers.insertVariables(
      [{ hp: 100, nested: { level: 9, bonus: 3 }, fresh: true }, { type: "chat" }],
      ctx,
    ) as Record<string, unknown>;
    expect(inserted).toMatchObject({
      hp: 15,
      nested: { level: 2, bonus: 3 },
      fresh: true,
    });
  });

  it("replays mvu variable-chain baseline asset", () => {
    const ctx = createMockContext();
    const scope = variableChainFixture.scope;

    const registered = variableHandlers.registerVariableSchema(
      [{ type: "object", properties: { hp: { type: "number" } } }, scope],
      ctx,
    );

    const replaced = variableHandlers.replaceVariables([variableChainFixture.initial, scope], ctx);
    const updated = variableHandlers.updateVariablesWith(
      [variableChainFixture.update, scope],
      ctx,
    ) as Record<string, unknown>;
    const inserted = variableHandlers.insertVariables(
      [variableChainFixture.insert, scope],
      ctx,
    ) as Record<string, unknown>;
    const current = variableHandlers.getVariables([scope], ctx) as Record<string, unknown>;

    expect(registered).toBe(true);
    expect(replaced).toBe(true);
    expect(updated).toEqual(variableChainFixture.update);
    expect(inserted).toEqual(variableChainFixture.expect);
    expect(current).toEqual(variableChainFixture.expect);
  });

  it("fails fast on invalid registerVariableSchema/updateVariablesWith inputs", () => {
    const ctx = createMockContext();

    expect(() => {
      variableHandlers.registerVariableSchema([undefined, { type: "chat" }], ctx);
    }).toThrow("schema 参数");

    expect(() => {
      variableHandlers.registerVariableSchema([{}, { type: "script" }], ctx);
    }).toThrow("不支持作用域");

    expect(() => {
      variableHandlers.updateVariablesWith([42, { type: "chat" }], ctx);
    }).toThrow("plain object");
  });
});
