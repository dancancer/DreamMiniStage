"use server";

/**
 * @input  lib/data/roleplay/world-book-operation, lib/models/world-book-model
 * @output getDialogueWorldBook, saveDialogueWorldBookEntry, updateDialogueWorldBookEntry, deleteDialogueWorldBookEntry, getDialogueWorldBookEntries, deleteDialogueWorldBook, bulkToggleDialogueWorldBookEntries
 * @pos    会话级世界书 - 会话级世界书的 CRUD 操作
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   会话级世界书 API                                           ║
 * ║                                                                            ║
 * ║  提供会话级世界书的 CRUD 操作                                                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";
import type { WorldBookEntry } from "@/lib/models/world-book-model";

/* ═══════════════════════════════════════════════════════════════════════════
   公共 API
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 获取会话级世界书
 *
 * @param dialogueKey - 对话键
 * @returns 世界书条目集合
 */
export async function getDialogueWorldBook(
  dialogueKey: string,
): Promise<Record<string, WorldBookEntry> | null> {
  try {
    const key = `dialogue:${dialogueKey}`;
    return await WorldBookOperations.getWorldBook(key);
  } catch (error) {
    console.error("[DialogueWB] Failed to get dialogue world book:", error);
    return null;
  }
}

/**
 * 保存会话级世界书条目
 *
 * @param dialogueKey - 对话键
 * @param entry - 世界书条目
 * @returns 成功时返回条目 ID，失败时返回 null
 */
export async function saveDialogueWorldBookEntry(
  dialogueKey: string,
  entry: WorldBookEntry,
): Promise<{ success: boolean; entryId?: string; error?: string }> {
  try {
    const key = `dialogue:${dialogueKey}`;

    // 添加会话级标记
    const enhancedEntry: WorldBookEntry = {
      ...entry,
      extensions: {
        ...entry.extensions,
        dialogueKey,
        createdAt: Date.now(),
      },
    };

    const entryId = await WorldBookOperations.addWorldBookEntry(key, enhancedEntry);

    if (!entryId) {
      return { success: false, error: "保存失败" };
    }

    return { success: true, entryId };
  } catch (error) {
    console.error("[DialogueWB] Failed to save entry:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "保存失败",
    };
  }
}

/**
 * 更新会话级世界书条目
 *
 * @param dialogueKey - 对话键
 * @param entryId - 条目 ID
 * @param updates - 更新内容
 * @returns 是否成功
 */
export async function updateDialogueWorldBookEntry(
  dialogueKey: string,
  entryId: string,
  updates: Partial<WorldBookEntry>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const key = `dialogue:${dialogueKey}`;

    const success = await WorldBookOperations.updateWorldBookEntry(key, entryId, updates);

    if (!success) {
      return { success: false, error: "更新失败或条目不存在" };
    }

    return { success: true };
  } catch (error) {
    console.error("[DialogueWB] Failed to update entry:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新失败",
    };
  }
}

/**
 * 删除会话级世界书条目
 *
 * @param dialogueKey - 对话键
 * @param entryId - 条目 ID
 * @returns 是否成功
 */
export async function deleteDialogueWorldBookEntry(
  dialogueKey: string,
  entryId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const key = `dialogue:${dialogueKey}`;

    const success = await WorldBookOperations.deleteWorldBookEntry(key, entryId);

    if (!success) {
      return { success: false, error: "删除失败或条目不存在" };
    }

    return { success: true };
  } catch (error) {
    console.error("[DialogueWB] Failed to delete entry:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    };
  }
}

/**
 * 获取会话级世界书条目列表
 *
 * @param dialogueKey - 对话键
 * @returns 条目列表及统计信息
 */
export async function getDialogueWorldBookEntries(dialogueKey: string): Promise<{
  success: boolean;
  entries?: Array<WorldBookEntry & { entryId: string }>;
  totalCount?: number;
  enabledCount?: number;
  disabledCount?: number;
  error?: string;
}> {
  try {
    const key = `dialogue:${dialogueKey}`;
    const worldBook = await WorldBookOperations.getWorldBook(key);

    if (!worldBook) {
      return {
        success: true,
        entries: [],
        totalCount: 0,
        enabledCount: 0,
        disabledCount: 0,
      };
    }

    const entries = Object.entries(worldBook).map(([entryId, entry]) => ({
      ...entry,
      entryId,
    }));

    const enabledCount = entries.filter((e) => e.enabled !== false).length;
    const disabledCount = entries.length - enabledCount;

    return {
      success: true,
      entries,
      totalCount: entries.length,
      enabledCount,
      disabledCount,
    };
  } catch (error) {
    console.error("[DialogueWB] Failed to get entries:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取失败",
    };
  }
}

/**
 * 删除整个会话级世界书
 *
 * @param dialogueKey - 对话键
 * @returns 是否成功
 */
export async function deleteDialogueWorldBook(
  dialogueKey: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const key = `dialogue:${dialogueKey}`;

    const success = await WorldBookOperations.deleteWorldBook(key);

    if (!success) {
      return { success: false, error: "删除失败或世界书不存在" };
    }

    return { success: true };
  } catch (error) {
    console.error("[DialogueWB] Failed to delete world book:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    };
  }
}

/**
 * 批量切换会话级世界书条目的启用状态
 *
 * @param dialogueKey - 对话键
 * @param entryIds - 条目 ID 列表
 * @param enabled - 是否启用
 * @returns 成功数量和失败数量
 */
export async function bulkToggleDialogueWorldBookEntries(
  dialogueKey: string,
  entryIds: string[],
  enabled: boolean,
): Promise<{ success: boolean; successCount: number; failureCount: number; error?: string }> {
  try {
    let successCount = 0;
    let failureCount = 0;

    for (const entryId of entryIds) {
      const result = await updateDialogueWorldBookEntry(dialogueKey, entryId, { enabled });
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    return {
      success: failureCount === 0,
      successCount,
      failureCount,
    };
  } catch (error) {
    console.error("[DialogueWB] Failed to bulk toggle entries:", error);
    return {
      success: false,
      successCount: 0,
      failureCount: entryIds.length,
      error: error instanceof Error ? error.message : "批量操作失败",
    };
  }
}
