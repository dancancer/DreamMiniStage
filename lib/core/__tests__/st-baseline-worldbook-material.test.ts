/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║            素材驱动 WorldBook 组合语义回归                                  ║
 * ║                                                                           ║
 * ║  目标：固定 probability/useProbability/depth/group/groupWeight            ║
 * ║       的执行链语义，避免真实素材迁移被回归破坏。                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importWorldBookEntries } from "@/lib/adapters/import/worldbook-import";
import { WorldBookAdvancedManager } from "@/lib/core/world-book-advanced";
import type { WorldBookEntry } from "@/lib/models/world-book-model";

const WORLDBOOK_ASSET_PATH = path.join(
  process.cwd(),
  "lib/core/__tests__/fixtures/phase4",
  "worldbook-import.json",
);

function createEntry(overrides: Partial<WorldBookEntry>): WorldBookEntry {
  return {
    content: "default",
    keys: ["trigger"],
    selective: true,
    constant: false,
    position: 4,
    enabled: true,
    ...overrides,
  };
}

describe("素材驱动 WorldBook 组合语义", () => {
  it("服装随机化素材导入应保留 useProbability/depth/groupWeight 字段", () => {
    const raw = JSON.parse(fs.readFileSync(WORLDBOOK_ASSET_PATH, "utf8")) as unknown;
    const entries = importWorldBookEntries(raw);

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.useProbability === true)).toBe(true);
    expect(entries.every((entry) => entry.depth === 4)).toBe(true);
    expect(entries.every((entry) => entry.group_weight === 100)).toBe(true);
  });

  it("probability/useProbability/depth/group/groupWeight 组合应一致生效", () => {
    const manager = new WorldBookAdvancedManager();
    const entries: WorldBookEntry[] = [
      createEntry({
        entry_id: "keep-by-use-probability",
        keys: ["魔法"],
        content: "高权重分组条目",
        probability: 0,
        useProbability: false,
        depth: 6,
        group: "combat",
        groupWeight: 200,
      }),
      createEntry({
        entry_id: "lose-by-group-weight",
        keys: ["魔法"],
        content: "低权重分组条目",
        probability: 100,
        useProbability: true,
        depth: 2,
        group: "combat",
        groupWeight: 100,
      }),
      createEntry({
        entry_id: "other-group",
        keys: ["魔法"],
        content: "其他分组条目",
        probability: 100,
        useProbability: true,
        depth: 4,
        group: "lore",
        groupWeight: 10,
      }),
    ];

    manager.addEntries(entries, "global");

    const matched = manager.getMatchingEntries("学习魔法", [], {
      enableProbability: true,
      enableInclusionGroups: true,
    });
    const matchedIds = matched.map((item) => item.entry.entry_id);
    const depthInjections = manager.generateDepthInjections(matched);

    expect(matchedIds).toEqual(expect.arrayContaining([
      "keep-by-use-probability",
      "other-group",
    ]));
    expect(matchedIds).not.toContain("lose-by-group-weight");

    const keepEntry = matched.find((item) => item.entry.entry_id === "keep-by-use-probability");
    expect(keepEntry?.depth).toBe(6);
    expect(depthInjections.some((item) => item.depth === 6 && item.content === "高权重分组条目")).toBe(true);
  });
});
