/**
 * @input  lib/data/local-storage, lib/models/world-book-model
 * @output WorldBookOperations, WorldBookSettings
 * @pos    世界书数据操作层,管理条目的 CRUD 与设置
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

import {
  WORLD_BOOK_FILE,
  clearStore,
  getAllEntries,
  getRecordByKey,
  putRecord,
} from "@/lib/data/local-storage";
import { WorldBookEntry } from "@/lib/models/world-book-model";

export interface WorldBookSettings {
  enabled: boolean;
  maxEntries: number;
  contextWindow: number;
  metadata?: unknown;
}

const DEFAULT_SETTINGS: WorldBookSettings = {
  enabled: true,
  maxEntries: 5,
  contextWindow: 5,
};

export class WorldBookOperations {
  // ════════════════════════════════════════════════════════════════════════
  // 通用工具方法
  // ════════════════════════════════════════════════════════════════════════

  /**
   * 获取所有世界书键值对
   */
  static async getWorldBooks(): Promise<Record<string, unknown>> {
    const entries = await getAllEntries<unknown>(WORLD_BOOK_FILE);
    return entries.reduce<Record<string, unknown>>((acc, { key, value }) => {
      if (key) {
        acc[String(key)] = value;
      }
      return acc;
    }, {});
  }

  /**
   * 按前缀过滤世界书键
   *
   * @param prefix - 键前缀（如 "global:", "character:", "dialogue:"）
   * @returns 匹配前缀的所有键
   *
   * @example
   * ```ts
   * // 获取所有全局世界书
   * const globalKeys = await getWorldBookKeysByPrefix("global:");
   * // 结果: ["global:fantasy_1", "global:scifi_2"]
   * ```
   */
  static async getWorldBookKeysByPrefix(prefix: string): Promise<string[]> {
    const allBooks = await this.getWorldBooks();
    return Object.keys(allBooks).filter((key) => {
      // 排除 settings 键
      if (key.endsWith("_settings")) return false;
      // 匹配前缀
      return key.startsWith(prefix);
    });
  }

  private static async saveWorldBooks(worldBooks: Record<string, unknown>): Promise<void> {
    await clearStore(WORLD_BOOK_FILE);
    for (const [key, value] of Object.entries(worldBooks)) {
      await putRecord(WORLD_BOOK_FILE, key, value);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 世界书 CRUD 操作
  // ════════════════════════════════════════════════════════════════════════

  /**
   * 获取世界书条目集合
   *
   * @param key - 存储键（如 "global:id", "character:id", "dialogue:id"）
   *
   * @returns 世界书条目字典，失败时返回 null
   *
   * @example
   * ```ts
   * const globalBook = await getWorldBook("global:fantasy_1");
   * const characterBook = await getWorldBook("character:char_123");
   * const dialogueBook = await getWorldBook("dialogue:dlg_xyz");
   * ```
   */
  static async getWorldBook(key: string): Promise<Record<string, WorldBookEntry> | null> {
    try {
      const worldBook = await getRecordByKey<Record<string, WorldBookEntry>>(WORLD_BOOK_FILE, key);
      return worldBook || null;
    } catch (error) {
      console.error("Error getting world book:", error);
      return null;
    }
  }
  
  /**
   * 更新世界书条目集合
   *
   * @param key - 存储键（如 "global:id", "character:id", "dialogue:id"）
   * @param worldBook - 世界书条目集合（字典或数组格式）
   */
  static async updateWorldBook(
    key: string,
    worldBook: Record<string, WorldBookEntry> | WorldBookEntry[],
  ): Promise<boolean> {
    const worldBooks = await this.getWorldBooks();

    const processEntry = (entry: WorldBookEntry): WorldBookEntry => {
      const ext = (entry.extensions || {}) as Record<string, unknown>;
      const extDepth = typeof ext.depth === "number" ? ext.depth : undefined;
      const extPosition = typeof ext.position === "number" ? ext.position : undefined;
      const extProbability = typeof ext.probability === "number" ? ext.probability : undefined;
      const extUseProbability = typeof ext.useProbability === "boolean"
        ? ext.useProbability
        : (typeof ext.use_probability === "boolean" ? ext.use_probability : undefined);
      const extGroup = typeof ext.group === "string" ? ext.group : undefined;
      const extGroupPriority = typeof ext.group_priority === "number"
        ? ext.group_priority
        : (typeof ext.groupPriority === "number" ? ext.groupPriority : undefined);
      const extGroupWeight = typeof ext.group_weight === "number"
        ? ext.group_weight
        : (typeof ext.groupWeight === "number" ? ext.groupWeight : undefined);

      return {
        ...entry,
        depth: extDepth ?? entry.depth ?? 1,
        position: extPosition ?? entry.position ?? 4,
        probability: entry.probability ?? extProbability,
        useProbability: entry.useProbability ?? extUseProbability,
        group: entry.group ?? extGroup,
        group_priority: entry.group_priority ?? entry.groupPriority ?? extGroupPriority,
        group_weight: entry.group_weight ?? entry.groupWeight ?? extGroupWeight,
        groupPriority: entry.groupPriority ?? entry.group_priority ?? extGroupPriority,
        groupWeight: entry.groupWeight ?? entry.group_weight ?? extGroupWeight,
      } as WorldBookEntry;
    };

    const entries = Array.isArray(worldBook)
      ? worldBook.reduce((acc, entry, i) => {
        const processedEntry = processEntry(entry);
        return {
          ...acc,
          [`entry_${i}`]: processedEntry,
        };
      }, {} as Record<string, WorldBookEntry>)
      : Object.fromEntries(
        Object.entries(worldBook).map(([entryKey, entry]) => {
          const processedEntry = processEntry(entry);
          return [entryKey, processedEntry];
        }),
      );

    worldBooks[key] = entries;
    await this.saveWorldBooks(worldBooks);
    return true;
  }

  /**
   * 添加世界书条目
   *
   * @param key - 存储键
   * @param entry - 世界书条目
   * @returns 成功时返回条目 ID，失败时返回 null
   */
  static async addWorldBookEntry(
    key: string,
    entry: WorldBookEntry,
  ): Promise<string | null> {
    const worldBook = await this.getWorldBook(key) || {};

    const entryId = `entry_${Object.keys(worldBook).length}`;

    worldBook[entryId] = entry;

    const success = await this.updateWorldBook(key, worldBook);

    return success ? entryId : null;
  }

  /**
   * 更新世界书条目
   *
   * @param key - 存储键
   * @param entryId - 条目 ID
   * @param updates - 更新内容
   */
  static async updateWorldBookEntry(
    key: string,
    entryId: string,
    updates: Partial<WorldBookEntry>,
  ): Promise<boolean> {
    const worldBook = await this.getWorldBook(key);

    if (!worldBook || !worldBook[entryId]) {
      return false;
    }

    worldBook[entryId] = { ...worldBook[entryId], ...updates };

    return this.updateWorldBook(key, worldBook);
  }

  /**
   * 删除世界书条目
   *
   * @param key - 存储键
   * @param entryId - 条目 ID
   */
  static async deleteWorldBookEntry(key: string, entryId: string): Promise<boolean> {
    const worldBook = await this.getWorldBook(key);

    if (!worldBook || !worldBook[entryId]) {
      return false;
    }

    delete worldBook[entryId];

    return this.updateWorldBook(key, worldBook);
  }
  
  // ════════════════════════════════════════════════════════════════════════
  // 世界书设置管理
  // ════════════════════════════════════════════════════════════════════════

  /**
   * 获取世界书设置
   *
   * @param key - 存储键
   * @returns 世界书设置（包含默认值）
   */
  static async getWorldBookSettings(key: string): Promise<WorldBookSettings> {
    const settings = await getRecordByKey<WorldBookSettings>(WORLD_BOOK_FILE, `${key}_settings`);

    if (!settings) {
      return { ...DEFAULT_SETTINGS };
    }

    return {
      ...DEFAULT_SETTINGS,
      ...settings,
    };
  }

  /**
   * 更新世界书设置
   *
   * @param key - 存储键
   * @param updates - 更新内容
   * @returns 更新后的设置
   */
  static async updateWorldBookSettings(
    key: string,
    updates: Partial<WorldBookSettings>,
  ): Promise<WorldBookSettings> {
    const worldBooks = await this.getWorldBooks();
    const currentSettings = await this.getWorldBookSettings(key);
    const newSettings = { ...currentSettings, ...updates };

    worldBooks[`${key}_settings`] = newSettings;
    await this.saveWorldBooks(worldBooks);

    return newSettings;
  }

  /**
   * 删除世界书（包括条目和设置）
   *
   * @param key - 存储键
   * @returns 是否成功删除
   */
  static async deleteWorldBook(key: string): Promise<boolean> {
    try {
      const worldBooks = await this.getWorldBooks();
      let changed = false;

      if (worldBooks[key]) {
        delete worldBooks[key];
        changed = true;
      }

      if (worldBooks[`${key}_settings`]) {
        delete worldBooks[`${key}_settings`];
        changed = true;
      }

      if (!changed) return false;

      await this.saveWorldBooks(worldBooks);
      return true;
    } catch (error) {
      console.error("Error deleting world book:", error);
      return false;
    }
  }
}
