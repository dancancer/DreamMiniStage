/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Lorebook 兼容层 Handlers                           ║
 * ║                                                                            ║
 * ║  旧版 API 兼容，内部映射到 worldbook 操作                                    ║
 * ║  Requirements: 5.1, 5.2, 5.3, 5.4, 5.5                                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";
import type { WorldBookEntry } from "@/lib/models/world-book-model";
import type { ApiHandlerMap } from "./types";

// ============================================================================
//                              Handler 实现
// ============================================================================

/**
 * 获取指定 lorebook 的所有条目
 * Requirements: 5.2
 */
async function getEntries(args: unknown[]) {
  const [lorebook] = args as [string];
  if (!lorebook) return [];
  const wb = await WorldBookOperations.getWorldBook(lorebook);
  if (!wb) return [];
  // 返回带 id 的条目数组，便于后续操作
  return Object.entries(wb).map(([id, entry]) => ({ ...entry, id }));
}

/**
 * 替换整个 lorebook 的条目
 * Requirements: 5.2 (辅助)
 */
async function replaceEntries(args: unknown[]) {
  const [lorebook, entries] = args as [string, WorldBookEntry[]];
  if (!lorebook) return false;
  return WorldBookOperations.updateWorldBook(lorebook, entries || []);
}

/**
 * 批量创建条目
 * Requirements: 5.3
 */
async function setEntries(args: unknown[]) {
  const [lorebook, entries] = args as [string, WorldBookEntry[]];
  if (!lorebook || !Array.isArray(entries)) return [];
  const current = (await WorldBookOperations.getWorldBook(lorebook)) || {};
  const createdIds: string[] = [];
  for (const entry of entries) {
    const entryId = `entry_${Object.keys(current).length + createdIds.length}`;
    current[entryId] = entry;
    createdIds.push(entryId);
  }
  await WorldBookOperations.updateWorldBook(lorebook, current);
  return createdIds;
}

/**
 * 创建单个条目
 * Requirements: 5.3
 */
async function createEntry(args: unknown[]) {
  const [lorebook, entry] = args as [string, WorldBookEntry];
  if (!lorebook || !entry) return null;
  return WorldBookOperations.addWorldBookEntry(lorebook, entry);
}

/**
 * 批量删除条目
 * Requirements: 5.4
 */
async function deleteEntries(args: unknown[]) {
  const [lorebook, entryIds] = args as [string, string[]];
  if (!lorebook || !Array.isArray(entryIds)) return false;
  const current = (await WorldBookOperations.getWorldBook(lorebook)) || {};
  entryIds.forEach((id) => delete current[id]);
  return WorldBookOperations.updateWorldBook(lorebook, current);
}

/**
 * 删除单个条目
 * Requirements: 5.4
 */
async function deleteEntry(args: unknown[]) {
  const [lorebook, entryId] = args as [string, string];
  if (!lorebook || !entryId) return false;
  return WorldBookOperations.deleteWorldBookEntry(lorebook, entryId);
}

/**
 * 获取 lorebook 设置
 * Requirements: 5.1 (辅助)
 */
async function getSettings(args: unknown[]) {
  const [lorebook] = args as [string];
  if (!lorebook) return null;
  return WorldBookOperations.getWorldBookSettings(lorebook);
}

/**
 * 部分更新匹配的条目
 * Requirements: 5.5
 * 
 * updates 格式：{ entryId: { field: newValue, ... }, ... }
 * 只更新指定字段，保留其他字段不变
 */
async function updateEntriesWith(args: unknown[]) {
  const [lorebook, updates] = args as [string, Record<string, Partial<WorldBookEntry>>];
  if (!lorebook || !updates || typeof updates !== "object") return false;
  
  const current = await WorldBookOperations.getWorldBook(lorebook);
  if (!current) return false;
  
  // 遍历 updates，合并到对应条目
  for (const [entryId, partialUpdate] of Object.entries(updates)) {
    if (current[entryId] && partialUpdate) {
      current[entryId] = { ...current[entryId], ...partialUpdate };
    }
  }
  
  return WorldBookOperations.updateWorldBook(lorebook, current);
}

/**
 * 更新单个条目
 * Requirements: 5.5
 */
async function updateEntry(args: unknown[]) {
  const [lorebook, entryId, updates] = args as [string, string, Partial<WorldBookEntry>];
  if (!lorebook || !entryId) return false;
  return WorldBookOperations.updateWorldBookEntry(lorebook, entryId, updates || {});
}

/**
 * 获取所有 worldbook 名称
 * Requirements: 5.1
 */
async function getNames() {
  const worldBooks = await WorldBookOperations.getWorldBooks();
  return Object.keys(worldBooks).filter((key) => !key.endsWith("_settings"));
}

// ============================================================================
//                              导出 Handler Map
// ============================================================================

export const lorebookHandlers: ApiHandlerMap = {
  // 名称列表 (Req 5.1)
  "lorebook.getNames": getNames,
  "getLorebookNames": getNames,
  
  // 条目查询 (Req 5.2)
  "lorebook.getEntries": getEntries,
  "getLorebookEntries": getEntries,
  
  // 条目创建 (Req 5.3)
  "lorebook.setEntries": setEntries,
  "lorebook.createEntries": setEntries,
  "lorebook.createEntry": createEntry,
  "createLorebookEntry": createEntry,
  
  // 条目删除 (Req 5.4)
  "lorebook.deleteEntries": deleteEntries,
  "lorebook.deleteEntry": deleteEntry,
  "deleteLorebookEntry": deleteEntry,
  
  // 条目更新 (Req 5.5)
  "lorebook.updateEntriesWith": updateEntriesWith,
  "lorebook.updateEntry": updateEntry,
  "updateLorebookEntriesWith": updateEntriesWith,
  
  // 辅助方法
  "lorebook.replaceEntries": replaceEntries,
  "lorebook.getSettings": getSettings,
};
