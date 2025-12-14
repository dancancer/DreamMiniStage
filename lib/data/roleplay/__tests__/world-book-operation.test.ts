/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              World Book Operations 单元测试                                ║
 * ║                                                                            ║
 * ║  测试存储层的新键格式支持和向后兼容性                                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";
import type { WorldBookEntry } from "@/lib/models/world-book-model";

/* ═══════════════════════════════════════════════════════════════════════════
   Mock 设置
   ═══════════════════════════════════════════════════════════════════════════ */

vi.mock("@/lib/data/local-storage", () => ({
  WORLD_BOOK_FILE: "world_book",
  getAllEntries: vi.fn(),
  getRecordByKey: vi.fn(),
  putRecord: vi.fn(),
  clearStore: vi.fn(),
}));

import {
  getAllEntries,
  getRecordByKey,
  putRecord,
  clearStore,
} from "@/lib/data/local-storage";

/* ═══════════════════════════════════════════════════════════════════════════
   测试套件
   ═══════════════════════════════════════════════════════════════════════════ */

describe("WorldBookOperations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ───────────────────────────────────────────────────────────────────────
     getWorldBookKeysByPrefix 测试（新功能）
     ─────────────────────────────────────────────────────────────────────── */

  describe("getWorldBookKeysByPrefix", () => {
    it("应该返回匹配前缀的所有键", async () => {
      vi.mocked(getAllEntries).mockResolvedValue([
        { key: "global:fantasy_1", value: {} },
        { key: "global:scifi_2", value: {} },
        { key: "character:char_123", value: {} },
        { key: "dialogue:dlg_xyz", value: {} },
        { key: "global:fantasy_1_settings", value: {} }, // settings 键
      ]);

      const result = await WorldBookOperations.getWorldBookKeysByPrefix("global:");

      expect(result).toEqual(["global:fantasy_1", "global:scifi_2"]);
      expect(result).not.toContain("global:fantasy_1_settings"); // 应该排除 settings
    });

    it("应该排除 settings 键", async () => {
      vi.mocked(getAllEntries).mockResolvedValue([
        { key: "character:char_1", value: {} },
        { key: "character:char_1_settings", value: {} },
        { key: "character:char_2", value: {} },
      ]);

      const result = await WorldBookOperations.getWorldBookKeysByPrefix("character:");

      expect(result).toEqual(["character:char_1", "character:char_2"]);
      expect(result).toHaveLength(2);
    });

    it("没有匹配的键时应该返回空数组", async () => {
      vi.mocked(getAllEntries).mockResolvedValue([
        { key: "character:char_1", value: {} },
        { key: "dialogue:dlg_1", value: {} },
      ]);

      const result = await WorldBookOperations.getWorldBookKeysByPrefix("global:");

      expect(result).toEqual([]);
    });

    it("应该处理不同的前缀", async () => {
      vi.mocked(getAllEntries).mockResolvedValue([
        { key: "global:test_1", value: {} },
        { key: "character:test_2", value: {} },
        { key: "dialogue:test_3", value: {} },
        { key: "persona:test_4", value: {} },
      ]);

      const globalKeys = await WorldBookOperations.getWorldBookKeysByPrefix("global:");
      const charKeys = await WorldBookOperations.getWorldBookKeysByPrefix("character:");
      const dialogueKeys = await WorldBookOperations.getWorldBookKeysByPrefix("dialogue:");

      expect(globalKeys).toEqual(["global:test_1"]);
      expect(charKeys).toEqual(["character:test_2"]);
      expect(dialogueKeys).toEqual(["dialogue:test_3"]);
    });
  });

  /* ───────────────────────────────────────────────────────────────────────
     getWorldBook 向后兼容性测试
     ─────────────────────────────────────────────────────────────────────── */

  describe("getWorldBook - 向后兼容", () => {
    it("应该支持新格式键（character:id）", async () => {
      const testWorldBook = {
        entry_1: {
          content: "Test content",
          keys: ["test"],
          selective: false,
          constant: false,
          position: 4,
        },
      };

      vi.mocked(getRecordByKey).mockResolvedValue(testWorldBook);

      const result = await WorldBookOperations.getWorldBook("character:char_123");

      expect(result).toEqual(testWorldBook);
      expect(getRecordByKey).toHaveBeenCalledWith("world_book", "character:char_123");
    });

    it("应该支持新格式键（global:id）", async () => {
      const testWorldBook = {
        entry_1: {
          content: "Global content",
          keys: ["global"],
          selective: false,
          constant: false,
          position: 4,
        },
      };

      vi.mocked(getRecordByKey).mockResolvedValue(testWorldBook);

      const result = await WorldBookOperations.getWorldBook("global:fantasy_1");

      expect(result).toEqual(testWorldBook);
    });

    it("应该支持新格式键（dialogue:id）", async () => {
      const testWorldBook = {
        entry_1: {
          content: "Dialogue content",
          keys: ["dialogue"],
          selective: false,
          constant: false,
          position: 4,
        },
      };

      vi.mocked(getRecordByKey).mockResolvedValue(testWorldBook);

      const result = await WorldBookOperations.getWorldBook("dialogue:dlg_xyz");

      expect(result).toEqual(testWorldBook);
    });

    it("应该 fallback 到旧格式当新格式不存在时", async () => {
      const testWorldBook = {
        entry_1: {
          content: "Legacy content",
          keys: ["legacy"],
          selective: false,
          constant: false,
          position: 4,
        },
      };

      // 第一次调用（新格式）返回 null
      // 第二次调用（旧格式 fallback）返回数据
      vi.mocked(getRecordByKey)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(testWorldBook);

      const result = await WorldBookOperations.getWorldBook("char_123");

      // 应该尝试两次：1. char_123  2. character:char_123
      expect(getRecordByKey).toHaveBeenCalledTimes(2);
      expect(getRecordByKey).toHaveBeenNthCalledWith(1, "world_book", "char_123");
      expect(getRecordByKey).toHaveBeenNthCalledWith(
        2,
        "world_book",
        "character:char_123",
      );
      expect(result).toEqual(testWorldBook);
    });

    it("旧格式键不应该触发 fallback（因为包含冒号检查）", async () => {
      const testWorldBook = {
        entry_1: {
          content: "Test",
          keys: ["test"],
          selective: false,
          constant: false,
          position: 4,
        },
      };

      vi.mocked(getRecordByKey).mockResolvedValue(testWorldBook);

      await WorldBookOperations.getWorldBook("character:char_123");

      // 只应该调用一次（不触发 fallback）
      expect(getRecordByKey).toHaveBeenCalledTimes(1);
    });

    it("找不到数据时应该返回 null", async () => {
      vi.mocked(getRecordByKey).mockResolvedValue(null);

      const result = await WorldBookOperations.getWorldBook("nonexistent_key");

      expect(result).toBeNull();
    });
  });

  /* ───────────────────────────────────────────────────────────────────────
     updateWorldBook 新键格式支持
     ─────────────────────────────────────────────────────────────────────── */

  describe("updateWorldBook - 新键格式", () => {
    it("应该支持使用全局键保存", async () => {
      const entries: WorldBookEntry[] = [
        {
          content: "Global entry",
          keys: ["test"],
          selective: false,
          constant: false,
          position: 4,
        },
      ];

      vi.mocked(getAllEntries).mockResolvedValue([]);
      vi.mocked(putRecord).mockResolvedValue(undefined);
      vi.mocked(clearStore).mockResolvedValue(undefined);

      const result = await WorldBookOperations.updateWorldBook(
        "global:fantasy_1",
        entries,
      );

      expect(result).toBe(true);
      expect(putRecord).toHaveBeenCalledWith(
        "world_book",
        "global:fantasy_1",
        expect.any(Object),
      );
    });

    it("应该支持使用会话键保存", async () => {
      const entries: WorldBookEntry[] = [
        {
          content: "Dialogue entry",
          keys: ["test"],
          selective: false,
          constant: false,
          position: 4,
        },
      ];

      vi.mocked(getAllEntries).mockResolvedValue([]);
      vi.mocked(putRecord).mockResolvedValue(undefined);
      vi.mocked(clearStore).mockResolvedValue(undefined);

      const result = await WorldBookOperations.updateWorldBook(
        "dialogue:dlg_xyz",
        entries,
      );

      expect(result).toBe(true);
      expect(putRecord).toHaveBeenCalledWith(
        "world_book",
        "dialogue:dlg_xyz",
        expect.any(Object),
      );
    });
  });

  /* ───────────────────────────────────────────────────────────────────────
     CRUD 操作测试
     ─────────────────────────────────────────────────────────────────────── */

  describe("CRUD 操作", () => {
    it("addWorldBookEntry 应该支持新键格式", async () => {
      const existingBook = {
        entry_0: {
          content: "Existing",
          keys: ["test"],
          selective: false,
          constant: false,
          position: 4,
        },
      };

      vi.mocked(getRecordByKey).mockResolvedValue(existingBook);
      vi.mocked(getAllEntries).mockResolvedValue([]);
      vi.mocked(putRecord).mockResolvedValue(undefined);
      vi.mocked(clearStore).mockResolvedValue(undefined);

      const newEntry: WorldBookEntry = {
        content: "New entry",
        keys: ["new"],
        selective: false,
        constant: false,
        position: 4,
      };

      const result = await WorldBookOperations.addWorldBookEntry(
        "global:fantasy_1",
        newEntry,
      );

      expect(result).toBe("entry_1"); // 应该生成新的 entry_id
    });

    it("updateWorldBookEntry 应该支持新键格式", async () => {
      const existingBook = {
        entry_1: {
          content: "Old content",
          keys: ["test"],
          selective: false,
          constant: false,
          position: 4,
        },
      };

      vi.mocked(getRecordByKey).mockResolvedValue(existingBook);
      vi.mocked(getAllEntries).mockResolvedValue([]);
      vi.mocked(putRecord).mockResolvedValue(undefined);
      vi.mocked(clearStore).mockResolvedValue(undefined);

      const result = await WorldBookOperations.updateWorldBookEntry(
        "dialogue:dlg_xyz",
        "entry_1",
        { content: "Updated content" },
      );

      expect(result).toBe(true);
    });

    it("deleteWorldBookEntry 应该支持新键格式", async () => {
      const existingBook = {
        entry_1: {
          content: "To be deleted",
          keys: ["test"],
          selective: false,
          constant: false,
          position: 4,
        },
      };

      vi.mocked(getRecordByKey).mockResolvedValue(existingBook);
      vi.mocked(getAllEntries).mockResolvedValue([]);
      vi.mocked(putRecord).mockResolvedValue(undefined);
      vi.mocked(clearStore).mockResolvedValue(undefined);

      const result = await WorldBookOperations.deleteWorldBookEntry(
        "global:fantasy_1",
        "entry_1",
      );

      expect(result).toBe(true);
    });
  });

  /* ───────────────────────────────────────────────────────────────────────
     Settings 管理测试
     ─────────────────────────────────────────────────────────────────────── */

  describe("Settings 管理", () => {
    it("getWorldBookSettings 应该支持新键格式", async () => {
      const settings = {
        enabled: true,
        maxEntries: 100,
        contextWindow: 5,
        metadata: {
          id: "global:fantasy_1",
          name: "Fantasy World",
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          entryCount: 10,
        },
      };

      vi.mocked(getRecordByKey).mockResolvedValue(settings);

      const result = await WorldBookOperations.getWorldBookSettings("global:fantasy_1");

      expect(result).toEqual(settings);
      expect(getRecordByKey).toHaveBeenCalledWith(
        "world_book",
        "global:fantasy_1_settings",
      );
    });

    it("updateWorldBookSettings 应该支持新键格式", async () => {
      vi.mocked(getRecordByKey).mockResolvedValue({
        enabled: true,
        maxEntries: 50,
        contextWindow: 5,
      });
      vi.mocked(getAllEntries).mockResolvedValue([]);
      vi.mocked(putRecord).mockResolvedValue(undefined);
      vi.mocked(clearStore).mockResolvedValue(undefined);

      const updates = {
        enabled: false,
        maxEntries: 100,
      };

      const result = await WorldBookOperations.updateWorldBookSettings(
        "dialogue:dlg_xyz",
        updates,
      );

      expect(result.enabled).toBe(false);
      expect(result.maxEntries).toBe(100);
    });

    it("deleteWorldBook 应该删除主记录和 settings", async () => {
      vi.mocked(getAllEntries).mockResolvedValue([
        { key: "global:fantasy_1", value: {} },
        { key: "global:fantasy_1_settings", value: {} },
      ]);
      vi.mocked(putRecord).mockResolvedValue(undefined);
      vi.mocked(clearStore).mockResolvedValue(undefined);

      const result = await WorldBookOperations.deleteWorldBook("global:fantasy_1");

      expect(result).toBe(true);
    });
  });
});
