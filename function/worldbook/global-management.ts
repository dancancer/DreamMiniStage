"use server";

/**
 * @input  lib/data/roleplay/world-book-operation, lib/models/world-book-model
 * @output GlobalWorldBookMetadata, listGlobalWorldBooks, createGlobalWorldBook, deleteGlobalWorldBook, toggleGlobalWorldBook, copyCharacterToGlobal, updateGlobalWorldBookMetadata, getGlobalWorldBookDetail
 * @pos    全局世界书管理 - 全局世界书的 CRUD 操作和启用/禁用管理
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   全局世界书管理 API                                         ║
 * ║                                                                            ║
 * ║  提供全局世界书的 CRUD 操作和启用/禁用管理                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";
import type { WorldBookEntry } from "@/lib/models/world-book-model";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

export interface GlobalWorldBookMetadata {
  id: string; // "global:{uuid}"
  name: string; // 显示名称
  description?: string; // 描述
  enabled: boolean; // 是否启用
  createdAt: number;
  updatedAt: number;
  entryCount: number;
  tags?: string[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   公共 API
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 列出所有全局世界书（带元数据）
 *
 * @returns 全局世界书元数据列表（按更新时间倒序）
 */
export async function listGlobalWorldBooks(): Promise<GlobalWorldBookMetadata[]> {
  try {
    const globalKeys = await WorldBookOperations.getWorldBookKeysByPrefix("global:");
    const books: GlobalWorldBookMetadata[] = [];

    for (const key of globalKeys) {
      const settings = await WorldBookOperations.getWorldBookSettings(key);

      if (settings.metadata) {
        books.push(settings.metadata as GlobalWorldBookMetadata);
      } else {
        console.warn(`[GlobalWB] Skip malformed global world book (missing metadata): ${key}`);
      }
    }

    return books.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error("[GlobalWB] Failed to list global world books:", error);
    return [];
  }
}

/**
 * 创建新的全局世界书
 *
 * @param name - 世界书名称
 * @param description - 描述（可选）
 * @returns 成功状态和生成的全局键
 */
export async function createGlobalWorldBook(
  name: string,
  description?: string,
): Promise<{ success: boolean; globalKey: string; error?: string }> {
  try {
    if (!name || name.trim().length === 0) {
      return { success: false, globalKey: "", error: "名称不能为空" };
    }

    // 生成唯一键：global:{timestamp}_{random}
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const globalKey = `global:${timestamp}_${random}`;

    // 创建空的世界书条目集合
    await WorldBookOperations.updateWorldBook(globalKey, {});

    // 保存元数据
    await WorldBookOperations.updateWorldBookSettings(globalKey, {
      enabled: true,
      maxEntries: 100,
      contextWindow: 5,
      metadata: {
        id: globalKey,
        name: name.trim(),
        description: description?.trim(),
        enabled: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        entryCount: 0,
      } as GlobalWorldBookMetadata,
    });

    return { success: true, globalKey };
  } catch (error) {
    console.error("[GlobalWB] Failed to create global world book:", error);
    return {
      success: false,
      globalKey: "",
      error: error instanceof Error ? error.message : "创建失败",
    };
  }
}

/**
 * 删除全局世界书
 *
 * @param globalKey - 全局世界书键
 * @returns 是否成功删除
 */
export async function deleteGlobalWorldBook(
  globalKey: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!globalKey.startsWith("global:")) {
      return { success: false, error: "无效的全局世界书键" };
    }

    const success = await WorldBookOperations.deleteWorldBook(globalKey);

    if (!success) {
      return { success: false, error: "世界书不存在或删除失败" };
    }

    return { success: true };
  } catch (error) {
    console.error("[GlobalWB] Failed to delete global world book:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    };
  }
}

/**
 * 启用/禁用全局世界书
 *
 * @param globalKey - 全局世界书键
 * @param enabled - 是否启用
 * @returns 是否成功
 */
export async function toggleGlobalWorldBook(
  globalKey: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!globalKey.startsWith("global:")) {
      return { success: false, error: "无效的全局世界书键" };
    }

    const settings = await WorldBookOperations.getWorldBookSettings(globalKey);
    if (!settings.metadata) {
      return { success: false, error: "元数据不存在" };
    }

    const updatedMetadata = { ...settings.metadata, enabled, updatedAt: Date.now() };

    await WorldBookOperations.updateWorldBookSettings(globalKey, {
      enabled,
      metadata: updatedMetadata,
    });

    return { success: true };
  } catch (error) {
    console.error("[GlobalWB] Failed to toggle global world book:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "操作失败",
    };
  }
}

/**
 * 从角色世界书复制到全局
 *
 * @param characterId - 角色 ID
 * @param globalName - 新的全局世界书名称
 * @param description - 描述（可选）
 * @returns 成功状态和生成的全局键
 */
export async function copyCharacterToGlobal(
  characterId: string,
  globalName: string,
  description?: string,
): Promise<{ success: boolean; globalKey: string; error?: string }> {
  try {
    // 读取角色世界书
    const charKey = `character:${characterId}`;
    const charWorldBook = await WorldBookOperations.getWorldBook(charKey);

    if (!charWorldBook || Object.keys(charWorldBook).length === 0) {
      return {
        success: false,
        globalKey: "",
        error: "角色世界书为空或不存在",
      };
    }

    // 创建新的全局世界书
    const createResult = await createGlobalWorldBook(globalName, description);

    if (!createResult.success) {
      return createResult;
    }

    // 复制条目
    await WorldBookOperations.updateWorldBook(createResult.globalKey, charWorldBook);

    // 更新条目数量
    const entryCount = Object.keys(charWorldBook).length;
    const settings = await WorldBookOperations.getWorldBookSettings(createResult.globalKey);

    if (settings.metadata) {
      await WorldBookOperations.updateWorldBookSettings(createResult.globalKey, {
        metadata: {
          ...settings.metadata,
          entryCount,
          updatedAt: Date.now(),
        },
      });
    }

    return { success: true, globalKey: createResult.globalKey };
  } catch (error) {
    console.error("[GlobalWB] Failed to copy character to global:", error);
    return {
      success: false,
      globalKey: "",
      error: error instanceof Error ? error.message : "复制失败",
    };
  }
}

/**
 * 更新全局世界书元数据
 *
 * @param globalKey - 全局世界书键
 * @param updates - 元数据更新
 * @returns 是否成功
 */
export async function updateGlobalWorldBookMetadata(
  globalKey: string,
  updates: Partial<Omit<GlobalWorldBookMetadata, "id" | "createdAt">>,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!globalKey.startsWith("global:")) {
      return { success: false, error: "无效的全局世界书键" };
    }

    const settings = await WorldBookOperations.getWorldBookSettings(globalKey);

    if (!settings.metadata) {
      return { success: false, error: "元数据不存在" };
    }

    const updatedMetadata = {
      ...settings.metadata,
      ...updates,
      updatedAt: Date.now(),
    };

    await WorldBookOperations.updateWorldBookSettings(globalKey, {
      metadata: updatedMetadata,
    });

    return { success: true };
  } catch (error) {
    console.error("[GlobalWB] Failed to update metadata:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新失败",
    };
  }
}

/**
 * 获取全局世界书详情
 *
 * @param globalKey - 全局世界书键
 * @returns 元数据和条目
 */
export async function getGlobalWorldBookDetail(globalKey: string): Promise<{
  success: boolean;
  metadata?: GlobalWorldBookMetadata;
  entries?: Record<string, WorldBookEntry>;
  error?: string;
}> {
  try {
    if (!globalKey.startsWith("global:")) {
      return { success: false, error: "无效的全局世界书键" };
    }

    const settings = await WorldBookOperations.getWorldBookSettings(globalKey);
    const worldBook = await WorldBookOperations.getWorldBook(globalKey);

    if (!worldBook) {
      return { success: false, error: "世界书不存在" };
    }
    if (!settings.metadata) {
      return { success: false, error: "元数据不存在" };
    }

    return {
      success: true,
      metadata: settings.metadata as GlobalWorldBookMetadata,
      entries: worldBook,
    };
  } catch (error) {
    console.error("[GlobalWB] Failed to get detail:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取失败",
    };
  }
}
