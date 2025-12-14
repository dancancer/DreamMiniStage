/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    useRegexScripts Helpers                                ║
 * ║                                                                           ║
 * ║  工具函数 - 好品味：纯函数，无副作用，易测试                                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { RegexScript } from "@/lib/models/regex-script-model";
import type { SortField, SortOrder, FilterType } from "../types";

/* ═══════════════════════════════════════════════════════════════════════════
   筛选函数
   ═══════════════════════════════════════════════════════════════════════════ */

export function filterScripts(
  scripts: Record<string, RegexScript>,
  filterBy: FilterType
): [string, RegexScript][] {
  const entries = Object.entries(scripts);
  if (filterBy === "all") return entries;

  // 好品味：用 Map 消除 switch
  const filterMap: Record<FilterType, (s: RegexScript) => boolean> = {
    all: () => true,
    enabled: (s) => !s.disabled,
    disabled: (s) => !!s.disabled,
    imported: (s) => s.extensions?.imported === true,
  };

  return entries.filter(([, script]) => filterMap[filterBy](script));
}

/* ═══════════════════════════════════════════════════════════════════════════
   排序函数
   ═══════════════════════════════════════════════════════════════════════════ */

export function sortScripts(
  entries: [string, RegexScript][],
  sortBy: SortField,
  sortOrder: SortOrder
): [string, RegexScript][] {
  const sorted = [...entries].sort(([, a], [, b]) => {
    const comparison =
      sortBy === "name"
        ? (a.scriptName || "").localeCompare(b.scriptName || "")
        : (a.placement?.[0] || 999) - (b.placement?.[0] || 999);
    return sortOrder === "desc" ? -comparison : comparison;
  });
  return sorted;
}

/* ═══════════════════════════════════════════════════════════════════════════
   文本截断
   ═══════════════════════════════════════════════════════════════════════════ */

export function truncateText(text: string, maxLength = 50): string {
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}
