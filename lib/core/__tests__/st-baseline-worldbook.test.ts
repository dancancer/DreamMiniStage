/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║               世界书系统基线测试（SillyTavern 对标）                        ║
 * ║                                                                            ║
 * ║  测试当前项目的世界书系统与 SillyTavern world-info.js 的行为一致性。        ║
 * ║                                                                            ║
 * ║  覆盖范围：                                                                 ║
 * ║  1. 关键词匹配逻辑（主关键词、次关键词、AND/OR/NOT 逻辑）                   ║
 * ║  2. 常量条目（constant: true）vs 选择性激活                                 ║
 * ║  3. 位置注入策略（before_char, after_char, position: 0/1/2/4）             ║
 * ║  4. 高级匹配选项（全词匹配、大小写敏感）                                     ║
 * ║  5. 递归扫描（新激活条目的内容再次触发匹配）                                 ║
 * ║  6. 时间效果（sticky, cooldown, delay）                                    ║
 * ║  7. 概率激活和互斥组                                                        ║
 * ║  8. Token 预算和扫描深度控制                                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { WorldBookManager } from "@/lib/core/world-book";
import { WorldBookAdvancedManager } from "@/lib/core/world-book-advanced";
import type { WorldBookEntry, SecondaryKeyLogic } from "@/lib/models/world-book-model";
import type { DialogueMessage } from "@/lib/models/character-dialogue-model";
import { setupDeterministicEnv, teardownDeterministicEnv } from "./baseline-helpers";

// ════════════════════════════════════════════════════════════════════════════
//   测试辅助函数
// ════════════════════════════════════════════════════════════════════════════

/**
 * 创建简化的对话消息
 */
function createMessage(role: "user" | "assistant", content: string): DialogueMessage {
  return {
    role,
    content,
    timestamp: Date.now(),
  } as DialogueMessage;
}

/**
 * 创建简化的世界书条目
 */
function createEntry(
  keys: string[],
  content: string,
  options: Partial<WorldBookEntry> = {},
): WorldBookEntry {
  return {
    keys,
    content,
    selective: true,
    constant: false,
    position: 4,
    enabled: true,
    ...options,
  };
}

// ════════════════════════════════════════════════════════════════════════════
//   测试套件
// ════════════════════════════════════════════════════════════════════════════

describe("世界书系统基线测试", () => {
  beforeAll(() => {
    setupDeterministicEnv(vi);
  });

  afterAll(() => {
    teardownDeterministicEnv(vi);
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 1：基础关键词匹配
  // ──────────────────────────────────────────────────────────────────────────

  describe("基础关键词匹配", () => {
    it("应匹配包含主关键词的消息", () => {
      const entries = [createEntry(["魔法"], "魔法系统说明")];

      const matched = WorldBookManager.getMatchingEntries(
        entries,
        "我想学习魔法",
        [],
        { contextWindow: 5 },
      );

      expect(matched).toHaveLength(1);
      expect(matched[0].content).toBe("魔法系统说明");
    });

    it("应支持多个主关键词（OR 逻辑）", () => {
      const entries = [createEntry(["魔法", "法术", "咒语"], "魔法系统说明")];

      const matched1 = WorldBookManager.getMatchingEntries(entries, "我想学习魔法", [], {
        contextWindow: 5,
      });

      const matched2 = WorldBookManager.getMatchingEntries(entries, "使用法术", [], {
        contextWindow: 5,
      });

      expect(matched1).toHaveLength(1);
      expect(matched2).toHaveLength(1);
    });

    it("应在历史消息中搜索关键词", () => {
      const entries = [createEntry(["城堡"], "城堡描述")];

      const history = [
        createMessage("user", "我们去城堡"),
        createMessage("assistant", "好的"),
      ];

      const matched = WorldBookManager.getMatchingEntries(
        entries,
        "继续前进",
        history,
        { contextWindow: 5 },
      );

      expect(matched).toHaveLength(1);
    });

    it("应遵守上下文窗口限制", () => {
      const entries = [createEntry(["旧事件"], "旧事件描述")];

      const history = [
        createMessage("user", "旧事件发生"),
        createMessage("assistant", "回应1"),
        createMessage("user", "新对话1"),
        createMessage("assistant", "回应2"),
        createMessage("user", "新对话2"),
        createMessage("assistant", "回应3"),
      ];

      const matched = WorldBookManager.getMatchingEntries(
        entries,
        "继续",
        history,
        { contextWindow: 2 },
      );

      expect(matched).toHaveLength(0);
    });

    it("不匹配时应返回空数组", () => {
      const entries = [createEntry(["龙"], "龙的描述")];

      const matched = WorldBookManager.getMatchingEntries(entries, "今天天气不错", [], {
        contextWindow: 5,
      });

      expect(matched).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 2：常量条目和选择性激活
  // ──────────────────────────────────────────────────────────────────────────

  describe("常量条目和选择性激活", () => {
    it("常量条目应始终被激活", () => {
      const entries = [createEntry(["世界观"], "世界观设定", { constant: true })];

      const matched = WorldBookManager.getMatchingEntries(entries, "随便说点什么", [], {
        contextWindow: 5,
      });

      expect(matched).toHaveLength(1);
      expect(matched[0].content).toBe("世界观设定");
    });

    it("常量条目不需要匹配关键词", () => {
      const entries = [createEntry([], "基础设定", { constant: true, keys: [] })];

      const matched = WorldBookManager.getMatchingEntries(entries, "任何输入", [], {
        contextWindow: 5,
      });

      expect(matched).toHaveLength(1);
    });

    it("禁用的条目应被跳过", () => {
      const entries = [createEntry(["魔法"], "魔法说明", { enabled: false })];

      const matched = WorldBookManager.getMatchingEntries(entries, "我想学习魔法", [], {
        contextWindow: 5,
      });

      // SillyTavern 行为：enabled: false 的条目应被过滤
      expect(matched).toHaveLength(0);
    });

    it("selective: false 的条目应被跳过", () => {
      const entries = [createEntry(["魔法"], "魔法说明", { selective: false })];

      const matched = WorldBookManager.getMatchingEntries(entries, "我想学习魔法", [], {
        contextWindow: 5,
      });

      expect(matched).toHaveLength(0);
    });

    it("应同时返回常量条目和匹配条目", () => {
      const entries = [
        createEntry(["魔法"], "魔法说明"),
        createEntry([], "世界观", { constant: true }),
      ];

      const matched = WorldBookManager.getMatchingEntries(entries, "我想学习魔法", [], {
        contextWindow: 5,
      });

      expect(matched).toHaveLength(2);
      expect(matched.map((e) => e.content).sort()).toEqual(["世界观", "魔法说明"]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 3：位置注入策略
  // ──────────────────────────────────────────────────────────────────────────

  describe("位置注入策略", () => {
    it("应正确解析 before_char 字符串位置", () => {
      const entry = createEntry(["测试"], "测试内容", { position: "before_char" });

      const normalized = WorldBookManager.normalizePosition(entry);

      expect(normalized).toBe(0);
    });

    it("应正确解析 after_char 字符串位置", () => {
      const entry = createEntry(["测试"], "测试内容", { position: "after_char" });

      const normalized = WorldBookManager.normalizePosition(entry);

      expect(normalized).toBe(2);
    });

    it("应正确解析数字位置", () => {
      const entry = createEntry(["测试"], "测试内容", { position: 4 });

      const normalized = WorldBookManager.normalizePosition(entry);

      expect(normalized).toBe(4);
    });

    it("应正确解析字符串数字位置", () => {
      const entry = createEntry(["测试"], "测试内容", { position: "2" });

      const normalized = WorldBookManager.normalizePosition(entry);

      expect(normalized).toBe(2);
    });

    it("应支持 extensions.position", () => {
      // 不设置主 position 字段，只在 extensions 中设置
      const entry: WorldBookEntry = {
        keys: ["测试"],
        content: "测试内容",
        selective: true,
        constant: false,
        position: 4, // createEntry 会设置默认值，需要手动构建条目
        enabled: true,
        extensions: { position: 0 },
      };
      // 删除主 position 以测试 extensions 回退
      delete (entry as any).position;

      const normalized = WorldBookManager.normalizePosition(entry);

      expect(normalized).toBe(0);
    });

    it("未知位置应回退到默认值 4", () => {
      const entry = createEntry(["测试"], "测试内容", {
        position: undefined,
      });

      const normalized = WorldBookManager.normalizePosition(entry);

      expect(normalized).toBe(4);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 4：次关键词匹配逻辑（需要 AdvancedManager）
  // ──────────────────────────────────────────────────────────────────────────

  describe("次关键词匹配逻辑", () => {
    let manager: WorldBookAdvancedManager;

    beforeEach(() => {
      manager = new WorldBookAdvancedManager();
    });

    it("应支持 AND 逻辑（主关键词 + 所有次关键词）", () => {
      const entry = createEntry(["战斗"], "战斗系统", {
        secondary_keys: ["剑", "盾"],
        selectiveLogic: "AND" as SecondaryKeyLogic,
      });

      manager.addEntries([entry], "test");

      const matched = manager.getMatchingEntries("我在战斗中使用剑和盾", [], {});

      expect(matched).toHaveLength(1);
    });

    it("AND 逻辑应在缺少次关键词时不匹配", () => {
      const entry = createEntry(["战斗"], "战斗系统", {
        secondary_keys: ["剑", "盾"],
        selectiveLogic: "AND" as SecondaryKeyLogic,
      });

      manager.addEntries([entry], "test");

      const matched = manager.getMatchingEntries("我在战斗中使用剑", [], {});

      expect(matched).toHaveLength(0);
    });

    it("应支持 OR 逻辑（主关键词 + 至少一个次关键词）", () => {
      const entry = createEntry(["战斗"], "战斗系统", {
        secondary_keys: ["剑", "盾", "魔法"],
        selectiveLogic: "OR" as SecondaryKeyLogic,
      });

      manager.addEntries([entry], "test");

      const matched = manager.getMatchingEntries("我在战斗中使用剑", [], {});

      expect(matched).toHaveLength(1);
    });

    it("应支持 NOT 逻辑（主关键词 + 所有次关键词都不匹配）", () => {
      const entry = createEntry(["战斗"], "无武器战斗", {
        secondary_keys: ["剑", "盾", "魔法"],
        selectiveLogic: "NOT" as SecondaryKeyLogic,
      });

      manager.addEntries([entry], "test");

      const matched1 = manager.getMatchingEntries("我在战斗中徒手对敌", [], {});
      const matched2 = manager.getMatchingEntries("我在战斗中使用剑", [], {});

      expect(matched1).toHaveLength(1);
      expect(matched2).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 5：高级匹配选项
  // ──────────────────────────────────────────────────────────────────────────

  describe("高级匹配选项", () => {
    let manager: WorldBookAdvancedManager;

    beforeEach(() => {
      manager = new WorldBookAdvancedManager();
    });

    it("应支持全词匹配", () => {
      const entry = createEntry(["法"], "法律内容", {
        matchWholeWords: true,
      });

      manager.addEntries([entry], "test");

      const matched1 = manager.getMatchingEntries("学习法律", [], {});
      const matched2 = manager.getMatchingEntries("学习魔法", [], {});

      expect(matched1).toHaveLength(1);
      expect(matched2).toHaveLength(0);
    });

    it("应支持大小写敏感匹配", () => {
      const entry = createEntry(["Dragon"], "龙的描述", {
        caseSensitive: true,
      });

      manager.addEntries([entry], "test");

      const matched1 = manager.getMatchingEntries("I saw a Dragon", [], {});
      const matched2 = manager.getMatchingEntries("I saw a dragon", [], {});

      expect(matched1).toHaveLength(1);
      expect(matched2).toHaveLength(0);
    });

    it("默认应不区分大小写", () => {
      const entry = createEntry(["dragon"], "龙的描述");

      manager.addEntries([entry], "test");

      const matched = manager.getMatchingEntries("I saw a DRAGON", [], {});

      expect(matched).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 6：边界情况
  // ──────────────────────────────────────────────────────────────────────────

  describe("边界情况", () => {
    it("应处理空条目数组", () => {
      const matched = WorldBookManager.getMatchingEntries([], "测试", [], {
        contextWindow: 5,
      });

      expect(matched).toHaveLength(0);
    });

    it("应处理空消息输入", () => {
      const entries = [createEntry(["测试"], "测试内容")];

      const matched = WorldBookManager.getMatchingEntries(entries, "", [], {
        contextWindow: 5,
      });

      expect(matched).toHaveLength(0);
    });

    it("应处理空关键词数组", () => {
      const entries = [createEntry([], "无关键词内容")];

      const matched = WorldBookManager.getMatchingEntries(entries, "测试", [], {
        contextWindow: 5,
      });

      expect(matched).toHaveLength(0);
    });

    it("应处理 undefined worldBook", () => {
      const matched = WorldBookManager.getMatchingEntries(undefined, "测试", [], {
        contextWindow: 5,
      });

      expect(matched).toHaveLength(0);
    });

    it("应处理 Record 格式的 worldBook", () => {
      const worldBook = {
        entry1: createEntry(["魔法"], "魔法说明"),
        entry2: createEntry(["剑术"], "剑术说明"),
      };

      const matched = WorldBookManager.getMatchingEntries(worldBook, "学习魔法", [], {
        contextWindow: 5,
      });

      expect(matched).toHaveLength(1);
      expect(matched[0].content).toBe("魔法说明");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 7：递归扫描（AdvancedManager）
  // ──────────────────────────────────────────────────────────────────────────

  describe("递归扫描", () => {
    let manager: WorldBookAdvancedManager;

    beforeEach(() => {
      manager = new WorldBookAdvancedManager();
    });

    it("应支持递归激活（新激活条目内容触发其他条目）", () => {
      const entries = [
        createEntry(["魔法"], "魔法描述，涉及元素魔法"),
        createEntry(["元素"], "元素系统说明"),
      ];

      manager.addEntries(entries, "test");

      const matched = manager.getMatchingEntries("学习魔法", [], {
        enableRecursion: true,
        maxRecursionDepth: 2,
      });

      // 第一轮：匹配"魔法" → 激活第一个条目
      // 第二轮：第一个条目内容包含"元素" → 激活第二个条目
      expect(matched).toHaveLength(2);
    });

    it("递归深度应受 maxRecursionDepth 限制", () => {
      const entries = [
        createEntry(["A"], "A 涉及 B"),
        createEntry(["B"], "B 涉及 C"),
        createEntry(["C"], "C 涉及 D"),
        createEntry(["D"], "D 的说明"),
      ];

      manager.addEntries(entries, "test");

      const matched = manager.getMatchingEntries("触发 A", [], {
        enableRecursion: true,
        maxRecursionDepth: 2,
      });

      // maxRecursionDepth: 2
      // Level 0: A
      // Level 1: B
      // Level 2: C
      // Level 3: D (超过限制)
      expect(matched.length).toBeLessThanOrEqual(3);
    });

    it("preventRecursion 应阻止条目内容被递归扫描", () => {
      const entries = [
        createEntry(["魔法"], "魔法描述，涉及元素魔法", {
          preventRecursion: true,
        }),
        createEntry(["元素"], "元素系统说明"),
      ];

      manager.addEntries(entries, "test");

      const matched = manager.getMatchingEntries("学习魔法", [], {
        enableRecursion: true,
        maxRecursionDepth: 2,
      });

      // 第一个条目阻止递归，第二个条目不应被激活
      expect(matched).toHaveLength(1);
      expect(matched[0].entry.content).toBe("魔法描述，涉及元素魔法");
    });

    it("递归层级应被正确记录", () => {
      const entries = [
        createEntry(["魔法"], "魔法涉及元素"),
        createEntry(["元素"], "元素说明"),
      ];

      manager.addEntries(entries, "test");

      const matched = manager.getMatchingEntries("学习魔法", [], {
        enableRecursion: true,
        maxRecursionDepth: 2,
      });

      expect(matched[0].recursionLevel).toBe(0);
      expect(matched[1].recursionLevel).toBe(1);
    });

    it("禁用递归时应只匹配第一轮", () => {
      const entries = [
        createEntry(["魔法"], "魔法描述，涉及元素魔法"),
        createEntry(["元素"], "元素系统说明"),
      ];

      manager.addEntries(entries, "test");

      const matched = manager.getMatchingEntries("学习魔法", [], {
        enableRecursion: false,
      });

      expect(matched).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 8：时间效果（sticky, cooldown, delay）
  // ──────────────────────────────────────────────────────────────────────────

  describe("时间效果", () => {
    let manager: WorldBookAdvancedManager;

    beforeEach(() => {
      manager = new WorldBookAdvancedManager();
      manager.setCurrentTurn(1);
    });

    it("sticky 应在激活后保持指定轮数", () => {
      const entry = createEntry(["魔法"], "魔法说明", {
        sticky: 3,
      });

      manager.addEntries([entry], "test");

      // 第 1 轮：匹配关键词，激活
      const matched1 = manager.getMatchingEntries("学习魔法", [], {
        enableTimeEffects: true,
      });
      expect(matched1).toHaveLength(1);
      expect(matched1[0].matchReason).toBe("keyword");

      // 第 2 轮：没有关键词，但 sticky 保持激活
      manager.advanceTurn();
      const matched2 = manager.getMatchingEntries("继续学习", [], {
        enableTimeEffects: true,
      });
      expect(matched2).toHaveLength(1);
      expect(matched2[0].matchReason).toBe("sticky");

      // 第 3 轮：仍然 sticky
      manager.advanceTurn();
      const matched3 = manager.getMatchingEntries("继续", [], {
        enableTimeEffects: true,
      });
      expect(matched3).toHaveLength(1);

      // 第 4 轮：sticky 耗尽，不再激活
      manager.advanceTurn();
      const matched4 = manager.getMatchingEntries("继续", [], {
        enableTimeEffects: true,
      });
      expect(matched4).toHaveLength(0);
    });

    it("cooldown 应在激活后冷却指定轮数", () => {
      const entry = createEntry(["技能"], "技能说明", {
        cooldown: 2,
      });

      manager.addEntries([entry], "test");

      // 第 1 轮：激活
      const matched1 = manager.getMatchingEntries("使用技能", [], {
        enableTimeEffects: true,
      });
      expect(matched1).toHaveLength(1);

      // 第 2 轮：冷却中
      manager.advanceTurn();
      const matched2 = manager.getMatchingEntries("使用技能", [], {
        enableTimeEffects: true,
      });
      expect(matched2).toHaveLength(0);

      // 第 3 轮：仍在冷却
      manager.advanceTurn();
      const matched3 = manager.getMatchingEntries("使用技能", [], {
        enableTimeEffects: true,
      });
      expect(matched3).toHaveLength(0);

      // 第 4 轮：冷却结束，可以再次激活
      manager.advanceTurn();
      const matched4 = manager.getMatchingEntries("使用技能", [], {
        enableTimeEffects: true,
      });
      expect(matched4).toHaveLength(1);
    });

    it("delay 应延迟激活指定轮数", () => {
      const entry = createEntry(["咒语"], "咒语说明", {
        delay: 2,
      });

      manager.addEntries([entry], "test");

      // 第 1 轮：匹配但不激活（设置延迟）
      const matched1 = manager.getMatchingEntries("吟唱咒语", [], {
        enableTimeEffects: true,
      });
      expect(matched1).toHaveLength(0);

      // 第 2 轮：仍在延迟
      manager.advanceTurn();
      const matched2 = manager.getMatchingEntries("继续", [], {
        enableTimeEffects: true,
      });
      expect(matched2).toHaveLength(0);

      // 第 3 轮：延迟结束，激活
      manager.advanceTurn();
      const matched3 = manager.getMatchingEntries("继续", [], {
        enableTimeEffects: true,
      });
      expect(matched3).toHaveLength(1);
      expect(matched3[0].matchReason).toBe("delay");
    });

    it("禁用时间效果时应忽略 sticky/cooldown/delay", () => {
      const entry = createEntry(["测试"], "测试内容", {
        sticky: 3,
        cooldown: 2,
      });

      manager.addEntries([entry], "test");

      const matched = manager.getMatchingEntries("测试", [], {
        enableTimeEffects: false,
      });

      expect(matched).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 9：概率激活
  // ──────────────────────────────────────────────────────────────────────────

  describe("概率激活", () => {
    let manager: WorldBookAdvancedManager;

    beforeEach(() => {
      manager = new WorldBookAdvancedManager();
    });

    it("probability: 100 应始终激活", () => {
      const entry = createEntry(["测试"], "测试内容", {
        probability: 100,
      });

      manager.addEntries([entry], "test");

      const matched = manager.getMatchingEntries("测试", [], {
        enableProbability: true,
      });

      expect(matched).toHaveLength(1);
    });

    it("probability: 0 应永不激活", () => {
      const entry = createEntry(["测试"], "测试内容", {
        probability: 0,
      });

      manager.addEntries([entry], "test");

      const matched = manager.getMatchingEntries("测试", [], {
        enableProbability: true,
      });

      expect(matched).toHaveLength(0);
    });

    it("禁用概率时应忽略 probability 字段", () => {
      const entry = createEntry(["测试"], "测试内容", {
        probability: 0,
      });

      manager.addEntries([entry], "test");

      const matched = manager.getMatchingEntries("测试", [], {
        enableProbability: false,
      });

      expect(matched).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 10：互斥组
  // ──────────────────────────────────────────────────────────────────────────

  describe("互斥组", () => {
    let manager: WorldBookAdvancedManager;

    beforeEach(() => {
      manager = new WorldBookAdvancedManager();
    });

    it("同一互斥组中应只选择权重最高的条目", () => {
      const entries = [
        createEntry(["战斗"], "剑术描述", {
          group: "combat",
          group_weight: 10,
        }),
        createEntry(["战斗"], "魔法描述", {
          group: "combat",
          group_weight: 20,
        }),
        createEntry(["战斗"], "弓术描述", {
          group: "combat",
          group_weight: 5,
        }),
      ];

      manager.addEntries(entries, "test");

      const matched = manager.getMatchingEntries("进入战斗", [], {
        enableInclusionGroups: true,
      });

      // 应只激活权重最高的条目（魔法描述，weight: 20）
      expect(matched).toHaveLength(1);
      expect(matched[0].entry.content).toBe("魔法描述");
    });

    it("不同互斥组的条目应可以同时激活", () => {
      const entries = [
        createEntry(["魔法"], "火焰魔法", {
          group: "magic",
          group_weight: 10,
        }),
        createEntry(["魔法"], "冰霜魔法", {
          group: "magic",
          group_weight: 5,
        }),
        createEntry(["装备"], "武器说明", {
          group: "equipment",
          group_weight: 10,
        }),
      ];

      manager.addEntries(entries, "test");

      const matched = manager.getMatchingEntries("魔法和装备", [], {
        enableInclusionGroups: true,
      });

      // 应激活两个组中权重最高的条目
      expect(matched).toHaveLength(2);
    });

    it("无 group 的条目应不受互斥组影响", () => {
      const entries = [
        createEntry(["测试"], "无组条目1"),
        createEntry(["测试"], "无组条目2"),
      ];

      manager.addEntries(entries, "test");

      const matched = manager.getMatchingEntries("测试", [], {
        enableInclusionGroups: true,
      });

      expect(matched).toHaveLength(2);
    });

    it("禁用互斥组时应激活所有匹配条目", () => {
      const entries = [
        createEntry(["战斗"], "剑术", { group: "combat", group_weight: 10 }),
        createEntry(["战斗"], "魔法", { group: "combat", group_weight: 20 }),
      ];

      manager.addEntries(entries, "test");

      const matched = manager.getMatchingEntries("战斗", [], {
        enableInclusionGroups: false,
      });

      expect(matched).toHaveLength(2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 11：Token 预算控制
  // ──────────────────────────────────────────────────────────────────────────

  describe("Token 预算控制", () => {
    let manager: WorldBookAdvancedManager;

    beforeEach(() => {
      manager = new WorldBookAdvancedManager();
    });

    it("应遵守 Token 预算限制", () => {
      const entries = [
        createEntry(["A"], "短内容"),
        createEntry(["B"], "这是一个非常长的条目内容，包含大量文字信息"),
        createEntry(["C"], "中等长度的内容"),
      ];

      manager.addEntries(entries, "test");

      const matched = manager.getMatchingEntries("A B C", [], {
        tokenBudget: 20, // 较小的预算
      });

      // 应该按优先级激活，但总 token 数不超过预算
      expect(matched.length).toBeGreaterThan(0);
      expect(matched.length).toBeLessThan(3);
    });

    it("minActivations 应保证最小激活数", () => {
      const entries = [
        createEntry(["A"], "内容1"),
        createEntry(["B"], "内容2"),
        createEntry(["C"], "内容3"),
      ];

      manager.addEntries(entries, "test");

      const matched = manager.getMatchingEntries("A B C", [], {
        tokenBudget: 1, // 极小的预算
        minActivations: 2, // 但要求至少激活 2 个
      });

      // 即使超出预算，也应激活至少 2 个条目
      expect(matched).toHaveLength(2);
    });

    it("tokenBudget: 0 应表示无限制", () => {
      const entries = [
        createEntry(["A"], "内容1"),
        createEntry(["B"], "内容2"),
        createEntry(["C"], "内容3"),
      ];

      manager.addEntries(entries, "test");

      const matched = manager.getMatchingEntries("A B C", [], {
        tokenBudget: 0,
      });

      expect(matched).toHaveLength(3);
    });
  });
});
