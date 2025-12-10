/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         useTableFilter Hook                                ║
 * ║                                                                            ║
 * ║  表格筛选状态管理：筛选条件、localStorage 持久化                             ║
 * ║  从 PresetEditor 和 WorldBookEditor 提取的共用逻辑                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { getJSON, setJSON } from "@/lib/storage/client-storage";

// ============================================================================
//                              类型定义
// ============================================================================

interface UseTableFilterOptions {
  storageKey: string;
  defaultFilter?: string;
}

interface UseTableFilterReturn {
  filterBy: string;
  setFilterBy: (value: string) => void;
  handleFilterChange: (newFilter: string) => void;
}

// ============================================================================
//                              主 Hook
// ============================================================================

export function useTableFilter({
  storageKey,
  defaultFilter = "all",
}: UseTableFilterOptions): UseTableFilterReturn {
  const [filterBy, setFilterBy] = useState(defaultFilter);

  // 从 localStorage 加载筛选偏好
  useEffect(() => {
    const stored = getJSON<{ filterBy?: string } | null>(storageKey, null);
    if (stored?.filterBy) {
      setFilterBy(stored.filterBy);
    }
  }, [storageKey]);

  // 切换筛选条件并保存
  const handleFilterChange = useCallback((newFilter: string) => {
    setFilterBy(newFilter);
    const preferences = {
      filterBy: newFilter,
      timestamp: Date.now(),
    };
    setJSON(storageKey, preferences);
  }, [storageKey]);

  return {
    filterBy,
    setFilterBy,
    handleFilterChange,
  };
}

// ============================================================================
//                              筛选工具函数
// ============================================================================

/**
 * 通用筛选函数
 * @param items 待筛选数组
 * @param filterBy 筛选条件 key
 * @param filterMap 筛选条件映射
 */
export function filterItems<T>(
  items: T[],
  filterBy: string,
  filterMap: Record<string, (item: T) => boolean>
): T[] {
  const filterFn = filterMap[filterBy];
  if (!filterFn) return items;
  return items.filter(filterFn);
}
