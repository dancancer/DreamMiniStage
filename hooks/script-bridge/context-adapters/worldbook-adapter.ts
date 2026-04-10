/**
 * @input  lib/data/roleplay/world-book-operation, lib/vector-memory/*
 * @output createWorldBookAdapters
 * @pos    Slash 执行上下文适配 - World Book CRUD & 向量记忆读写
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       World Book Adapter                                  ║
 * ║                                                                           ║
 * ║  职责：World Book 条目 CRUD + Vector Memory 开关与阈值读写              ║
 * ║  模式：工厂函数，接收闭包变量 characterId                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { WorldBookEntryData } from "@/lib/slash-command/types";
import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";
import type { WorldBookEntry } from "@/lib/models/world-book-model";
import {
  isVectorMemoryEnabled,
  setVectorMemoryEnabled,
} from "@/lib/vector-memory/manager";
import {
  getVectorChatsState,
  getVectorFilesState,
  getVectorMaxEntriesSetting,
  getVectorQuerySetting,
  getVectorThresholdSetting,
  setVectorChatsState,
  setVectorFilesState,
  setVectorMaxEntriesSetting,
  setVectorQuerySetting,
  setVectorThresholdSetting,
} from "@/lib/vector-memory/settings";

/* ────────────────────────────────────────────────────────────
 *  工厂函数
 * ──────────────────────────────────────────────────────────── */

export function createWorldBookAdapters(characterId: string | undefined) {

  /* ── World Book CRUD ─────────────────────────────── */

  const getWorldBookEntry = async (id: string): Promise<WorldBookEntryData | undefined> => {
    if (!characterId) return undefined;
    const wb = await WorldBookOperations.getWorldBook(characterId);
    if (!wb) return undefined;
    const entry = Object.values(wb).find(
      (e: WorldBookEntry) => String(e.id) === id || String(e.entry_id) === id,
    );
    if (!entry) return undefined;
    return {
      id: String(entry.id || entry.entry_id || ""),
      keys: entry.keys || [],
      content: entry.content || "",
      enabled: entry.enabled !== false,
      comment: entry.comment,
      priority: (entry as WorldBookEntry & { priority?: number }).priority,
      depth: (entry as WorldBookEntry & { depth?: number }).depth,
    };
  };

  const searchWorldBook = async (query: string): Promise<WorldBookEntryData[]> => {
    if (!characterId || !query) return [];
    const wb = await WorldBookOperations.getWorldBook(characterId);
    if (!wb) return [];
    const lowerQuery = query.toLowerCase();
    return Object.values(wb)
      .filter((e: WorldBookEntry) =>
        e.keys?.some((k: string) => k.toLowerCase().includes(lowerQuery)) ||
        e.content?.toLowerCase().includes(lowerQuery),
      )
      .map((e: WorldBookEntry) => ({
        id: String(e.id || e.entry_id || ""),
        keys: e.keys || [],
        content: e.content || "",
        enabled: e.enabled !== false,
        comment: e.comment,
      }));
  };

  const listWorldBookEntries = async (_bookName?: string): Promise<WorldBookEntryData[]> => {
    const targetName = _bookName || characterId;
    if (!targetName) return [];
    const wb = await WorldBookOperations.getWorldBook(targetName);
    if (!wb) return [];
    return Object.values(wb).map((e: WorldBookEntry) => ({
      id: String(e.id || e.entry_id || ""),
      keys: e.keys || [],
      content: e.content || "",
      enabled: e.enabled !== false,
      comment: e.comment,
    }));
  };

  const createWorldBookEntry = async (
    data: Partial<WorldBookEntryData>,
    bookName?: string,
  ): Promise<WorldBookEntryData | undefined> => {
    const targetBook = (bookName || characterId || "").trim();
    if (!targetBook) {
      throw new Error("/createlore requires file=<book>");
    }

    const worldBook = await WorldBookOperations.getWorldBook(targetBook) || {};
    const nextUid = Object.values(worldBook).reduce((maxUid, entry) => {
      const ids = [entry.id, entry.entry_id]
        .map((candidate) => Number.parseInt(String(candidate), 10))
        .filter((candidate) => Number.isInteger(candidate) && candidate >= 0);
      if (ids.length === 0) {
        return maxUid;
      }
      return Math.max(maxUid, ...ids);
    }, 0) + 1;

    const keys = Array.isArray(data.keys)
      ? data.keys.map((item) => String(item).trim()).filter((item) => item.length > 0)
      : [];
    const content = typeof data.content === "string" ? data.content : "";
    const comment = typeof data.comment === "string" ? data.comment : undefined;
    const enabled = data.enabled !== false;

    const entry: WorldBookEntry = {
      id: nextUid,
      entry_id: String(nextUid),
      keys,
      content,
      comment,
      enabled,
      selective: false,
      constant: false,
      position: 4,
    };

    const nextEntryIndex = Object.keys(worldBook).reduce((maxIndex, entryKey) => {
      const matched = /^entry_(\d+)$/.exec(entryKey);
      if (!matched) {
        return maxIndex;
      }
      const parsed = Number.parseInt(matched[1], 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        return maxIndex;
      }
      return Math.max(maxIndex, parsed);
    }, -1) + 1;

    worldBook[`entry_${nextEntryIndex}`] = entry;
    const saved = await WorldBookOperations.updateWorldBook(targetBook, worldBook);
    if (!saved) {
      throw new Error(`/createlore failed to persist entry in file=${targetBook}`);
    }

    return {
      id: String(nextUid),
      keys,
      content,
      comment,
      enabled,
    };
  };

  /* ── Vector Memory 开关与阈值 ────────────────────── */

  const getVectorWorldInfoState = (): boolean => isVectorMemoryEnabled();
  const setVectorWorldInfoState = (enabled: boolean): boolean => {
    setVectorMemoryEnabled(enabled);
    return isVectorMemoryEnabled();
  };
  const getVectorChatsEnabled = (): boolean => getVectorChatsState();
  const setVectorChatsEnabled = (enabled: boolean): boolean => setVectorChatsState(enabled);
  const getVectorFilesEnabled = (): boolean => getVectorFilesState();
  const setVectorFilesEnabled = (enabled: boolean): boolean => setVectorFilesState(enabled);
  const getVectorQueryMessages = (): number => getVectorQuerySetting();
  const setVectorQueryMessages = (value: number): number => setVectorQuerySetting(value);
  const getVectorScoreThreshold = (): number => getVectorThresholdSetting();
  const setVectorScoreThreshold = (value: number): number => setVectorThresholdSetting(value);
  const getVectorMaxEntries = (): number => getVectorMaxEntriesSetting();
  const setVectorMaxEntries = (value: number): number => setVectorMaxEntriesSetting(value);

  return {
    getWorldBookEntry,
    searchWorldBook,
    listWorldBookEntries,
    createWorldBookEntry,
    getVectorWorldInfoState,
    setVectorWorldInfoState,
    getVectorChatsState: getVectorChatsEnabled,
    setVectorChatsState: setVectorChatsEnabled,
    getVectorFilesState: getVectorFilesEnabled,
    setVectorFilesState: setVectorFilesEnabled,
    getVectorQueryMessages,
    setVectorQueryMessages,
    getVectorScoreThreshold,
    setVectorScoreThreshold,
    getVectorMaxEntries,
    setVectorMaxEntries,
  };
}
