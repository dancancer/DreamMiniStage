import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  importWorldBookEntries,
  normalizeSelectiveLogic,
} from "../worldbook-import";

describe("worldbook import selectiveLogic normalization", () => {
  it("maps SillyTavern numeric logic to local canonical logic", () => {
    expect(normalizeSelectiveLogic(0)).toBe("AND_ANY");
    expect(normalizeSelectiveLogic(1)).toBe("NOT_ALL");
    expect(normalizeSelectiveLogic(2)).toBe("NOT_ANY");
    expect(normalizeSelectiveLogic(3)).toBe("AND_ALL");
  });

  it("fails fast on unsupported logic values", () => {
    expect(() => normalizeSelectiveLogic(4)).toThrow(
      "Unsupported worldbook selectiveLogic: 4",
    );
    expect(() => normalizeSelectiveLogic("XOR")).toThrow(
      "Unsupported worldbook selectiveLogic: XOR",
    );
  });

  it("imports the Phase 0 worldbook fixture into normalized schema", () => {
    const file = join(process.cwd(), "test-baseline-assets/worldbook/服装随机化.json");
    const raw = JSON.parse(readFileSync(file, "utf8"));
    const entries = importWorldBookEntries(raw);

    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.selectiveLogic)).toEqual([
      "AND_ANY",
      "AND_ANY",
      "AND_ANY",
    ]);
    expect(entries.every((entry) => Array.isArray(entry.secondary_keys))).toBe(true);
    expect(entries.map((entry) => entry.enabled)).toEqual([true, false, false]);
    expect(entries[0]).toMatchObject({
      probability: 100,
      useProbability: true,
      depth: 4,
      groupWeight: 100,
      group_weight: 100,
    });
    expect(entries[0].extensions).toMatchObject({
      addMemo: true,
      vectorized: false,
      groupOverride: false,
      role: 0,
      displayIndex: 0,
    });
  });
});
