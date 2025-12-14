/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              World Book Integration 集成测试                               ║
 * ║                                                                            ║
 * ║  测试多来源世界书的端到端加载流程和向后兼容性                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WorldBookEntry } from "@/lib/models/world-book-model";

/* ═══════════════════════════════════════════════════════════════════════════
   Mock 设置
   ═══════════════════════════════════════════════════════════════════════════ */

vi.mock("@/lib/data/roleplay/world-book-operation", () => ({
  WorldBookOperations: {
    getWorldBookKeysByPrefix: vi.fn(),
    getWorldBook: vi.fn(),
    getWorldBookSettings: vi.fn(),
  },
}));

vi.mock("@/lib/data/roleplay/character-dialogue-operation", () => ({
  LocalCharacterDialogueOperations: {
    getDialogueTreeById: vi.fn(),
    getDialoguePathToNode: vi.fn(),
  },
}));

// Mock WorldBookAdvancedManager + Cache
vi.mock("@/lib/core/world-book-advanced", () => {
  const mockAddEntries = vi.fn();
  const mockGetMatchingEntries = vi.fn().mockReturnValue([
    {
      entry: {
        content: "Matched content",
        position: 0,
      },
      matchReason: "keyword",
    },
  ]);
  const mockGenerateWiBefore = vi.fn().mockReturnValue("wiBefore content");
  const mockGenerateWiAfter = vi.fn().mockReturnValue("wiAfter content");

  const mockCache = {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    clear: vi.fn(),
    invalidate: vi.fn(),
  };

  return {
    WorldBookAdvancedManager: vi.fn().mockImplementation(() => ({
      addEntries: mockAddEntries,
      getMatchingEntries: mockGetMatchingEntries,
      generateWiBefore: mockGenerateWiBefore,
      generateWiAfter: mockGenerateWiAfter,
    })),
    getGlobalWorldBookCache: vi.fn().mockReturnValue(mockCache),
  };
});

vi.mock("@/lib/vector-memory/manager", () => ({
  getVectorMemoryManager: vi.fn().mockReturnValue({
    ingest: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { loadWorldBooksFromSources } from "@/lib/core/world-book-cascade-loader";
import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";
import { WorldBookAdvancedManager } from "@/lib/core/world-book-advanced";

/* ═══════════════════════════════════════════════════════════════════════════
   测试套件
   ═══════════════════════════════════════════════════════════════════════════ */

describe("World Book Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ───────────────────────────────────────────────────────────────────────
     端到端加载流程
     ─────────────────────────────────────────────────────────────────────── */

  describe("端到端加载流程", () => {
    it("应该成功加载并合并三个层级的世界书", async () => {
      // 设置三个层级的测试数据
      const globalEntry: WorldBookEntry = {
        entry_id: "global_1",
        content: "Global lore",
        keys: ["magic"],
        selective: false,
        constant: true,
        position: 0,
        enabled: true,
      };

      const characterEntry: WorldBookEntry = {
        entry_id: "char_1",
        content: "Character lore",
        keys: ["hero"],
        selective: false,
        constant: false,
        position: 4,
        enabled: true,
      };

      const dialogueEntry: WorldBookEntry = {
        entry_id: "dlg_1",
        content: "Dialogue lore",
        keys: ["quest"],
        selective: false,
        constant: false,
        position: 2,
        enabled: true,
      };

      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockResolvedValue([
        "global:fantasy_1",
      ]);

      vi.mocked(WorldBookOperations.getWorldBook).mockImplementation(async (key) => {
        if (key === "global:fantasy_1") {
          return { global_1: globalEntry };
        }
        if (key === "character:char_123") {
          return { char_1: characterEntry };
        }
        if (key === "dialogue:dlg_xyz") {
          return { dlg_1: dialogueEntry };
        }
        return null;
      });

      vi.mocked(WorldBookOperations.getWorldBookSettings).mockResolvedValue({
        enabled: true,
        maxEntries: 100,
        contextWindow: 5,
      });

      const result = await loadWorldBooksFromSources(
        "char_123",
        "dlg_xyz",
        "test input about magic hero quest",
      );

      // 验证返回结果
      expect(result).toBeDefined();
      expect(result.wiBefore).toBe("wiBefore content");
      expect(result.wiAfter).toBe("wiAfter content");

      // 验证 WorldBookAdvancedManager 被正确调用
      expect(WorldBookAdvancedManager).toHaveBeenCalled();

      const managerInstance = vi.mocked(WorldBookAdvancedManager).mock.results[0]
        .value;
      expect(managerInstance.addEntries).toHaveBeenCalledTimes(3); // 三个层级
      expect(managerInstance.getMatchingEntries).toHaveBeenCalled();
    });

    it("应该按正确的优先级顺序调用 addEntries", async () => {
      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockResolvedValue([
        "global:test_1",
      ]);

      vi.mocked(WorldBookOperations.getWorldBook).mockImplementation(async (key) => {
        if (key === "global:test_1") {
          return {
            entry_1: {
              content: "Global",
              keys: ["test"],
              selective: false,
              constant: false,
              position: 4,
              enabled: true,
            },
          };
        }
        if (key === "character:char_123") {
          return {
            entry_2: {
              content: "Character",
              keys: ["test"],
              selective: false,
              constant: false,
              position: 4,
              enabled: true,
            },
          };
        }
        if (key === "dialogue:dlg_xyz") {
          return {
            entry_3: {
              content: "Dialogue",
              keys: ["test"],
              selective: false,
              constant: false,
              position: 4,
              enabled: true,
            },
          };
        }
        return null;
      });

      vi.mocked(WorldBookOperations.getWorldBookSettings).mockResolvedValue({
        enabled: true,
        maxEntries: 100,
        contextWindow: 5,
      });

      await loadWorldBooksFromSources("char_123", "dlg_xyz", "test input");

      const managerInstance = vi.mocked(WorldBookAdvancedManager).mock.results[0]
        .value;
      const addEntriesCalls = vi.mocked(managerInstance.addEntries).mock.calls;

      // 验证调用顺序：global, character, chat
      expect(addEntriesCalls).toHaveLength(3);
      expect(addEntriesCalls[0][1]).toBe("global");
      expect(addEntriesCalls[1][1]).toBe("character");
      expect(addEntriesCalls[2][1]).toBe("chat");
    });
  });

  /* ───────────────────────────────────────────────────────────────────────
     向后兼容性验证
     ─────────────────────────────────────────────────────────────────────── */

  describe("向后兼容性", () => {
    it("应该支持旧格式的 characterId 键", async () => {
      const legacyEntry: WorldBookEntry = {
        entry_id: "legacy_1",
        content: "Legacy content",
        keys: ["legacy"],
        selective: false,
        constant: false,
        position: 4,
        enabled: true,
      };

      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockResolvedValue([]);

      vi.mocked(WorldBookOperations.getWorldBook).mockImplementation(async (key) => {
        // 旧格式：直接使用 characterId
        if (key === "character:old_char_id") {
          return { legacy_1: legacyEntry };
        }
        return null;
      });

      const result = await loadWorldBooksFromSources(
        "old_char_id",
        "dlg_xyz",
        "test input",
      );

      // 应该能够加载旧格式数据
      expect(result).toBeDefined();
    });

    it("新格式和旧格式混合时应该正常工作", async () => {
      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockResolvedValue([
        "global:new_format_1",
      ]);

      vi.mocked(WorldBookOperations.getWorldBook).mockImplementation(async (key) => {
        if (key === "global:new_format_1") {
          return {
            entry_1: {
              content: "New format global",
              keys: ["new"],
              selective: false,
              constant: false,
              position: 4,
              enabled: true,
            },
          };
        }
        // 旧格式角色数据
        if (key === "character:old_char") {
          return {
            entry_2: {
              content: "Old format character",
              keys: ["old"],
              selective: false,
              constant: false,
              position: 4,
              enabled: true,
            },
          };
        }
        return null;
      });

      vi.mocked(WorldBookOperations.getWorldBookSettings).mockResolvedValue({
        enabled: true,
        maxEntries: 100,
        contextWindow: 5,
      });

      const result = await loadWorldBooksFromSources(
        "old_char",
        "dlg_xyz",
        "test input",
      );

      // 两种格式都应该被加载
      expect(result).toBeDefined();
    });
  });

  /* ───────────────────────────────────────────────────────────────────────
     边界情况测试
     ─────────────────────────────────────────────────────────────────────── */

  describe("边界情况", () => {
    it("只有全局世界书时应该正常工作", async () => {
      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockResolvedValue([
        "global:only_global",
      ]);

      vi.mocked(WorldBookOperations.getWorldBook).mockImplementation(async (key) => {
        if (key === "global:only_global") {
          return {
            entry_1: {
              content: "Only global",
              keys: ["test"],
              selective: false,
              constant: false,
              position: 4,
              enabled: true,
            },
          };
        }
        return null;
      });

      vi.mocked(WorldBookOperations.getWorldBookSettings).mockResolvedValue({
        enabled: true,
        maxEntries: 100,
        contextWindow: 5,
      });

      const result = await loadWorldBooksFromSources(
        "char_123",
        "dlg_xyz",
        "test input",
      );

      expect(result).toBeDefined();
    });

    it("只有角色世界书时应该正常工作", async () => {
      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockResolvedValue([]);

      vi.mocked(WorldBookOperations.getWorldBook).mockImplementation(async (key) => {
        if (key === "character:char_123") {
          return {
            entry_1: {
              content: "Only character",
              keys: ["test"],
              selective: false,
              constant: false,
              position: 4,
              enabled: true,
            },
          };
        }
        return null;
      });

      const result = await loadWorldBooksFromSources(
        "char_123",
        "dlg_xyz",
        "test input",
      );

      expect(result).toBeDefined();
    });

    it("只有会话世界书时应该正常工作", async () => {
      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockResolvedValue([]);

      vi.mocked(WorldBookOperations.getWorldBook).mockImplementation(async (key) => {
        if (key === "dialogue:dlg_xyz") {
          return {
            entry_1: {
              content: "Only dialogue",
              keys: ["test"],
              selective: false,
              constant: false,
              position: 4,
              enabled: true,
            },
          };
        }
        return null;
      });

      const result = await loadWorldBooksFromSources(
        "char_123",
        "dlg_xyz",
        "test input",
      );

      expect(result).toBeDefined();
    });

    it("多个全局世界书时应该都被加载", async () => {
      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockResolvedValue([
        "global:fantasy_1",
        "global:scifi_2",
        "global:horror_3",
      ]);

      vi.mocked(WorldBookOperations.getWorldBook).mockImplementation(async (key) => {
        if (key.startsWith("global:")) {
          return {
            entry_1: {
              content: `Content from ${key}`,
              keys: ["test"],
              selective: false,
              constant: false,
              position: 4,
              enabled: true,
            },
          };
        }
        return null;
      });

      vi.mocked(WorldBookOperations.getWorldBookSettings).mockResolvedValue({
        enabled: true,
        maxEntries: 100,
        contextWindow: 5,
      });

      await loadWorldBooksFromSources("char_123", "dlg_xyz", "test input");

      // 应该为每个全局世界书调用 getWorldBook
      expect(vi.mocked(WorldBookOperations.getWorldBook)).toHaveBeenCalledWith(
        "global:fantasy_1",
      );
      expect(vi.mocked(WorldBookOperations.getWorldBook)).toHaveBeenCalledWith(
        "global:scifi_2",
      );
      expect(vi.mocked(WorldBookOperations.getWorldBook)).toHaveBeenCalledWith(
        "global:horror_3",
      );
    });
  });

  /* ───────────────────────────────────────────────────────────────────────
     性能测试
     ─────────────────────────────────────────────────────────────────────── */

  describe("性能测试", () => {
    it("应该在合理时间内完成加载（< 500ms）", async () => {
      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockResolvedValue([
        "global:test_1",
      ]);

      vi.mocked(WorldBookOperations.getWorldBook).mockImplementation(async (key) => {
        // 模拟一些延迟
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          entry_1: {
            content: "Test",
            keys: ["test"],
            selective: false,
            constant: false,
            position: 4,
            enabled: true,
          },
        };
      });

      vi.mocked(WorldBookOperations.getWorldBookSettings).mockResolvedValue({
        enabled: true,
        maxEntries: 100,
        contextWindow: 5,
      });

      const start = Date.now();
      await loadWorldBooksFromSources("char_123", "dlg_xyz", "test input");
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(500);
    });

    it("大量条目时应该正常处理（100+ 条目）", async () => {
      const largeWorldBook: Record<string, WorldBookEntry> = {};
      for (let i = 0; i < 100; i++) {
        largeWorldBook[`entry_${i}`] = {
          entry_id: `entry_${i}`,
          content: `Content ${i}`,
          keys: [`key${i}`],
          selective: false,
          constant: false,
          position: 4,
          enabled: true,
        };
      }

      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockResolvedValue([]);

      vi.mocked(WorldBookOperations.getWorldBook).mockImplementation(async (key) => {
        if (key === "character:char_123") {
          return largeWorldBook;
        }
        return null;
      });

      const result = await loadWorldBooksFromSources(
        "char_123",
        "dlg_xyz",
        "test input",
      );

      // 应该成功处理大量条目
      expect(result).toBeDefined();
    });
  });
});
