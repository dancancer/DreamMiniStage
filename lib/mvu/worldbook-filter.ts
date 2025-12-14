/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 世界书过滤器                                    ║
 * ║                                                                            ║
 * ║  根据 [mvu_update] / [mvu_plot] 标记过滤世界书条目                           ║
 * ║  设计原则：主模型看剧情，额外模型看变量                                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { WorldBookEntry } from "./variable-init";

// ============================================================================
//                              常量定义
// ============================================================================

/** MVU 标记常量 */
export const MVU_MARKERS = {
  /** 变量更新条目 - 仅额外模型可见 */
  UPDATE: "[mvu_update]",
  /** 剧情演绎条目 - 仅主模型可见 */
  PLOT: "[mvu_plot]",
  /** 初始变量条目 - 两个模型都可见 */
  INIT_VAR: "[initvar]",
} as const;

export type MvuMarker = typeof MVU_MARKERS[keyof typeof MVU_MARKERS];

// ============================================================================
//                              配置类型
// ============================================================================

export interface WorldBookFilterConfig {
  /** 是否保留 [InitVar] 条目（默认 true） */
  keepInitVar?: boolean;
  /** 是否保留无标记条目（默认 true） */
  keepUnmarked?: boolean;
  /** 自定义过滤函数 */
  customFilter?: (entry: WorldBookEntry) => boolean;
}

export interface FilteredWorldBookResult {
  /** 过滤后的条目 */
  entries: WorldBookEntry[];
  /** 被过滤掉的条目数量 */
  filteredCount: number;
  /** 原始条目数量 */
  totalCount: number;
}

// ============================================================================
//                              标记检测
// ============================================================================

/** 检查条目是否包含指定标记 */
export function hasMarker(entry: WorldBookEntry, marker: string): boolean {
  const comment = entry.comment?.toLowerCase() ?? "";
  return comment.includes(marker.toLowerCase());
}

/** 提取条目中的所有 MVU 标记 */
export function extractMarkersFromEntry(entry: WorldBookEntry): MvuMarker[] {
  const markers: MvuMarker[] = [];
  const comment = entry.comment?.toLowerCase() ?? "";

  if (comment.includes(MVU_MARKERS.UPDATE.toLowerCase())) {
    markers.push(MVU_MARKERS.UPDATE);
  }
  if (comment.includes(MVU_MARKERS.PLOT.toLowerCase())) {
    markers.push(MVU_MARKERS.PLOT);
  }
  if (comment.includes(MVU_MARKERS.INIT_VAR.toLowerCase())) {
    markers.push(MVU_MARKERS.INIT_VAR);
  }

  return markers;
}

/** 检查条目是否为变量更新条目 */
export function isUpdateEntry(entry: WorldBookEntry): boolean {
  return hasMarker(entry, MVU_MARKERS.UPDATE);
}

/** 检查条目是否为剧情演绎条目 */
export function isPlotEntry(entry: WorldBookEntry): boolean {
  return hasMarker(entry, MVU_MARKERS.PLOT);
}

/** 检查条目是否为初始变量条目 */
export function isInitVarEntry(entry: WorldBookEntry): boolean {
  return hasMarker(entry, MVU_MARKERS.INIT_VAR);
}

// ============================================================================
//                              主模型过滤
// ============================================================================

/**
 * 为主模型过滤世界书
 *
 * 规则：
 * - 移除 [mvu_update] 条目（变量更新规则不应该出现在主模型的上下文中）
 * - 保留 [mvu_plot] 条目（剧情演绎条目）
 * - 保留 [InitVar] 条目（初始变量声明）
 * - 保留无标记条目
 */
export function filterWorldBookForMainModel(
  entries: WorldBookEntry[],
  config: WorldBookFilterConfig = {},
): FilteredWorldBookResult {
  const { keepInitVar = true, keepUnmarked = true, customFilter } = config;
  const totalCount = entries.length;

  const filtered = entries.filter((entry) => {
    // 自定义过滤器优先
    if (customFilter && !customFilter(entry)) return false;

    const markers = extractMarkersFromEntry(entry);

    // 移除 [mvu_update] 条目
    if (markers.includes(MVU_MARKERS.UPDATE)) return false;

    // [InitVar] 条目根据配置决定
    if (markers.includes(MVU_MARKERS.INIT_VAR)) return keepInitVar;

    // [mvu_plot] 条目保留
    if (markers.includes(MVU_MARKERS.PLOT)) return true;

    // 无标记条目根据配置决定
    if (markers.length === 0) return keepUnmarked;

    return true;
  });

  return {
    entries: filtered,
    filteredCount: totalCount - filtered.length,
    totalCount,
  };
}

// ============================================================================
//                              额外模型过滤
// ============================================================================

/**
 * 为额外模型（变量解析模型）过滤世界书
 *
 * 规则：
 * - 移除 [mvu_plot] 条目（剧情演绎不应该影响变量解析）
 * - 保留 [mvu_update] 条目（变量更新规则）
 * - 保留 [InitVar] 条目（了解变量结构）
 * - 保留无标记条目（可能包含上下文信息）
 */
export function filterWorldBookForExtraModel(
  entries: WorldBookEntry[],
  config: WorldBookFilterConfig = {},
): FilteredWorldBookResult {
  const { keepInitVar = true, keepUnmarked = true, customFilter } = config;
  const totalCount = entries.length;

  const filtered = entries.filter((entry) => {
    // 自定义过滤器优先
    if (customFilter && !customFilter(entry)) return false;

    const markers = extractMarkersFromEntry(entry);

    // 移除 [mvu_plot] 条目
    if (markers.includes(MVU_MARKERS.PLOT)) return false;

    // [InitVar] 条目根据配置决定
    if (markers.includes(MVU_MARKERS.INIT_VAR)) return keepInitVar;

    // [mvu_update] 条目保留
    if (markers.includes(MVU_MARKERS.UPDATE)) return true;

    // 无标记条目根据配置决定
    if (markers.length === 0) return keepUnmarked;

    return true;
  });

  return {
    entries: filtered,
    filteredCount: totalCount - filtered.length,
    totalCount,
  };
}

// ============================================================================
//                              统一过滤接口
// ============================================================================

export type FilterMode = "main" | "extra" | "all";

/**
 * 统一的世界书过滤接口
 */
export function filterWorldBook(
  entries: WorldBookEntry[],
  mode: FilterMode,
  config: WorldBookFilterConfig = {},
): FilteredWorldBookResult {
  switch (mode) {
  case "main":
    return filterWorldBookForMainModel(entries, config);
  case "extra":
    return filterWorldBookForExtraModel(entries, config);
  case "all":
  default:
    return {
      entries,
      filteredCount: 0,
      totalCount: entries.length,
    };
  }
}

// ============================================================================
//                              辅助函数
// ============================================================================

/**
 * 检查世界书是否包含变量更新标记，用于决定是否启用额外模型
 */
export function shouldUseExtraModelByWorldBook(entries: WorldBookEntry[]): boolean {
  return entries.some((entry) => isUpdateEntry(entry));
}

/**
 * 获取世界书中的所有变量更新条目
 */
export function getUpdateEntries(entries: WorldBookEntry[]): WorldBookEntry[] {
  return entries.filter(isUpdateEntry);
}

/**
 * 获取世界书中的所有剧情演绎条目
 */
export function getPlotEntries(entries: WorldBookEntry[]): WorldBookEntry[] {
  return entries.filter(isPlotEntry);
}

/**
 * 统计世界书中各类条目数量
 */
export function countWorldBookEntries(entries: WorldBookEntry[]): {
  total: number;
  update: number;
  plot: number;
  initVar: number;
  unmarked: number;
} {
  let update = 0;
  let plot = 0;
  let initVar = 0;
  let unmarked = 0;

  for (const entry of entries) {
    const markers = extractMarkersFromEntry(entry);
    if (markers.includes(MVU_MARKERS.UPDATE)) update++;
    if (markers.includes(MVU_MARKERS.PLOT)) plot++;
    if (markers.includes(MVU_MARKERS.INIT_VAR)) initVar++;
    if (markers.length === 0) unmarked++;
  }

  return {
    total: entries.length,
    update,
    plot,
    initVar,
    unmarked,
  };
}
