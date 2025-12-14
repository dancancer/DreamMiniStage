/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 自动清理机制                                   ║
 * ║                                                                            ║
 * ║  自动清理旧楼层变量，防止内存泄漏                                            ║
 * ║  参考: MagVarUpdate 的变量清理策略                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { MvuData, StatData } from "./types";

// ============================================================================
//                              类型定义
// ============================================================================

/** 清理策略配置 */
export interface CleanupConfig {
  /** 是否启用自动清理 */
  enabled: boolean;
  /** 保留最近 N 个楼层的变量 */
  retainFloors: number;
  /** 清理间隔（消息数） */
  cleanupInterval: number;
  /** 是否保留标记为持久的变量 */
  preservePersistent: boolean;
  /** 持久变量路径前缀 */
  persistentPrefixes: string[];
}

/** 清理结果 */
export interface CleanupResult {
  /** 清理的变量数量 */
  cleanedCount: number;
  /** 清理的路径列表 */
  cleanedPaths: string[];
  /** 保留的变量数量 */
  retainedCount: number;
}

/** 楼层变量记录 */
export interface FloorVariableRecord {
  messageId: number;
  paths: Set<string>;
  timestamp: number;
}

// ============================================================================
//                              默认配置
// ============================================================================

export const DEFAULT_CLEANUP_CONFIG: CleanupConfig = {
  enabled: true,
  retainFloors: 10,
  cleanupInterval: 5,
  preservePersistent: true,
  persistentPrefixes: ["global.", "persistent.", "save."],
};

// ============================================================================
//                              清理管理器
// ============================================================================

/** 自动清理管理器 */
export class AutoCleanupManager {
  private config: CleanupConfig;
  private floorRecords: Map<number, FloorVariableRecord> = new Map();
  private messageCounter = 0;
  private lastCleanupMessageId = 0;

  constructor(config: Partial<CleanupConfig> = {}) {
    this.config = { ...DEFAULT_CLEANUP_CONFIG, ...config };
  }

  /** 更新配置 */
  updateConfig(config: Partial<CleanupConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** 获取当前配置 */
  getConfig(): CleanupConfig {
    return { ...this.config };
  }

  /**
   * 记录楼层变量变化
   */
  recordFloorChange(messageId: number, changedPaths: string[]): void {
    let record = this.floorRecords.get(messageId);

    if (!record) {
      record = {
        messageId,
        paths: new Set(),
        timestamp: Date.now(),
      };
      this.floorRecords.set(messageId, record);
    }

    for (const path of changedPaths) {
      record.paths.add(path);
    }

    this.messageCounter++;
  }

  /**
   * 检查是否需要清理
   */
  shouldCleanup(): boolean {
    if (!this.config.enabled) return false;
    return this.messageCounter - this.lastCleanupMessageId >= this.config.cleanupInterval;
  }

  /**
   * 执行清理
   */
  cleanup(variables: MvuData, currentMessageId: number): CleanupResult {
    if (!this.config.enabled) {
      return { cleanedCount: 0, cleanedPaths: [], retainedCount: 0 };
    }

    const minRetainMessageId = currentMessageId - this.config.retainFloors;
    const cleanedPaths: string[] = [];
    let retainedCount = 0;

    const pathsToClean = new Set<string>();

    for (const [messageId, record] of this.floorRecords.entries()) {
      if (messageId < minRetainMessageId) {
        for (const path of record.paths) {
          if (!this.shouldPreservePath(path)) {
            pathsToClean.add(path);
          } else {
            retainedCount++;
          }
        }
        this.floorRecords.delete(messageId);
      }
    }

    for (const path of pathsToClean) {
      if (this.isFloorSpecificPath(path)) {
        this.deleteByPath(variables.stat_data, path);
        cleanedPaths.push(path);
      }
    }

    this.lastCleanupMessageId = this.messageCounter;

    return {
      cleanedCount: cleanedPaths.length,
      cleanedPaths,
      retainedCount,
    };
  }

  /**
   * 检查路径是否应该保留
   */
  private shouldPreservePath(path: string): boolean {
    if (!this.config.preservePersistent) return false;

    for (const prefix of this.config.persistentPrefixes) {
      if (path.startsWith(prefix)) return true;
    }

    return false;
  }

  /**
   * 检查是否是楼层特定的路径
   */
  private isFloorSpecificPath(path: string): boolean {
    return /\[\d+\]/.test(path) || /floor_\d+/.test(path);
  }

  /**
   * 通过路径删除变量
   */
  private deleteByPath(data: StatData, path: string): boolean {
    const segments = path.split(/[.[\]]+/).filter(Boolean);
    if (segments.length === 0) return false;

    let current: unknown = data;
    for (let i = 0; i < segments.length - 1; i++) {
      if (current == null) return false;
      current = (current as Record<string, unknown>)[segments[i]];
    }

    if (current == null) return false;

    const lastKey = segments[segments.length - 1];
    if (Array.isArray(current)) {
      const index = parseInt(lastKey, 10);
      if (!isNaN(index) && index >= 0 && index < current.length) {
        current.splice(index, 1);
        return true;
      }
    } else if (typeof current === "object") {
      if (lastKey in (current as Record<string, unknown>)) {
        delete (current as Record<string, unknown>)[lastKey];
        return true;
      }
    }

    return false;
  }

  /**
   * 删除指定消息之后的所有记录
   */
  deleteRecordsAfter(messageId: number): number {
    let deleted = 0;
    for (const [id] of this.floorRecords) {
      if (id > messageId) {
        this.floorRecords.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalFloors: number;
    totalPaths: number;
    messageCounter: number;
    } {
    let totalPaths = 0;
    for (const record of this.floorRecords.values()) {
      totalPaths += record.paths.size;
    }

    return {
      totalFloors: this.floorRecords.size,
      totalPaths,
      messageCounter: this.messageCounter,
    };
  }

  /**
   * 重置管理器
   */
  reset(): void {
    this.floorRecords.clear();
    this.messageCounter = 0;
    this.lastCleanupMessageId = 0;
  }
}

// ============================================================================
//                              便捷函数
// ============================================================================

/** 创建清理管理器 */
export function createCleanupManager(config?: Partial<CleanupConfig>): AutoCleanupManager {
  return new AutoCleanupManager(config);
}

/** 清理旧楼层变量 (一次性操作) */
export function cleanupOldFloors(
  variables: MvuData,
  currentMessageId: number,
  retainFloors: number,
): CleanupResult {
  const cleanedPaths: string[] = [];

  const floorPattern = /floor_(\d+)/;
  const indexPattern = /\[(\d+)\]/;

  const cleanObject = (obj: unknown, path: string): void => {
    if (Array.isArray(obj)) {
      for (let i = obj.length - 1; i >= 0; i--) {
        const itemPath = `${path}[${i}]`;
        const match = itemPath.match(indexPattern);
        if (match) {
          const index = parseInt(match[1], 10);
          if (index < currentMessageId - retainFloors) {
            obj.splice(i, 1);
            cleanedPaths.push(itemPath);
          }
        }
        cleanObject(obj[i], itemPath);
      }
    } else if (typeof obj === "object" && obj !== null) {
      for (const key of Object.keys(obj as Record<string, unknown>)) {
        if (key === "$meta") continue;

        const keyPath = path ? `${path}.${key}` : key;
        const match = key.match(floorPattern);

        if (match) {
          const floorId = parseInt(match[1], 10);
          if (floorId < currentMessageId - retainFloors) {
            delete (obj as Record<string, unknown>)[key];
            cleanedPaths.push(keyPath);
            continue;
          }
        }

        cleanObject((obj as Record<string, unknown>)[key], keyPath);
      }
    }
  };

  cleanObject(variables.stat_data, "");

  return {
    cleanedCount: cleanedPaths.length,
    cleanedPaths,
    retainedCount: 0,
  };
}

/** 检查变量是否过期 */
export function isVariableExpired(
  path: string,
  currentMessageId: number,
  retainFloors: number,
): boolean {
  const floorMatch = path.match(/floor_(\d+)/);
  if (floorMatch) {
    const floorId = parseInt(floorMatch[1], 10);
    return floorId < currentMessageId - retainFloors;
  }

  const indexMatch = path.match(/\[(\d+)\]/);
  if (indexMatch) {
    const index = parseInt(indexMatch[1], 10);
    return index < currentMessageId - retainFloors;
  }

  return false;
}
