/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         useRowExpansion Hook                               ║
 * ║                                                                            ║
 * ║  表格行展开状态管理：展开/折叠、批量操作                                     ║
 * ║  从 PresetEditor 和 WorldBookEditor 提取的共用逻辑                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useCallback } from "react";

// ============================================================================
//                              类型定义
// ============================================================================

interface UseRowExpansionReturn {
  expandedRows: Set<string>;
  isExpanded: (id: string) => boolean;
  toggleRow: (id: string) => void;
  expandAll: (ids: string[]) => void;
  collapseAll: () => void;
  setExpandedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
}

// ============================================================================
//                              主 Hook
// ============================================================================

export function useRowExpansion(initialExpanded?: Set<string>): UseRowExpansionReturn {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(initialExpanded ?? new Set());

  const isExpanded = useCallback((id: string) => {
    return expandedRows.has(id);
  }, [expandedRows]);

  const toggleRow = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback((ids: string[]) => {
    setExpandedRows(new Set(ids));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedRows(new Set());
  }, []);

  return {
    expandedRows,
    isExpanded,
    toggleRow,
    expandAll,
    collapseAll,
    setExpandedRows,
  };
}
