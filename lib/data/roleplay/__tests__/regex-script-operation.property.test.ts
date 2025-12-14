/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                  Regex Script Operations Property Tests                   ║
 * ║                                                                           ║
 * ║  **Feature: regex-sillytavern-compat, Property 1: 脚本合并顺序一致性**     ║
 * ║  **Feature: regex-sillytavern-compat, Property 2: 授权过滤完整性**         ║
 * ║  **Feature: regex-sillytavern-compat, Property 8: 批量启用/禁用一致性**    ║
 * ║  **Feature: regex-sillytavern-compat, Property 9: 批量删除完整性**         ║
 * ║                                                                           ║
 * ║  验证脚本多来源合并、授权过滤与批量操作的核心不变量。                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fc from "fast-check";
import { RegexPlacement, RegexScript, ScriptSource } from "@/lib/models/regex-script-model";

/* ═══════════════════════════════════════════════════════════════════════════
   Mock 存储层
   ═══════════════════════════════════════════════════════════════════════════ */

const REGEX_STORE = "regex_scripts";
const ALLOW_STORE = "regex_allow_list";

const mockStores: Record<string, Map<string, any>> = {
  [REGEX_STORE]: new Map(),
  [ALLOW_STORE]: new Map(),
};

const deepClone = <T>(data: T): T => JSON.parse(JSON.stringify(data));

function resetStores() {
  Object.values(mockStores).forEach(store => store.clear());
}

vi.mock("@/lib/data/local-storage", () => ({
  REGEX_SCRIPTS_FILE: REGEX_STORE,
  REGEX_ALLOW_LIST_FILE: ALLOW_STORE,
  getRecordByKey: async (store: string, key: string) => {
    const bucket = mockStores[store];
    if (!bucket) return null;
    const value = bucket.get(key);
    return value ? deepClone(value) : null;
  },
  putRecord: async (store: string, key: string, value: any) => {
    if (!mockStores[store]) {
      mockStores[store] = new Map<string, any>();
    }
    mockStores[store].set(key, deepClone(value));
  },
  getAllEntries: async (store: string) => {
    const bucket = mockStores[store] ?? new Map<string, any>();
    return Array.from(bucket.entries()).map(([key, value]) => ({
      key,
      value: deepClone(value),
    }));
  },
  clearStore: async (store: string) => {
    mockStores[store]?.clear();
  },
}));

// 动态导入以确保 mock 生效
const { RegexScriptOperations } = await import("../regex-script-operation");

/* ═══════════════════════════════════════════════════════════════════════════
   辅助生成器与工具
   ═══════════════════════════════════════════════════════════════════════════ */

// 排除 JavaScript 对象的内置属性名，避免类型冲突
const RESERVED_NAMES = new Set([
  "constructor", "prototype", "__proto__", "toString", "valueOf",
  "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable",
  "toLocaleString", "__defineGetter__", "__defineSetter__",
  "__lookupGetter__", "__lookupSetter__",
]);

const safeIdArb = fc.stringMatching(/^[a-zA-Z0-9_-]+$/)
  .filter(s => s.length > 0 && s.length <= 16 && !RESERVED_NAMES.has(s));

const placementArb = fc.array(
  fc.constantFrom(
    RegexPlacement.USER_INPUT,
    RegexPlacement.AI_OUTPUT,
    RegexPlacement.SLASH_COMMAND,
    RegexPlacement.WORLD_INFO,
    RegexPlacement.REASONING,
  ),
  { minLength: 1, maxLength: 2 },
);

const scriptSeedArb = fc.record({
  scriptName: safeIdArb,
  findRegex: fc.string({ minLength: 1, maxLength: 30 }),
  replaceString: fc.option(fc.string({ maxLength: 30 }), { nil: undefined }),
  placement: placementArb,
});

function toScriptRecord(seeds: fc.infer<typeof scriptSeedArb>[], prefix: string): Record<string, RegexScript> {
  return seeds.reduce<Record<string, RegexScript>>((acc, seed, index) => {
    const key = `${prefix}_${index}`;
    acc[key] = {
      scriptKey: key,
      scriptName: seed.scriptName,
      findRegex: seed.findRegex,
      replaceString: seed.replaceString,
      trimStrings: [],
      placement: seed.placement,
      disabled: false,
    };
    return acc;
  }, {});
}

function writeScripts(ownerId: string, scripts: Record<string, RegexScript>) {
  mockStores[REGEX_STORE].set(ownerId, deepClone(scripts));
}

const countBySource = (scripts: RegexScript[], source: ScriptSource) =>
  scripts.filter(s => s.source === source).length;

type ScriptBundle = {
  seed: fc.infer<typeof scriptSeedArb>;
  initiallyDisabled: boolean;
  selected: boolean;
};

const scriptBundleArb = fc.array(
  fc.record({
    seed: scriptSeedArb,
    initiallyDisabled: fc.boolean(),
    selected: fc.boolean(),
  }),
  { minLength: 1, maxLength: 5 },
).filter(bundle => bundle.some(item => item.selected));

function toScriptRecordWithState(entries: ScriptBundle[], prefix: string): {
  scripts: Record<string, RegexScript>;
  selected: string[];
} {
  const scripts: Record<string, RegexScript> = {};
  const selected: string[] = [];

  entries.forEach((entry, index) => {
    const key = `${prefix}_${index}`;
    scripts[key] = {
      scriptKey: key,
      scriptName: entry.seed.scriptName,
      findRegex: entry.seed.findRegex,
      replaceString: entry.seed.replaceString,
      trimStrings: [],
      placement: entry.seed.placement,
      disabled: entry.initiallyDisabled,
    };

    if (entry.selected) {
      selected.push(key);
    }
  });

  return { scripts, selected };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Property 1: 脚本合并顺序一致性
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 1: 脚本合并顺序一致性", () => {
  it("*For any* global/character/preset scripts, merge order SHALL be deterministic with source metadata", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(scriptSeedArb, { minLength: 1, maxLength: 3 }),
        fc.array(scriptSeedArb, { minLength: 1, maxLength: 3 }),
        fc.array(scriptSeedArb, { minLength: 1, maxLength: 3 }),
        safeIdArb,
        safeIdArb,
        safeIdArb,
        async (globalSeeds, characterSeeds, presetSeeds, ownerId, presetName, apiId) => {
          resetStores();

          const presetOwnerId = `preset_${presetName}`;

          writeScripts(ScriptSource.GLOBAL, toScriptRecord(globalSeeds, "g"));
          writeScripts(ownerId, toScriptRecord(characterSeeds, "c"));
          writeScripts(presetOwnerId, toScriptRecord(presetSeeds, "p"));

          const merged = await RegexScriptOperations.getAllScriptsForProcessing(ownerId, {
            presetSource: {
              ownerId: presetOwnerId,
              apiId,
              presetName,
            },
          });

          expect(merged.length).toBe(globalSeeds.length + characterSeeds.length + presetSeeds.length);

          merged.forEach(script => {
            const expectedId = script.source === ScriptSource.GLOBAL
              ? ScriptSource.GLOBAL
              : script.source === ScriptSource.CHARACTER
                ? ownerId
                : presetOwnerId;
            expect(script.source).toBeDefined();
            expect(script.sourceId).toBe(expectedId);
          });

          const positionsFor = (source: ScriptSource) =>
            merged.map((s, idx) => (s.source === source ? idx : -1)).filter(i => i >= 0);

          const globalIdx = positionsFor(ScriptSource.GLOBAL);
          const characterIdx = positionsFor(ScriptSource.CHARACTER);
          const presetIdx = positionsFor(ScriptSource.PRESET);

          expect(Math.max(...globalIdx)).toBeLessThan(Math.min(...characterIdx));
          expect(Math.max(...characterIdx)).toBeLessThan(Math.min(...presetIdx));

          const rank = (s: RegexScript) => s.placement?.[0] ?? 999;
          const assertSorted = (list: RegexScript[]) => {
            for (let i = 1; i < list.length; i++) {
              expect(rank(list[i - 1])).toBeLessThanOrEqual(rank(list[i]));
            }
          };

          assertSorted(merged.filter(s => s.source === ScriptSource.GLOBAL));
          assertSorted(merged.filter(s => s.source === ScriptSource.CHARACTER));
          assertSorted(merged.filter(s => s.source === ScriptSource.PRESET));
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 2: 授权过滤完整性
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 2: 授权过滤完整性", () => {
  beforeEach(() => resetStores());

  it("*For any* allow-list configuration, allowedOnly SHALL filter character/preset sources", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.boolean(),
        fc.array(scriptSeedArb, { minLength: 1, maxLength: 2 }),
        fc.array(scriptSeedArb, { minLength: 1, maxLength: 2 }),
        fc.array(scriptSeedArb, { minLength: 1, maxLength: 2 }),
        safeIdArb,
        safeIdArb,
        safeIdArb,
        async (allowCharacter, allowPreset, globalSeeds, characterSeeds, presetSeeds, ownerId, presetName, apiId) => {
          resetStores();

          const presetOwnerId = `preset_${presetName}`;

          writeScripts(ScriptSource.GLOBAL, toScriptRecord(globalSeeds, "g"));
          writeScripts(ownerId, toScriptRecord(characterSeeds, "c"));
          writeScripts(presetOwnerId, toScriptRecord(presetSeeds, "p"));

          const allowList = {
            characters: allowCharacter ? [ownerId] : [],
            presets: allowPreset ? { [apiId]: [presetName] } : {},
          };
          mockStores[ALLOW_STORE].set("default", deepClone(allowList));

          const filtered = await RegexScriptOperations.getAllScriptsForProcessing(ownerId, {
            allowedOnly: true,
            presetSource: {
              ownerId: presetOwnerId,
              apiId,
              presetName,
            },
          });

          const unfiltered = await RegexScriptOperations.getAllScriptsForProcessing(ownerId, {
            allowedOnly: false,
            presetSource: {
              ownerId: presetOwnerId,
              apiId,
              presetName,
            },
          });

          expect(countBySource(filtered, ScriptSource.GLOBAL)).toBe(globalSeeds.length);
          expect(countBySource(filtered, ScriptSource.CHARACTER)).toBe(
            allowCharacter ? characterSeeds.length : 0,
          );
          expect(countBySource(filtered, ScriptSource.PRESET)).toBe(
            allowPreset ? presetSeeds.length : 0,
          );

          expect(countBySource(unfiltered, ScriptSource.CHARACTER)).toBe(characterSeeds.length);
          expect(countBySource(unfiltered, ScriptSource.PRESET)).toBe(presetSeeds.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 8: 批量启用/禁用一致性
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 8: 批量启用/禁用一致性", () => {
  beforeEach(() => resetStores());

  it("*For any* selected scripts, bulk enable/disable SHALL converge to target state", async () => {
    await fc.assert(
      fc.asyncProperty(
        scriptBundleArb,
        fc.boolean(),
        async (bundle, targetEnabled) => {
          const ownerId = "owner_bulk_toggle";
          const { scripts, selected } = toScriptRecordWithState(bundle, "b");

          writeScripts(ownerId, scripts);

          if (targetEnabled) {
            await RegexScriptOperations.bulkEnable(ownerId, selected);
          } else {
            await RegexScriptOperations.bulkDisable(ownerId, selected);
          }

          const updated = (await RegexScriptOperations.getRegexScripts(ownerId)) ?? {};

          selected.forEach(id => {
            expect(updated[id]?.disabled).toBe(!targetEnabled);
          });

          Object.keys(updated).forEach(id => {
            if (selected.includes(id)) return;
            expect(updated[id]?.disabled).toBe(scripts[id].disabled);
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 9: 批量删除完整性
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 9: 批量删除完整性", () => {
  beforeEach(() => resetStores());

  it("*For any* selected scripts, bulk delete SHALL remove only chosen entries", async () => {
    await fc.assert(
      fc.asyncProperty(
        scriptBundleArb,
        async bundle => {
          const ownerId = "owner_bulk_delete";
          const { scripts, selected } = toScriptRecordWithState(bundle, "d");

          writeScripts(ownerId, scripts);
          await RegexScriptOperations.bulkDelete(ownerId, selected);

          const updated = (await RegexScriptOperations.getRegexScripts(ownerId)) ?? {};

          selected.forEach(id => {
            expect(updated[id]).toBeUndefined();
          });

          Object.keys(scripts)
            .filter(id => !selected.includes(id))
            .forEach(id => {
              expect(updated[id]).toEqual(scripts[id]);
            });
        },
      ),
      { numRuns: 100 },
    );
  });
});
