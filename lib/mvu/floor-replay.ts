/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 楼层重演系统 (FSM)                              ║
 * ║                                                                            ║
 * ║  从指定楼层重新计算所有变量变更                                               ║
 * ║  设计原则：幂等执行，可重现状态                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { MvuData, StatData } from "./types";
import { updateVariablesFromMessage } from "./core/executor";
import { reconcileSchema, cleanupMeta } from "./core/schema";
import { updateDescriptions, createEmptyMvuData, loadInitVarFromWorldBooks } from "./variable-init";
import type { WorldBookEntry } from "./variable-init";

// ============================================================================
//                              类型定义
// ============================================================================

/** 消息数据结构 */
export interface FloorMessage {
  id: string | number;
  content: string;
  role?: "user" | "assistant" | "system";
  variables?: MvuData;
}

/** 重演配置 */
export interface ReplayConfig {
  /** 起始楼层 ID（从这个楼层的变量开始） */
  startFloorId: string | number;
  /** 结束楼层 ID（重演到这个楼层） */
  endFloorId: string | number;
  /** 进度回调 */
  onProgress?: (current: number, total: number) => void;
  /** 每次重演后的回调 */
  onFloorReplayed?: (floorId: string | number, variables: MvuData) => void;
}

/** 重演结果 */
export interface ReplayResult {
  success: boolean;
  /** 最终变量状态 */
  variables: MvuData;
  /** 重演的楼层数 */
  replayedCount: number;
  /** 错误信息 */
  errors: string[];
}

/** 楼层管理操作类型 */
export type FloorOperation =
  | "reprocess"      // 重新处理当前楼层变量
  | "reload_init"    // 重新读取初始变量
  | "snapshot"       // 标记为快照楼层
  | "replay"         // 重演到指定楼层
  | "cleanup";       // 清理旧楼层变量

/** 楼层管理配置 */
export interface FloorManagerConfig {
  /** 快照保留间隔（每 N 层保留一个快照） */
  snapshotInterval: number;
  /** 保留最近 N 层的变量 */
  retainFloors: number;
  /** 获取消息内容的函数 */
  getFloorContent: (floorId: string | number) => Promise<string | null>;
  /** 获取楼层变量的函数 */
  getFloorVariables: (floorId: string | number) => Promise<MvuData | null>;
  /** 保存楼层变量的函数 */
  saveFloorVariables: (floorId: string | number, variables: MvuData) => Promise<void>;
  /** 获取楼层元数据（是否为快照等） */
  getFloorMeta?: (floorId: string | number) => Promise<{ snapshot?: boolean } | null>;
  /** 设置楼层元数据 */
  setFloorMeta?: (floorId: string | number, meta: { snapshot?: boolean }) => Promise<void>;
}

// ============================================================================
//                              楼层重演
// ============================================================================

/**
 * 从指定楼层重演变量变更
 *
 * FSM（有限状态机）理念：
 * - 所有变量更新必须幂等且可重现
 * - 从已知状态出发，按序执行所有消息的变量更新
 * - 最终状态只取决于初始状态和消息序列
 */
export async function replayFloors(
  messages: FloorMessage[],
  initialVariables: MvuData,
  config: ReplayConfig,
): Promise<ReplayResult> {
  const errors: string[] = [];
  let currentVariables = deepClone(initialVariables);
  let replayedCount = 0;

  // 找到起始和结束位置
  const startIndex = messages.findIndex((m) => m.id === config.startFloorId);
  const endIndex = messages.findIndex((m) => m.id === config.endFloorId);

  if (startIndex === -1) {
    return {
      success: false,
      variables: currentVariables,
      replayedCount: 0,
      errors: [`找不到起始楼层: ${config.startFloorId}`],
    };
  }

  if (endIndex === -1) {
    return {
      success: false,
      variables: currentVariables,
      replayedCount: 0,
      errors: [`找不到结束楼层: ${config.endFloorId}`],
    };
  }

  if (endIndex < startIndex) {
    return {
      success: false,
      variables: currentVariables,
      replayedCount: 0,
      errors: ["结束楼层不能在起始楼层之前"],
    };
  }

  const total = endIndex - startIndex;

  // 从 startIndex + 1 开始重演（startIndex 的变量作为初始状态）
  for (let i = startIndex + 1; i <= endIndex; i++) {
    const message = messages[i];
    const current = i - startIndex;

    try {
      // 执行变量更新
      const result = updateVariablesFromMessage(message.content, currentVariables);

      if (result.modified) {
        currentVariables = result.variables;
      }

      replayedCount++;

      // 进度回调
      config.onProgress?.(current, total);
      config.onFloorReplayed?.(message.id, currentVariables);
    } catch (error) {
      const errorMsg = `重演楼层 ${message.id} 失败: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  // 调和 Schema
  reconcileSchema(currentVariables);

  return {
    success: errors.length === 0,
    variables: currentVariables,
    replayedCount,
    errors,
  };
}

/**
 * 查找最近的有效快照楼层
 * 有效快照楼层需要包含完整的 stat_data 和 schema
 */
export function findLastValidSnapshot(
  messages: FloorMessage[],
  beforeIndex: number,
): number {
  for (let i = beforeIndex; i >= 0; i--) {
    const vars = messages[i].variables;
    if (vars && vars.stat_data && Object.keys(vars.stat_data).length > 0) {
      if (vars.schema && Object.keys(vars.schema).length > 0) {
        return i;
      }
    }
  }
  return -1;
}

// ============================================================================
//                              楼层管理器
// ============================================================================

export class FloorManager {
  private config: FloorManagerConfig;

  constructor(config: FloorManagerConfig) {
    this.config = config;
  }

  /**
   * 重新处理指定楼层的变量
   */
  async reprocessFloor(floorId: string | number): Promise<MvuData | null> {
    // 获取上一层的变量作为基础
    const content = await this.config.getFloorContent(floorId);
    if (!content) return null;

    // 获取当前楼层的变量（用于找到上一层）
    const currentVars = await this.config.getFloorVariables(floorId);
    if (!currentVars) return null;

    // 清空当前层的计算结果
    const baseVariables: MvuData = {
      stat_data: {},
      display_data: {},
      delta_data: {},
      initialized_lorebooks: currentVars.initialized_lorebooks,
      schema: currentVars.schema,
    };

    // 重新执行变量更新
    const result = updateVariablesFromMessage(content, baseVariables);

    // 保存结果
    await this.config.saveFloorVariables(floorId, result.variables);

    return result.variables;
  }

  /**
   * 重新读取初始变量并与当前变量合并
   */
  async reloadInitVariables(
    floorId: string | number,
    worldBooks: WorldBookEntry[][],
    worldBookNames: string[],
  ): Promise<MvuData | null> {
    // 加载最新的 InitVar 数据
    const freshInitData = createEmptyMvuData();
    loadInitVarFromWorldBooks(freshInitData, worldBooks, worldBookNames, {
      skipInitialized: false,
    });

    // 清理元数据
    cleanupMeta(freshInitData.stat_data);

    // 获取当前楼层变量
    const currentVars = await this.config.getFloorVariables(floorId);
    if (!currentVars) return null;

    // 合并：以初始数据为基础，当前值覆盖
    const mergedData: MvuData = {
      stat_data: deepMerge(freshInitData.stat_data, currentVars.stat_data),
      display_data: deepClone(currentVars.display_data || {}),
      delta_data: currentVars.delta_data,
      initialized_lorebooks: {
        ...freshInitData.initialized_lorebooks,
        ...currentVars.initialized_lorebooks,
      },
      schema: currentVars.schema,
    };

    // 更新描述（从初始变量同步描述到当前变量）
    updateDescriptions(mergedData.stat_data, freshInitData.stat_data);

    // 调和 Schema
    reconcileSchema(mergedData);
    cleanupMeta(mergedData.stat_data);

    // 保存
    await this.config.saveFloorVariables(floorId, mergedData);

    return mergedData;
  }

  /**
   * 标记楼层为快照
   */
  async markAsSnapshot(floorId: string | number): Promise<boolean> {
    if (!this.config.setFloorMeta) return false;
    await this.config.setFloorMeta(floorId, { snapshot: true });
    return true;
  }

  /**
   * 检查楼层是否为快照
   */
  async isSnapshot(floorId: string | number): Promise<boolean> {
    if (!this.config.getFloorMeta) return false;
    const meta = await this.config.getFloorMeta(floorId);
    return meta?.snapshot === true;
  }

  /**
   * 清理旧楼层变量
   * 保留最近 N 层，每 M 层保留一个快照
   */
  async cleanupOldFloors(
    floorIds: (string | number)[],
    options: { retainCount?: number; snapshotInterval?: number } = {},
  ): Promise<{ cleanedCount: number; snapshotCount: number }> {
    const retainCount = options.retainCount ?? this.config.retainFloors;
    const snapshotInterval = options.snapshotInterval ?? this.config.snapshotInterval;

    let cleanedCount = 0;
    let snapshotCount = 0;

    // 跳过第一层（初始层）和最后 N 层
    const startIndex = 1;
    const endIndex = Math.max(0, floorIds.length - retainCount - 1);

    for (let i = startIndex; i <= endIndex; i++) {
      const floorId = floorIds[i];

      // 检查是否为快照
      const isSnap = await this.isSnapshot(floorId);
      if (isSnap) {
        snapshotCount++;
        continue;
      }

      // 每 snapshotInterval 层保留一个快照
      if ((i + 1) % snapshotInterval === 0) {
        await this.markAsSnapshot(floorId);
        snapshotCount++;
        continue;
      }

      // 清理变量数据
      const vars = await this.config.getFloorVariables(floorId);
      if (vars) {
        const cleanedVars: MvuData = {
          stat_data: {},
          initialized_lorebooks: vars.initialized_lorebooks,
        };
        await this.config.saveFloorVariables(floorId, cleanedVars);
        cleanedCount++;
      }
    }

    return { cleanedCount, snapshotCount };
  }
}

// ============================================================================
//                              工厂函数
// ============================================================================

export function createFloorManager(config: FloorManagerConfig): FloorManager {
  return new FloorManager(config);
}

// ============================================================================
//                              工具函数
// ============================================================================

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function deepMerge<T extends Record<string, unknown>>(target: T, source: T): T {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];

    if (isPlainObject(sourceVal) && isPlainObject(targetVal)) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else if (sourceVal !== undefined) {
      (result as Record<string, unknown>)[key] = sourceVal;
    }
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
