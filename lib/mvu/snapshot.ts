/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 变量快照与恢复                                 ║
 * ║                                                                            ║
 * ║  实现楼层变量保存、恢复和对比功能                                            ║
 * ║  参考: MagVarUpdate 的变量快照机制                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { MvuData, StatData } from "./types";

// ============================================================================
//                              类型定义
// ============================================================================

/** 变量快照 */
export interface VariableSnapshot {
  /** 快照 ID */
  id: string;
  /** 消息 ID / 楼层号 */
  messageId: number;
  /** 快照时间戳 */
  timestamp: number;
  /** 变量数据副本 */
  data: StatData;
  /** 快照描述 */
  description?: string;
}

/** 快照对比结果 */
export interface SnapshotDiff {
  /** 新增的路径 */
  added: DiffEntry[];
  /** 删除的路径 */
  removed: DiffEntry[];
  /** 修改的路径 */
  modified: DiffEntry[];
}

/** 差异条目 */
export interface DiffEntry {
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/** 快照管理器配置 */
export interface SnapshotManagerConfig {
  /** 最大快照数量 */
  maxSnapshots?: number;
  /** 是否自动清理旧快照 */
  autoCleanup?: boolean;
  /** 保留最近 N 个楼层的快照 */
  retainRecentFloors?: number;
}

// ============================================================================
//                              工具函数
// ============================================================================

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function generateSnapshotId(): string {
  return `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getAllPaths(obj: unknown, prefix = ""): Map<string, unknown> {
  const paths = new Map<string, unknown>();

  if (obj === null || typeof obj !== "object") {
    if (prefix) paths.set(prefix, obj);
    return paths;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const itemPaths = getAllPaths(item, prefix ? `${prefix}[${index}]` : `[${index}]`);
      itemPaths.forEach((v, k) => paths.set(k, v));
    });
  } else {
    Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
      if (key === "$meta") return;
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === "object") {
        const subPaths = getAllPaths(value, newPrefix);
        subPaths.forEach((v, k) => paths.set(k, v));
      } else {
        paths.set(newPrefix, value);
      }
    });
  }

  return paths;
}

// ============================================================================
//                              快照管理器
// ============================================================================

/** 变量快照管理器 */
export class SnapshotManager {
  private snapshots: Map<string, VariableSnapshot> = new Map();
  private messageSnapshots: Map<number, string> = new Map();
  private config: Required<SnapshotManagerConfig>;

  constructor(config: SnapshotManagerConfig = {}) {
    this.config = {
      maxSnapshots: config.maxSnapshots ?? 50,
      autoCleanup: config.autoCleanup ?? true,
      retainRecentFloors: config.retainRecentFloors ?? 10,
    };
  }

  /**
   * 创建快照
   */
  createSnapshot(
    variables: MvuData,
    messageId: number,
    description?: string,
  ): VariableSnapshot {
    const snapshot: VariableSnapshot = {
      id: generateSnapshotId(),
      messageId,
      timestamp: Date.now(),
      data: deepClone(variables.stat_data),
      description,
    };

    this.snapshots.set(snapshot.id, snapshot);
    this.messageSnapshots.set(messageId, snapshot.id);

    if (this.config.autoCleanup) {
      this.cleanup();
    }

    return snapshot;
  }

  /**
   * 获取快照
   */
  getSnapshot(snapshotId: string): VariableSnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  /**
   * 获取指定消息的快照
   */
  getSnapshotByMessageId(messageId: number): VariableSnapshot | undefined {
    const snapshotId = this.messageSnapshots.get(messageId);
    return snapshotId ? this.snapshots.get(snapshotId) : undefined;
  }

  /**
   * 恢复到指定快照
   */
  restoreSnapshot(snapshotId: string, variables: MvuData): boolean {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return false;

    variables.stat_data = deepClone(snapshot.data);
    return true;
  }

  /**
   * 恢复到指定消息的快照
   */
  restoreToMessage(messageId: number, variables: MvuData): boolean {
    const snapshot = this.getSnapshotByMessageId(messageId);
    if (!snapshot) return false;

    variables.stat_data = deepClone(snapshot.data);
    return true;
  }

  /**
   * 对比两个快照
   */
  compareSnapshots(snapshotId1: string, snapshotId2: string): SnapshotDiff | null {
    const snap1 = this.snapshots.get(snapshotId1);
    const snap2 = this.snapshots.get(snapshotId2);

    if (!snap1 || !snap2) return null;

    return this.diffData(snap1.data, snap2.data);
  }

  /**
   * 对比当前变量与快照
   */
  compareWithCurrent(snapshotId: string, currentVariables: MvuData): SnapshotDiff | null {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return null;

    return this.diffData(snapshot.data, currentVariables.stat_data);
  }

  /**
   * 对比两个数据对象
   */
  diffData(oldData: StatData, newData: StatData): SnapshotDiff {
    const oldPaths = getAllPaths(oldData);
    const newPaths = getAllPaths(newData);

    const diff: SnapshotDiff = {
      added: [],
      removed: [],
      modified: [],
    };

    newPaths.forEach((newValue, path) => {
      if (!oldPaths.has(path)) {
        diff.added.push({ path, newValue });
      } else {
        const oldValue = oldPaths.get(path);
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          diff.modified.push({ path, oldValue, newValue });
        }
      }
    });

    oldPaths.forEach((oldValue, path) => {
      if (!newPaths.has(path)) {
        diff.removed.push({ path, oldValue });
      }
    });

    return diff;
  }

  /**
   * 删除快照
   */
  deleteSnapshot(snapshotId: string): boolean {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return false;

    this.messageSnapshots.delete(snapshot.messageId);
    this.snapshots.delete(snapshotId);
    return true;
  }

  /**
   * 删除指定消息之后的所有快照
   */
  deleteSnapshotsAfter(messageId: number): number {
    let deleted = 0;
    const toDelete: string[] = [];

    this.snapshots.forEach((snapshot, id) => {
      if (snapshot.messageId > messageId) {
        toDelete.push(id);
      }
    });

    toDelete.forEach((id) => {
      this.deleteSnapshot(id);
      deleted++;
    });

    return deleted;
  }

  /**
   * 清理旧快照
   */
  cleanup(): number {
    let deleted = 0;

    if (this.snapshots.size <= this.config.maxSnapshots) {
      return 0;
    }

    const sortedSnapshots = Array.from(this.snapshots.values())
      .sort((a, b) => b.messageId - a.messageId);

    const maxMessageId = sortedSnapshots[0]?.messageId ?? 0;
    const minRetainMessageId = maxMessageId - this.config.retainRecentFloors;

    for (const snapshot of sortedSnapshots) {
      if (this.snapshots.size <= this.config.maxSnapshots) break;

      if (snapshot.messageId < minRetainMessageId) {
        this.deleteSnapshot(snapshot.id);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * 获取所有快照
   */
  getAllSnapshots(): VariableSnapshot[] {
    return Array.from(this.snapshots.values())
      .sort((a, b) => a.messageId - b.messageId);
  }

  /**
   * 获取快照数量
   */
  getSnapshotCount(): number {
    return this.snapshots.size;
  }

  /**
   * 清空所有快照
   */
  clear(): void {
    this.snapshots.clear();
    this.messageSnapshots.clear();
  }

  /**
   * 导出快照数据
   */
  exportSnapshots(): VariableSnapshot[] {
    return this.getAllSnapshots();
  }

  /**
   * 导入快照数据
   */
  importSnapshots(snapshots: VariableSnapshot[]): void {
    for (const snapshot of snapshots) {
      this.snapshots.set(snapshot.id, snapshot);
      this.messageSnapshots.set(snapshot.messageId, snapshot.id);
    }
  }
}

// ============================================================================
//                              便捷函数
// ============================================================================

/** 创建快照管理器 */
export function createSnapshotManager(config?: SnapshotManagerConfig): SnapshotManager {
  return new SnapshotManager(config);
}

/** 快速创建快照 */
export function quickSnapshot(
  variables: MvuData,
  messageId: number,
): VariableSnapshot {
  return {
    id: generateSnapshotId(),
    messageId,
    timestamp: Date.now(),
    data: deepClone(variables.stat_data),
  };
}

/** 快速对比两个变量状态 */
export function quickDiff(oldData: StatData, newData: StatData): SnapshotDiff {
  const manager = new SnapshotManager();
  return manager.diffData(oldData, newData);
}

/** 检查是否有变化 */
export function hasChanges(diff: SnapshotDiff): boolean {
  return diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0;
}

/** 格式化差异为可读字符串 */
export function formatDiff(diff: SnapshotDiff): string {
  const lines: string[] = [];

  if (diff.added.length > 0) {
    lines.push("新增:");
    diff.added.forEach((e) => lines.push(`  + ${e.path}: ${JSON.stringify(e.newValue)}`));
  }

  if (diff.removed.length > 0) {
    lines.push("删除:");
    diff.removed.forEach((e) => lines.push(`  - ${e.path}: ${JSON.stringify(e.oldValue)}`));
  }

  if (diff.modified.length > 0) {
    lines.push("修改:");
    diff.modified.forEach((e) =>
      lines.push(`  ~ ${e.path}: ${JSON.stringify(e.oldValue)} → ${JSON.stringify(e.newValue)}`),
    );
  }

  return lines.length > 0 ? lines.join("\n") : "无变化";
}
