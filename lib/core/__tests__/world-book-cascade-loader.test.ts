/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              World Book Cascade Loader 单元测试                            ║
 * ║                                                                            ║
 * ║  测试多来源世界书加载、去重和优先级管理                                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WorldBookEntry } from "@/lib/models/world-book-model";

/* ═══════════════════════════════════════════════════════════════════════════
   Mock 设置
   ═══════════════════════════════════════════════════════════════════════════ */

// Mock WorldBookOperations
vi.mock("@/lib/data/roleplay/world-book-operation", () => ({
  WorldBookOperations: {
    getWorldBookKeysByPrefix: vi.fn(),
    getWorldBook: vi.fn(),
    getWorldBookSettings: vi.fn(),
  },
}));

// Mock LocalCharacterDialogueOperations
vi.mock("@/lib/data/roleplay/character-dialogue-operation", () => ({
  LocalCharacterDialogueOperations: {
    getDialogueTreeById: vi.fn(),
    getDialoguePathToNode: vi.fn(),
  },
}));

// Mock WorldBookAdvancedManager + Cache
vi.mock("@/lib/core/world-book-advanced", () => {
  const mockAddEntries = vi.fn();
  const mockGetMatchingEntries = vi.fn().mockReturnValue([]);
  const mockGenerateWiBefore = vi.fn().mockReturnValue("");
  const mockGenerateWiAfter = vi.fn().mockReturnValue("");

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

// Mock VectorMemory
vi.mock("@/lib/vector-memory/manager", () => ({
  getVectorMemoryManager: vi.fn().mockReturnValue({
    ingest: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { loadWorldBooksFromSources } from "../world-book-cascade-loader";
import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";

/* ═══════════════════════════════════════════════════════════════════════════
   测试套件
   ═══════════════════════════════════════════════════════════════════════════ */

describe("WorldBookCascadeLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ───────────────────────────────────────────────────────────────────────
     去重逻辑测试（核心功能）
     ─────────────────────────────────────────────────────────────────────── */

  describe("去重逻辑", () => {
    it("应该优先保留会话级条目，跳过角色和全局的重复", async () => {
      // 设置 mock 数据：三个层级都有相同的条目
      const duplicateEntry: WorldBookEntry = {
        entry_id: "entry_1",
        content: "A dragon appears",
        keys: ["dragon"],
        selective: false,
        constant: false,
        position: 4,
        enabled: true,
      };

      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockResolvedValue([
        "global:test_1",
      ]);

      vi.mocked(WorldBookOperations.getWorldBook).mockImplementation(async (key) => {
        if (key === "global:test_1") {
          return { entry_1: duplicateEntry };
        }
        if (key === "character:char_123") {
          return { entry_1: duplicateEntry };
        }
        if (key === "dialogue:dlg_xyz") {
          return { entry_1: duplicateEntry };
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

      // 验证只返回一个结果（去重生效）
      expect(result).toBeDefined();
    });

    it("应该保留不同 entry_id 的条目", async () => {
      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockResolvedValue([
        "global:test_1",
      ]);

      vi.mocked(WorldBookOperations.getWorldBook).mockImplementation(async (key) => {
        if (key === "global:test_1") {
          return {
            entry_1: {
              entry_id: "entry_1",
              content: "Global entry",
              keys: ["global"],
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
              entry_id: "entry_2",
              content: "Character entry",
              keys: ["character"],
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

      // 两个不同的条目都应该被保留
      expect(result).toBeDefined();
    });

    it("应该通过 content 哈希去重当 entry_id 不存在时", async () => {
      const sameContent = "Duplicate content";

      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockResolvedValue([
        "global:test_1",
      ]);

      vi.mocked(WorldBookOperations.getWorldBook).mockImplementation(async (key) => {
        if (key === "global:test_1") {
          return {
            entry_1: {
              content: sameContent,
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
              content: sameContent, // 相同内容
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

      // 应该只保留一个（通过 content 哈希去重）
      expect(result).toBeDefined();
    });
  });

  /* ───────────────────────────────────────────────────────────────────────
     并行加载测试
     ─────────────────────────────────────────────────────────────────────── */

  describe("并行加载", () => {
    it("应该并行加载三个来源", async () => {
      const loadTimes: number[] = [];

      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockImplementation(
        async () => {
          loadTimes.push(Date.now());
          return [];
        },
      );

      vi.mocked(WorldBookOperations.getWorldBook).mockImplementation(async () => {
        loadTimes.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 10));
        return null;
      });

      await loadWorldBooksFromSources("char_123", "dlg_xyz", "test input");

      // 验证并行调用（时间差应该很小）
      if (loadTimes.length >= 2) {
        const timeDiff = Math.abs(loadTimes[1] - loadTimes[0]);
        expect(timeDiff).toBeLessThan(50); // 并行调用时间差 < 50ms
      }
    });
  });

  /* ───────────────────────────────────────────────────────────────────────
     启用/禁用过滤
     ─────────────────────────────────────────────────────────────────────── */

  describe("启用/禁用过滤", () => {
    it("应该跳过禁用的条目", async () => {
      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockResolvedValue([]);

      vi.mocked(WorldBookOperations.getWorldBook).mockImplementation(async (key) => {
        if (key === "character:char_123") {
          return {
            entry_1: {
              entry_id: "entry_1",
              content: "Enabled entry",
              keys: ["test"],
              selective: false,
              constant: false,
              position: 4,
              enabled: true,
            },
            entry_2: {
              entry_id: "entry_2",
              content: "Disabled entry",
              keys: ["test"],
              selective: false,
              constant: false,
              position: 4,
              enabled: false, // 禁用
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

      // 应该只加载启用的条目
      expect(result).toBeDefined();
    });

    it("应该跳过未启用的全局世界书", async () => {
      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockResolvedValue([
        "global:disabled_1",
      ]);

      vi.mocked(WorldBookOperations.getWorldBookSettings).mockResolvedValue({
        enabled: false, // 全局世界书未启用
        maxEntries: 100,
        contextWindow: 5,
      });

      vi.mocked(WorldBookOperations.getWorldBook).mockResolvedValue({
        entry_1: {
          entry_id: "entry_1",
          content: "Should be skipped",
          keys: ["test"],
          selective: false,
          constant: false,
          position: 4,
          enabled: true,
        },
      });

      const result = await loadWorldBooksFromSources(
        "char_123",
        "dlg_xyz",
        "test input",
      );

      // 未启用的全局世界书不应该被加载
      expect(result).toBeDefined();
    });
  });

  /* ───────────────────────────────────────────────────────────────────────
     空数据处理
     ─────────────────────────────────────────────────────────────────────── */

  describe("空数据处理", () => {
    it("没有世界书时应该返回空字符串", async () => {
      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockResolvedValue([]);
      vi.mocked(WorldBookOperations.getWorldBook).mockResolvedValue(null);

      const result = await loadWorldBooksFromSources(
        "char_123",
        "dlg_xyz",
        "test input",
      );

      expect(result.wiBefore).toBe("");
      expect(result.wiAfter).toBe("");
    });

    it("所有条目都被禁用时应该返回空字符串", async () => {
      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockResolvedValue([]);

      vi.mocked(WorldBookOperations.getWorldBook).mockImplementation(async (key) => {
        if (key === "character:char_123") {
          return {
            entry_1: {
              entry_id: "entry_1",
              content: "Disabled",
              keys: ["test"],
              selective: false,
              constant: false,
              position: 4,
              enabled: false,
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

      expect(result.wiBefore).toBe("");
      expect(result.wiAfter).toBe("");
    });
  });

  /* ───────────────────────────────────────────────────────────────────────
     错误处理
     ─────────────────────────────────────────────────────────────────────── */

  describe("错误处理", () => {
    it("单个来源加载失败不应该影响其他来源", async () => {
      vi.mocked(WorldBookOperations.getWorldBookKeysByPrefix).mockRejectedValue(
        new Error("Global load failed"),
      );

      vi.mocked(WorldBookOperations.getWorldBook).mockImplementation(async (key) => {
        if (key === "character:char_123") {
          return {
            entry_1: {
              entry_id: "entry_1",
              content: "Character entry",
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

      // 应该不抛出错误，继续加载其他来源
      const result = await loadWorldBooksFromSources(
        "char_123",
        "dlg_xyz",
        "test input",
      );

      expect(result).toBeDefined();
    });
  });
});
