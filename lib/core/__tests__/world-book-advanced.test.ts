/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    World Book Advanced 单元测试                            ║
 * ║                                                                            ║
 * ║  测试 SillyTavern 兼容的 World Info 高级功能                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach } from "vitest";
import { WorldBookAdvancedManager } from "../world-book-advanced";
import type { WorldBookEntry } from "@/lib/models/world-book-model";

describe("WorldBookAdvancedManager", () => {
  let manager: WorldBookAdvancedManager;

  beforeEach(() => {
    manager = new WorldBookAdvancedManager();
  });

  describe("关键词匹配", () => {
    it("应该匹配主关键词", () => {
      const entries: WorldBookEntry[] = [
        {
          uid: 1,
          keys: ["dragon", "fire"],
          content: "Dragons breathe fire.",
          enabled: true,
        },
      ];
      manager.addEntries(entries, "global");

      const matched = manager.getMatchingEntries("I saw a dragon", [], {
        enableProbability: false,
      });

      expect(matched).toHaveLength(1);
      expect(matched[0].entry.content).toBe("Dragons breathe fire.");
    });

    it("应该匹配多个关键词中的任意一个", () => {
      const entries: WorldBookEntry[] = [
        {
          uid: 1,
          keys: ["sword", "blade", "weapon"],
          content: "A sharp weapon.",
          enabled: true,
        },
      ];
      manager.addEntries(entries, "global");

      const matched = manager.getMatchingEntries("He drew his blade", [], {
        enableProbability: false,
      });

      expect(matched).toHaveLength(1);
    });

    it("无关键词匹配时应该返回空", () => {
      const entries: WorldBookEntry[] = [
        {
          uid: 1,
          keys: ["dragon"],
          content: "Dragons breathe fire.",
          enabled: true,
        },
      ];
      manager.addEntries(entries, "global");

      const matched = manager.getMatchingEntries("I saw a cat", [], {
        enableProbability: false,
      });

      expect(matched).toHaveLength(0);
    });

    it("应该大小写不敏感匹配", () => {
      const entries: WorldBookEntry[] = [
        {
          uid: 1,
          keys: ["Dragon"],
          content: "Dragons breathe fire.",
          enabled: true,
        },
      ];
      manager.addEntries(entries, "global");

      const matched = manager.getMatchingEntries("I saw a DRAGON", [], {
        enableProbability: false,
      });

      expect(matched).toHaveLength(1);
    });
  });

  describe("常量条目", () => {
    it("常量条目应该始终激活", () => {
      const entries: WorldBookEntry[] = [
        {
          uid: 1,
          keys: ["dragon"],
          content: "Always active.",
          enabled: true,
          constant: true,
        },
      ];
      manager.addEntries(entries, "global");

      const matched = manager.getMatchingEntries("No keywords here", [], {
        enableProbability: false,
      });

      expect(matched).toHaveLength(1);
      expect(matched[0].matchReason).toBe("constant");
    });
  });

  describe("次关键词逻辑", () => {
    it("AND 逻辑: 所有次关键词都必须匹配", () => {
      const entries: WorldBookEntry[] = [
        {
          uid: 1,
          keys: ["dragon"],
          secondary_keys: ["fire", "red"],
          selectiveLogic: "AND",
          selective: true,
          content: "Red fire dragon.",
          enabled: true,
        },
      ];
      manager.addEntries(entries, "global");

      // 只有 fire，没有 red
      const matched1 = manager.getMatchingEntries("dragon with fire", [], {
        enableProbability: false,
      });
      expect(matched1).toHaveLength(0);

      // 两个都有
      const matched2 = manager.getMatchingEntries("red dragon with fire", [], {
        enableProbability: false,
      });
      expect(matched2).toHaveLength(1);
    });

    it("OR 逻辑: 任意次关键词匹配即可", () => {
      const entries: WorldBookEntry[] = [
        {
          uid: 1,
          keys: ["dragon"],
          secondary_keys: ["fire", "ice"],
          selectiveLogic: "OR",
          selective: true,
          content: "Elemental dragon.",
          enabled: true,
        },
      ];
      manager.addEntries(entries, "global");

      const matched = manager.getMatchingEntries("dragon with fire", [], {
        enableProbability: false,
      });

      expect(matched).toHaveLength(1);
    });

    it("NOT 逻辑: 次关键词都不能匹配", () => {
      const entries: WorldBookEntry[] = [
        {
          uid: 1,
          keys: ["dragon"],
          secondary_keys: ["evil", "dark"],
          selectiveLogic: "NOT",
          selective: true,
          content: "Good dragon.",
          enabled: true,
        },
      ];
      manager.addEntries(entries, "global");

      // 包含 evil，不应该匹配
      const matched1 = manager.getMatchingEntries("evil dragon", [], {
        enableProbability: false,
      });
      expect(matched1).toHaveLength(0);

      // 不包含 evil 或 dark，应该匹配
      const matched2 = manager.getMatchingEntries("friendly dragon", [], {
        enableProbability: false,
      });
      expect(matched2).toHaveLength(1);
    });
  });

  describe("正则表达式匹配", () => {
    it("应该支持正则表达式关键词", () => {
      const entries: WorldBookEntry[] = [
        {
          uid: 1,
          keys: ["dragon\\d+"],
          content: "Numbered dragon.",
          enabled: true,
          use_regex: true,
        },
      ];
      manager.addEntries(entries, "global");

      const matched = manager.getMatchingEntries("I saw dragon123", [], {
        enableProbability: false,
      });

      expect(matched).toHaveLength(1);
    });
  });

  describe("时间效果", () => {
    it("Sticky: 激活后应该持续指定轮次", () => {
      const entries: WorldBookEntry[] = [
        {
          uid: 1,
          keys: ["dragon"],
          content: "Sticky dragon.",
          enabled: true,
          sticky: 3,
        },
      ];
      manager.addEntries(entries, "global");

      // 第一次激活
      const matched1 = manager.getMatchingEntries("dragon", [], {
        enableProbability: false,
        enableTimeEffects: true,
      });
      expect(matched1).toHaveLength(1);

      // 推进轮次，即使没有关键词也应该激活
      manager.advanceTurn();
      const matched2 = manager.getMatchingEntries("no keyword", [], {
        enableProbability: false,
        enableTimeEffects: true,
      });
      expect(matched2).toHaveLength(1);
      expect(matched2[0].matchReason).toBe("sticky");
    });

    it("Cooldown: 激活后应该冷却指定轮次", () => {
      const entries: WorldBookEntry[] = [
        {
          uid: 1,
          keys: ["dragon"],
          content: "Cooldown dragon.",
          enabled: true,
          cooldown: 2,
        },
      ];
      manager.addEntries(entries, "global");

      // 第一次激活
      const matched1 = manager.getMatchingEntries("dragon", [], {
        enableProbability: false,
        enableTimeEffects: true,
      });
      expect(matched1).toHaveLength(1);

      // 冷却期间不应该激活
      manager.advanceTurn();
      const matched2 = manager.getMatchingEntries("dragon", [], {
        enableProbability: false,
        enableTimeEffects: true,
      });
      expect(matched2).toHaveLength(0);

      // 冷却结束后应该可以激活
      manager.advanceTurn();
      manager.advanceTurn();
      const matched3 = manager.getMatchingEntries("dragon", [], {
        enableProbability: false,
        enableTimeEffects: true,
      });
      expect(matched3).toHaveLength(1);
    });

    it("Delay: 首次匹配后延迟激活", () => {
      const entries: WorldBookEntry[] = [
        {
          uid: 1,
          keys: ["dragon"],
          content: "Delayed dragon.",
          enabled: true,
          delay: 2,
        },
      ];
      manager.addEntries(entries, "global");

      // 首次匹配，设置延迟
      const matched1 = manager.getMatchingEntries("dragon", [], {
        enableProbability: false,
        enableTimeEffects: true,
      });
      expect(matched1).toHaveLength(0);

      // 延迟期间
      manager.advanceTurn();
      const matched2 = manager.getMatchingEntries("dragon", [], {
        enableProbability: false,
        enableTimeEffects: true,
      });
      expect(matched2).toHaveLength(0);

      // 延迟结束
      manager.advanceTurn();
      const matched3 = manager.getMatchingEntries("dragon", [], {
        enableProbability: false,
        enableTimeEffects: true,
      });
      expect(matched3).toHaveLength(1);
      expect(matched3[0].matchReason).toBe("delay");
    });
  });

  describe("互斥组", () => {
    it("同一组内只有一个条目被激活", () => {
      const entries: WorldBookEntry[] = [
        {
          uid: 1,
          keys: ["dragon"],
          content: "Dragon 1.",
          enabled: true,
          group: "dragons",
          insertion_order: 1,
        },
        {
          uid: 2,
          keys: ["dragon"],
          content: "Dragon 2.",
          enabled: true,
          group: "dragons",
          insertion_order: 2,
        },
      ];
      manager.addEntries(entries, "global");

      const matched = manager.getMatchingEntries("dragon", [], {
        enableProbability: false,
        enableMutualExclusion: true,
      });

      expect(matched).toHaveLength(1);
    });
  });

  describe("来源优先级", () => {
    it("应该按来源优先级排序", () => {
      manager.addEntries(
        [{ uid: 1, keys: ["test"], content: "Global", enabled: true }],
        "global",
      );
      manager.addEntries(
        [{ uid: 2, keys: ["test"], content: "Character", enabled: true }],
        "character",
      );
      manager.addEntries(
        [{ uid: 3, keys: ["test"], content: "Chat", enabled: true }],
        "chat",
      );

      const matched = manager.getMatchingEntries("test", [], {
        enableProbability: false,
        enableMutualExclusion: false,
      });

      expect(matched).toHaveLength(3);
      // Chat > Character > Global
      expect(matched[0].entry.content).toBe("Chat");
      expect(matched[1].entry.content).toBe("Character");
      expect(matched[2].entry.content).toBe("Global");
    });
  });

  describe("深度注入", () => {
    it("应该返回带深度信息的条目", () => {
      const entries: WorldBookEntry[] = [
        {
          uid: 1,
          keys: ["dragon"],
          content: "Deep dragon.",
          enabled: true,
          depth: 3,
        },
      ];
      manager.addEntries(entries, "global");

      const matched = manager.getMatchingEntries("dragon", [], {
        enableProbability: false,
      });

      expect(matched).toHaveLength(1);
      expect(matched[0].depth).toBe(3);
    });
  });
});
