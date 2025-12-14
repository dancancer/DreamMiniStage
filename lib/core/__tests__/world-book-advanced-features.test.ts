/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    World Book 高级功能测试                                  ║
 * ║                                                                            ║
 * ║  测试新增的 SillyTavern 兼容功能：                                           ║
 * ║  1. 递归激活                                                                ║
 * ║  2. 全词匹配                                                                ║
 * ║  3. 大小写敏感                                                              ║
 * ║  4. Token 预算管理                                                          ║
 * ║  5. 包含组评分                                                              ║
 * ║  6. 最小激活数                                                              ║
 * ║  7. 缓存机制                                                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  WorldBookAdvancedManager,
  createWorldBookManager,
  getGlobalWorldBookCache,
} from "../world-book-advanced";
import type { WorldBookEntry } from "@/lib/models/world-book-model";

/* ═══════════════════════════════════════════════════════════════════════════
   测试辅助函数
   ═══════════════════════════════════════════════════════════════════════════ */

function createEntry(overrides: Partial<WorldBookEntry>): WorldBookEntry {
  return {
    content: "default content",
    keys: [],
    selective: false,
    constant: false,
    position: "before",
    ...overrides,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   递归激活测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("递归激活", () => {
  let manager: WorldBookAdvancedManager;

  beforeEach(() => {
    manager = createWorldBookManager();
  });

  it("应该支持基本的递归激活", () => {
    // 条目 A：关键词 "dragon"，内容包含 "fire"
    const entryA = createEntry({
      entry_id: "a",
      keys: ["dragon"],
      content: "Dragons breathe fire and live in mountains.",
    });

    // 条目 B：关键词 "fire"，被 A 的内容触发
    const entryB = createEntry({
      entry_id: "b",
      keys: ["fire"],
      content: "Fire is dangerous and burns everything.",
    });

    manager.addEntries([entryA, entryB], "global");

    const matched = manager.getMatchingEntries("I saw a dragon", [], {
      enableRecursion: true,
      maxRecursionDepth: 2,
    });

    // 两个条目都应该被激活
    expect(matched.length).toBe(2);
    expect(matched.map((m) => m.entry.entry_id).sort()).toEqual(["a", "b"]);
  });

  it("应该尊重 maxRecursionDepth 限制", () => {
    // 创建链式依赖：A -> B -> C -> D
    const entryA = createEntry({
      entry_id: "a",
      keys: ["level1"],
      content: "This mentions level2",
    });
    const entryB = createEntry({
      entry_id: "b",
      keys: ["level2"],
      content: "This mentions level3",
    });
    const entryC = createEntry({
      entry_id: "c",
      keys: ["level3"],
      content: "This mentions level4",
    });
    const entryD = createEntry({
      entry_id: "d",
      keys: ["level4"],
      content: "Final level",
    });

    manager.addEntries([entryA, entryB, entryC, entryD], "global");

    // maxRecursionDepth=2：只能激活 A, B, C（3 层：0, 1, 2）
    const matched = manager.getMatchingEntries("level1", [], {
      enableRecursion: true,
      maxRecursionDepth: 2,
    });

    expect(matched.length).toBe(3);
    expect(matched.map((m) => m.entry.entry_id).sort()).toEqual(["a", "b", "c"]);
  });

  it("应该尊重 preventRecursion 标志", () => {
    const entryA = createEntry({
      entry_id: "a",
      keys: ["dragon"],
      content: "Dragons breathe fire",
      preventRecursion: true, // 阻止递归扫描此条目
    });

    const entryB = createEntry({
      entry_id: "b",
      keys: ["fire"],
      content: "Fire is hot",
    });

    manager.addEntries([entryA, entryB], "global");

    const matched = manager.getMatchingEntries("I saw a dragon", [], {
      enableRecursion: true,
      maxRecursionDepth: 3,
    });

    // 只有 A 被激活，B 不应该被触发（因为 A 阻止递归）
    expect(matched.length).toBe(1);
    expect(matched[0].entry.entry_id).toBe("a");
  });

  it("禁用递归时只进行单次扫描", () => {
    const entryA = createEntry({
      entry_id: "a",
      keys: ["dragon"],
      content: "Dragons breathe fire",
    });

    const entryB = createEntry({
      entry_id: "b",
      keys: ["fire"],
      content: "Fire is hot",
    });

    manager.addEntries([entryA, entryB], "global");

    const matched = manager.getMatchingEntries("I saw a dragon", [], {
      enableRecursion: false,
    });

    // 只有 A 被激活
    expect(matched.length).toBe(1);
    expect(matched[0].entry.entry_id).toBe("a");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   全词匹配测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("全词匹配", () => {
  let manager: WorldBookAdvancedManager;

  beforeEach(() => {
    manager = createWorldBookManager();
  });

  it("全词匹配应该只匹配完整单词", () => {
    const entry = createEntry({
      entry_id: "a",
      keys: ["cat"],
      content: "A cat is a pet",
      matchWholeWords: true,
    });

    manager.addEntries([entry], "global");

    // "cat" 作为完整单词
    const matched1 = manager.getMatchingEntries("I have a cat", [], {});
    expect(matched1.length).toBe(1);

    // "cat" 作为 "category" 的一部分，不应匹配
    manager.clearEntries();
    manager.addEntries([entry], "global");
    const matched2 = manager.getMatchingEntries("This is a category", [], {});
    expect(matched2.length).toBe(0);
  });

  it("子串匹配（默认）应该匹配部分字符串", () => {
    const entry = createEntry({
      entry_id: "a",
      keys: ["cat"],
      content: "A cat is a pet",
      matchWholeWords: false,
    });

    manager.addEntries([entry], "global");

    // 子串匹配应该匹配 "category" 中的 "cat"
    const matched = manager.getMatchingEntries("This is a category", [], {});
    expect(matched.length).toBe(1);
  });

  it("全局 matchWholeWords 选项应该覆盖默认行为", () => {
    const entry = createEntry({
      entry_id: "a",
      keys: ["cat"],
      content: "A cat is a pet",
      // 不设置 matchWholeWords，使用全局设置
    });

    manager.addEntries([entry], "global");

    // 使用全局 matchWholeWords=true
    const matched = manager.getMatchingEntries("This is a category", [], {
      matchWholeWords: true,
    });
    expect(matched.length).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   大小写敏感测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("大小写敏感", () => {
  let manager: WorldBookAdvancedManager;

  beforeEach(() => {
    manager = createWorldBookManager();
  });

  it("大小写敏感匹配", () => {
    const entry = createEntry({
      entry_id: "a",
      keys: ["Dragon"],
      content: "A Dragon is a mythical creature",
      caseSensitive: true,
    });

    manager.addEntries([entry], "global");

    // 精确匹配
    const matched1 = manager.getMatchingEntries("I saw a Dragon", [], {});
    expect(matched1.length).toBe(1);

    // 大小写不匹配
    manager.clearEntries();
    manager.addEntries([entry], "global");
    const matched2 = manager.getMatchingEntries("I saw a dragon", [], {});
    expect(matched2.length).toBe(0);
  });

  it("大小写不敏感匹配（默认）", () => {
    const entry = createEntry({
      entry_id: "a",
      keys: ["Dragon"],
      content: "A Dragon is a mythical creature",
      caseSensitive: false,
    });

    manager.addEntries([entry], "global");

    // 不同大小写都应该匹配
    const matched1 = manager.getMatchingEntries("I saw a dragon", [], {});
    expect(matched1.length).toBe(1);

    manager.clearEntries();
    manager.addEntries([entry], "global");
    const matched2 = manager.getMatchingEntries("I saw a DRAGON", [], {});
    expect(matched2.length).toBe(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Token 预算管理测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Token 预算管理", () => {
  let manager: WorldBookAdvancedManager;

  beforeEach(() => {
    manager = createWorldBookManager();
  });

  it("应该在超出预算时停止添加条目", () => {
    // 创建多个条目，每个约 10 tokens
    const entries = [
      createEntry({
        entry_id: "a",
        keys: ["keyword"],
        content: "Short content A",
        tokens: 10,
        insertion_order: 3,
      }),
      createEntry({
        entry_id: "b",
        keys: ["keyword"],
        content: "Short content B",
        tokens: 10,
        insertion_order: 2,
      }),
      createEntry({
        entry_id: "c",
        keys: ["keyword"],
        content: "Short content C",
        tokens: 10,
        insertion_order: 1,
      }),
    ];

    manager.addEntries(entries, "global");

    // 预算 25 tokens，应该只能容纳 2 个条目
    const matched = manager.getMatchingEntries("keyword test", [], {
      tokenBudget: 25,
    });

    expect(matched.length).toBe(2);
  });

  it("应该优先保留高优先级条目", () => {
    const entries = [
      createEntry({
        entry_id: "low",
        keys: ["keyword"],
        content: "Low priority",
        tokens: 10,
        insertion_order: 1,
      }),
      createEntry({
        entry_id: "high",
        keys: ["keyword"],
        content: "High priority",
        tokens: 10,
        insertion_order: 10,
      }),
    ];

    manager.addEntries(entries, "global");

    // 预算只够一个条目
    const matched = manager.getMatchingEntries("keyword test", [], {
      tokenBudget: 15,
    });

    expect(matched.length).toBe(1);
    expect(matched[0].entry.entry_id).toBe("high");
  });

  it("minActivations 应该优先于预算限制", () => {
    const entries = [
      createEntry({
        entry_id: "a",
        keys: ["keyword"],
        content: "Content A",
        tokens: 20,
      }),
      createEntry({
        entry_id: "b",
        keys: ["keyword"],
        content: "Content B",
        tokens: 20,
      }),
    ];

    manager.addEntries(entries, "global");

    // 预算只够 1 个，但 minActivations=2
    const matched = manager.getMatchingEntries("keyword test", [], {
      tokenBudget: 25,
      minActivations: 2,
    });

    // minActivations 优先，所以应该有 2 个
    expect(matched.length).toBe(2);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   包含组评分测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("包含组评分", () => {
  let manager: WorldBookAdvancedManager;

  beforeEach(() => {
    manager = createWorldBookManager();
  });

  it("应该在同一组中选择优先级最高的条目", () => {
    const entries = [
      createEntry({
        entry_id: "low",
        keys: ["dragon"],
        content: "Low priority dragon",
        group: "dragons",
        group_priority: 1,
      }),
      createEntry({
        entry_id: "high",
        keys: ["dragon"],
        content: "High priority dragon",
        group: "dragons",
        group_priority: 10,
      }),
    ];

    manager.addEntries(entries, "global");

    const matched = manager.getMatchingEntries("I saw a dragon", [], {
      enableInclusionGroups: true,
    });

    // 只有高优先级的应该被选中
    expect(matched.length).toBe(1);
    expect(matched[0].entry.entry_id).toBe("high");
  });

  it("不同组的条目应该都被保留", () => {
    const entries = [
      createEntry({
        entry_id: "dragon1",
        keys: ["dragon"],
        content: "Dragon from group A",
        group: "groupA",
        group_priority: 1,
      }),
      createEntry({
        entry_id: "dragon2",
        keys: ["dragon"],
        content: "Dragon from group B",
        group: "groupB",
        group_priority: 1,
      }),
    ];

    manager.addEntries(entries, "global");

    const matched = manager.getMatchingEntries("I saw a dragon", [], {
      enableInclusionGroups: true,
    });

    // 不同组的条目都应该被保留
    expect(matched.length).toBe(2);
  });

  it("group_weight 应该作为次要排序依据", () => {
    const entries = [
      createEntry({
        entry_id: "a",
        keys: ["dragon"],
        content: "Dragon A",
        group: "dragons",
        group_priority: 5,
        group_weight: 100,
      }),
      createEntry({
        entry_id: "b",
        keys: ["dragon"],
        content: "Dragon B",
        group: "dragons",
        group_priority: 5,
        group_weight: 200, // 相同优先级，但权重更高
      }),
    ];

    manager.addEntries(entries, "global");

    const matched = manager.getMatchingEntries("I saw a dragon", [], {
      enableInclusionGroups: true,
    });

    // 权重更高的 B 应该被选中
    expect(matched.length).toBe(1);
    expect(matched[0].entry.entry_id).toBe("b");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   最小激活数测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("最小激活数", () => {
  let manager: WorldBookAdvancedManager;

  beforeEach(() => {
    manager = createWorldBookManager();
  });

  it("应该从 constant 条目补充到最小激活数", () => {
    const entries = [
      createEntry({
        entry_id: "normal",
        keys: ["dragon"],
        content: "Normal entry",
      }),
      createEntry({
        entry_id: "constant1",
        keys: [],
        content: "Constant entry 1",
        constant: true,
      }),
      createEntry({
        entry_id: "constant2",
        keys: [],
        content: "Constant entry 2",
        constant: true,
      }),
    ];

    manager.addEntries(entries, "global");

    // 只有 1 个 keyword 匹配，但 minActivations=3
    const matched = manager.getMatchingEntries("I saw a dragon", [], {
      minActivations: 3,
    });

    // 应该有 3 个条目：1 keyword + 2 constant
    expect(matched.length).toBe(3);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   次关键词逻辑测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("次关键词逻辑", () => {
  let manager: WorldBookAdvancedManager;

  beforeEach(() => {
    manager = createWorldBookManager();
  });

  it("AND_ANY: 至少一个次关键词匹配", () => {
    const entry = createEntry({
      entry_id: "a",
      keys: ["dragon"],
      secondary_keys: ["fire", "ice"],
      selectiveLogic: "AND_ANY",
      selective: true,
      content: "Dragon with element",
    });

    manager.addEntries([entry], "global");

    // 主关键词匹配 + 一个次关键词匹配
    const matched1 = manager.getMatchingEntries("dragon breathes fire", [], {});
    expect(matched1.length).toBe(1);

    // 主关键词匹配但没有次关键词匹配
    manager.clearEntries();
    manager.addEntries([entry], "global");
    const matched2 = manager.getMatchingEntries("dragon flies", [], {});
    expect(matched2.length).toBe(0);
  });

  it("NOT_ALL: 不是所有次关键词都匹配", () => {
    const entry = createEntry({
      entry_id: "a",
      keys: ["dragon"],
      secondary_keys: ["fire", "ice"],
      selectiveLogic: "NOT_ALL",
      selective: true,
      content: "Dragon with partial element",
    });

    manager.addEntries([entry], "global");

    // 只有一个次关键词匹配 -> 通过
    const matched1 = manager.getMatchingEntries("dragon breathes fire", [], {});
    expect(matched1.length).toBe(1);

    // 两个次关键词都匹配 -> 不通过
    manager.clearEntries();
    manager.addEntries([entry], "global");
    const matched2 = manager.getMatchingEntries("dragon breathes fire and ice", [], {});
    expect(matched2.length).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   缓存测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("缓存机制", () => {
  it("应该正确缓存和检索条目", () => {
    const cache = getGlobalWorldBookCache();
    cache.clear();

    const entries: WorldBookEntry[] = [
      createEntry({ entry_id: "a", keys: ["test"], content: "Test A" }),
      createEntry({ entry_id: "b", keys: ["test"], content: "Test B" }),
    ];

    // 设置缓存
    cache.set("test-key", entries);

    // 获取缓存
    const cached = cache.get("test-key");
    expect(cached).toEqual(entries);
    expect(cached?.length).toBe(2);
  });

  it("应该正确使缓存失效", () => {
    const cache = getGlobalWorldBookCache();
    cache.clear();

    const entries: WorldBookEntry[] = [
      createEntry({ entry_id: "a", keys: ["test"], content: "Test A" }),
    ];

    cache.set("test-key", entries);
    expect(cache.get("test-key")).not.toBeNull();

    cache.invalidate("test-key");
    expect(cache.get("test-key")).toBeNull();
  });

  it("应该在清空后返回 null", () => {
    const cache = getGlobalWorldBookCache();

    cache.set("key1", [createEntry({ content: "A" })]);
    cache.set("key2", [createEntry({ content: "B" })]);

    cache.clear();

    expect(cache.get("key1")).toBeNull();
    expect(cache.get("key2")).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   性能边界测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("性能边界", () => {
  it("应该在大量条目下正常工作", () => {
    const manager = createWorldBookManager();

    // 创建 1000 个条目
    const entries: WorldBookEntry[] = [];
    for (let i = 0; i < 1000; i++) {
      entries.push(
        createEntry({
          entry_id: `entry-${i}`,
          keys: [`keyword${i % 10}`], // 10 个不同的关键词
          content: `Content for entry ${i}`,
        }),
      );
    }

    manager.addEntries(entries, "global");

    const startTime = Date.now();
    const matched = manager.getMatchingEntries("keyword5 appears here", [], {
      enableRecursion: false,
    });
    const duration = Date.now() - startTime;

    // 应该匹配 100 个条目（每个关键词 100 个）
    expect(matched.length).toBe(100);
    // 应该在 100ms 内完成
    expect(duration).toBeLessThan(100);
  });

  it("递归激活不应导致无限循环", () => {
    const manager = createWorldBookManager();

    // 创建循环依赖：A -> B -> A
    const entryA = createEntry({
      entry_id: "a",
      keys: ["keywordA"],
      content: "This mentions keywordB",
    });
    const entryB = createEntry({
      entry_id: "b",
      keys: ["keywordB"],
      content: "This mentions keywordA",
    });

    manager.addEntries([entryA, entryB], "global");

    // 应该正常完成，不会无限循环
    const matched = manager.getMatchingEntries("keywordA", [], {
      enableRecursion: true,
      maxRecursionDepth: 10,
    });

    // 两个条目都应该被激活，但只激活一次
    expect(matched.length).toBe(2);
  });
});
