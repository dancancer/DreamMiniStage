import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importWorldBookEntries } from "@/lib/adapters/import/worldbook-import";
import { WorldBookAdvancedManager } from "@/lib/core/world-book-advanced";

const FIXTURE_PATH = path.join(
  process.cwd(),
  "lib/core/__tests__/fixtures/phase4/worldbook-import.json",
);

describe("phase4 worldbook migration baseline", () => {
  it("keeps imported worldbook probability semantics in matching flow", () => {
    const raw = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as unknown;
    const entries = importWorldBookEntries(raw);
    const manager = new WorldBookAdvancedManager();

    manager.addEntries(entries, "global");

    const matched = manager.getMatchingEntries("服装搭配", [], {
      enableProbability: true,
      enableInclusionGroups: true,
    });
    const injections = manager.generateDepthInjections(matched);

    expect(entries[0]?.useProbability).toBe(true);
    expect(entries[0]?.depth).toBe(4);
    expect(entries[1]?.groupWeight).toBe(100);
    expect(matched.length).toBeGreaterThan(0);
    expect(injections.some((item) => item.depth === 4)).toBe(true);
  });
});
