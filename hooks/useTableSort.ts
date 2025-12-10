/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         useTableSort Hook                                  ║
 * ║                                                                            ║
 * ║  表格排序状态管理：排序字段、排序方向、localStorage 持久化                   ║
 * ║  从 PresetEditor 和 WorldBookEditor 提取的共用逻辑                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { getJSON, setJSON } from "@/lib/storage/client-storage";

// ============================================================================
//                              类型定义
// ============================================================================

export interface SortState {
  sortBy: string;
  sortOrder: "asc" | "desc";
}

interface UseTableSortOptions {
  storageKey: string;
  defaultSortBy?: string;
  defaultSortOrder?: "asc" | "desc";
}

interface UseTableSortReturn {
  sortBy: string;
  sortOrder: "asc" | "desc";
  handleSortByChange: (newSortBy: string) => void;
  handleSortOrderToggle: () => void;
  setSortBy: (value: string) => void;
  setSortOrder: (value: "asc" | "desc") => void;
}

// ============================================================================
//                              主 Hook
// ============================================================================

export function useTableSort({
  storageKey,
  defaultSortBy = "name",
  defaultSortOrder = "asc",
}: UseTableSortOptions): UseTableSortReturn {
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(defaultSortOrder);

  // 从 localStorage 加载排序偏好
  useEffect(() => {
    const stored = getJSON<{ sortBy?: string; sortOrder?: "asc" | "desc" } | null>(storageKey, null);
    if (stored?.sortBy) setSortBy(stored.sortBy);
    if (stored?.sortOrder) setSortOrder(stored.sortOrder);
  }, [storageKey]);

  // 保存排序偏好到 localStorage
  const savePreferences = useCallback((newSortBy: string, newSortOrder: "asc" | "desc") => {
    const preferences = {
      sortBy: newSortBy,
      sortOrder: newSortOrder,
      timestamp: Date.now(),
    };
    setJSON(storageKey, preferences);
  }, [storageKey]);

  // 切换排序字段
  const handleSortByChange = useCallback((newSortBy: string) => {
    setSortBy(newSortBy);
    savePreferences(newSortBy, sortOrder);
  }, [sortOrder, savePreferences]);

  // 切换排序方向
  const handleSortOrderToggle = useCallback(() => {
    const newSortOrder = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(newSortOrder);
    savePreferences(sortBy, newSortOrder);
  }, [sortBy, sortOrder, savePreferences]);

  return {
    sortBy,
    sortOrder,
    handleSortByChange,
    handleSortOrderToggle,
    setSortBy,
    setSortOrder,
  };
}

// ============================================================================
//                              排序工具函数
// ============================================================================

/**
 * 通用排序比较器
 * @param items 待排序数组
 * @param sortBy 排序字段
 * @param sortOrder 排序方向
 * @param customComparators 自定义比较器映射
 */
export function sortItems<T extends object>(
  items: T[],
  sortBy: string,
  sortOrder: "asc" | "desc",
  customComparators?: Record<string, (a: T, b: T) => number>
): T[] {
  const multiplier = sortOrder === "asc" ? 1 : -1;

  return [...items].sort((a, b) => {
    // 使用自定义比较器
    if (customComparators?.[sortBy]) {
      return customComparators[sortBy](a, b) * multiplier;
    }

    // 默认比较逻辑
    const recordA = a as Record<string, unknown>;
    const recordB = b as Record<string, unknown>;
    const aVal = recordA[sortBy];
    const bVal = recordB[sortBy];

    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal) * multiplier;
    }

    if (typeof aVal === "number" && typeof bVal === "number") {
      return (aVal - bVal) * multiplier;
    }

    if (typeof aVal === "boolean" && typeof bVal === "boolean") {
      return (Number(aVal) - Number(bVal)) * multiplier;
    }

    return 0;
  });
}
