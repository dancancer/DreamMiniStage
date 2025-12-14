/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 楼层管理 UI 辅助                                ║
 * ║                                                                            ║
 * ║  提供楼层管理相关的 UI 辅助函数和钩子                                         ║
 * ║  设计原则：UI 逻辑与核心逻辑分离                                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { MvuData } from "./types";
import type { FloorMessage, ReplayConfig, ReplayResult } from "./floor-replay";
import { replayFloors, findLastValidSnapshot, createFloorManager } from "./floor-replay";
import type { WorldBookEntry } from "./variable-init";

// ============================================================================
//                              类型定义
// ============================================================================

/** 楼层显示信息 */
export interface FloorDisplayInfo {
  id: string | number;
  index: number;
  hasVariables: boolean;
  isSnapshot: boolean;
  variableCount: number;
  preview: string;
}

/** 楼层操作上下文 */
export interface FloorOperationContext {
  /** 当前楼层 ID */
  currentFloorId: string | number;
  /** 所有消息列表 */
  messages: FloorMessage[];
  /** 当前变量数据 */
  variables: MvuData;
  /** 世界书列表 */
  worldBooks?: WorldBookEntry[][];
  /** 世界书名称 */
  worldBookNames?: string[];
}

/** 楼层操作结果 */
export interface FloorOperationResult {
  success: boolean;
  message: string;
  variables?: MvuData;
  affectedFloors?: (string | number)[];
}

/** 重演进度回调 */
export type ReplayProgressCallback = (current: number, total: number, floorId: string | number) => void;

// ============================================================================
//                              楼层信息提取
// ============================================================================

/**
 * 获取楼层的显示信息
 */
export function getFloorDisplayInfo(
  message: FloorMessage,
  index: number,
  isSnapshot = false,
): FloorDisplayInfo {
  const vars = message.variables;
  const hasVariables = !!(vars && vars.stat_data && Object.keys(vars.stat_data).length > 0);
  const variableCount = hasVariables ? Object.keys(vars!.stat_data).length : 0;

  // 生成预览文本
  let preview = "";
  if (hasVariables && vars?.stat_data) {
    const keys = Object.keys(vars.stat_data).slice(0, 3);
    preview = keys.join(", ");
    if (Object.keys(vars.stat_data).length > 3) {
      preview += "...";
    }
  }

  return {
    id: message.id,
    index,
    hasVariables,
    isSnapshot,
    variableCount,
    preview,
  };
}

/**
 * 批量获取楼层显示信息
 */
export function getAllFloorDisplayInfo(
  messages: FloorMessage[],
  snapshotFloorIds: Set<string | number> = new Set(),
): FloorDisplayInfo[] {
  return messages.map((msg, index) =>
    getFloorDisplayInfo(msg, index, snapshotFloorIds.has(msg.id)),
  );
}

// ============================================================================
//                              楼层操作封装
// ============================================================================

/**
 * 从指定楼层重新计算变量
 * 用于编辑历史消息后重新计算后续所有变量
 */
export async function recalculateFromFloor(
  context: FloorOperationContext,
  startFloorId: string | number,
  onProgress?: ReplayProgressCallback,
): Promise<FloorOperationResult> {
  const { messages, variables } = context;

  // 找到起始楼层
  const startIndex = messages.findIndex((m) => m.id === startFloorId);
  if (startIndex === -1) {
    return {
      success: false,
      message: `找不到楼层: ${startFloorId}`,
    };
  }

  // 找到最近的有效快照作为基础
  const snapshotIndex = findLastValidSnapshot(messages, startIndex);
  const baseVariables = snapshotIndex >= 0
    ? messages[snapshotIndex].variables!
    : variables;

  // 执行重演
  const config: ReplayConfig = {
    startFloorId: snapshotIndex >= 0 ? messages[snapshotIndex].id : messages[0].id,
    endFloorId: messages[messages.length - 1].id,
    onProgress: onProgress
      ? (current, total) => onProgress(current, total, messages[startIndex + current]?.id ?? startFloorId)
      : undefined,
  };

  const result = await replayFloors(messages, baseVariables, config);

  return {
    success: result.success,
    message: result.success
      ? `成功重算 ${result.replayedCount} 层变量`
      : `重算失败: ${result.errors.join(", ")}`,
    variables: result.variables,
    affectedFloors: messages.slice(startIndex).map((m) => m.id),
  };
}

/**
 * 重置到指定楼层的变量状态
 * 用于回滚变量到某个历史状态
 */
export function resetToFloor(
  context: FloorOperationContext,
  targetFloorId: string | number,
): FloorOperationResult {
  const { messages } = context;

  const targetIndex = messages.findIndex((m) => m.id === targetFloorId);
  if (targetIndex === -1) {
    return {
      success: false,
      message: `找不到楼层: ${targetFloorId}`,
    };
  }

  const targetVars = messages[targetIndex].variables;
  if (!targetVars) {
    return {
      success: false,
      message: `楼层 ${targetFloorId} 没有变量数据`,
    };
  }

  return {
    success: true,
    message: `已重置到楼层 ${targetFloorId} 的变量状态`,
    variables: JSON.parse(JSON.stringify(targetVars)),
  };
}

/**
 * 比较两个楼层的变量差异
 */
export function compareFloorVariables(
  messages: FloorMessage[],
  floorId1: string | number,
  floorId2: string | number,
): { changed: string[]; added: string[]; removed: string[] } | null {
  const floor1 = messages.find((m) => m.id === floorId1);
  const floor2 = messages.find((m) => m.id === floorId2);

  if (!floor1?.variables?.stat_data || !floor2?.variables?.stat_data) {
    return null;
  }

  const data1 = floor1.variables.stat_data;
  const data2 = floor2.variables.stat_data;

  const keys1 = new Set(Object.keys(data1));
  const keys2 = new Set(Object.keys(data2));

  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];

  // 检查变更和删除
  for (const key of keys1) {
    if (!keys2.has(key)) {
      removed.push(key);
    } else if (JSON.stringify(data1[key]) !== JSON.stringify(data2[key])) {
      changed.push(key);
    }
  }

  // 检查新增
  for (const key of keys2) {
    if (!keys1.has(key)) {
      added.push(key);
    }
  }

  return { changed, added, removed };
}

// ============================================================================
//                              UI 状态管理
// ============================================================================

/** 楼层管理 UI 状态 */
export interface FloorManagementState {
  /** 选中的楼层 ID */
  selectedFloorId: string | number | null;
  /** 是否正在重演 */
  isReplaying: boolean;
  /** 重演进度 */
  replayProgress: { current: number; total: number } | null;
  /** 最后操作结果 */
  lastResult: FloorOperationResult | null;
  /** 显示模式 */
  displayMode: "compact" | "detailed";
}

/** 创建初始状态 */
export function createInitialFloorManagementState(): FloorManagementState {
  return {
    selectedFloorId: null,
    isReplaying: false,
    replayProgress: null,
    lastResult: null,
    displayMode: "compact",
  };
}

// ============================================================================
//                              快捷操作
// ============================================================================

/**
 * 检查是否可以从指定楼层重演
 */
export function canReplayFromFloor(
  messages: FloorMessage[],
  floorId: string | number,
): boolean {
  const index = messages.findIndex((m) => m.id === floorId);
  if (index === -1) return false;

  // 需要有后续楼层才能重演
  return index < messages.length - 1;
}

/**
 * 获取楼层的变量摘要
 */
export function getFloorVariableSummary(
  message: FloorMessage,
): { total: number; types: Record<string, number> } {
  const vars = message.variables?.stat_data;
  if (!vars) {
    return { total: 0, types: {} };
  }

  const types: Record<string, number> = {};
  let total = 0;

  for (const value of Object.values(vars)) {
    total++;
    const type = Array.isArray(value) ? "array" : typeof value;
    types[type] = (types[type] || 0) + 1;
  }

  return { total, types };
}

/**
 * 格式化变量值用于显示
 */
export function formatVariableForDisplay(value: unknown, maxLength = 50): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  if (Array.isArray(value)) {
    // ValueWithDescription 格式
    if (value.length === 2 && typeof value[1] === "string") {
      return `${JSON.stringify(value[0])} (${value[1]})`;
    }
    const str = JSON.stringify(value);
    return str.length > maxLength ? str.slice(0, maxLength) + "..." : str;
  }

  if (typeof value === "object") {
    const str = JSON.stringify(value);
    return str.length > maxLength ? str.slice(0, maxLength) + "..." : str;
  }

  return String(value);
}

// ============================================================================
//                              工厂函数
// ============================================================================

/**
 * 创建楼层管理器的简化版本（用于 UI）
 */
export function createUIFloorManager(
  getContent: (floorId: string | number) => Promise<string | null>,
  getVariables: (floorId: string | number) => Promise<MvuData | null>,
  saveVariables: (floorId: string | number, variables: MvuData) => Promise<void>,
) {
  return createFloorManager({
    snapshotInterval: 10,
    retainFloors: 20,
    getFloorContent: getContent,
    getFloorVariables: getVariables,
    saveFloorVariables: saveVariables,
  });
}
