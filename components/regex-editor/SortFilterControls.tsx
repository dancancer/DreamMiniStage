/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                        SortFilterControls Component                       ║
 * ║                                                                          ║
 * ║  排序筛选控件 - 从 RegexScriptEditor 提取                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { AlignJustify, Filter, ChevronDown } from "lucide-react";
import { SortField, SortOrder, FilterType } from "@/hooks/useRegexScripts";
import { Button } from "@/components/ui/button";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface SortFilterControlsProps {
  sortBy: SortField;
  sortOrder: SortOrder;
  filterBy: FilterType;
  serifFontClass: string;
  t: (key: string) => string;
  onSortByChange: (value: SortField) => void;
  onSortOrderToggle: () => void;
  onFilterByChange: (value: FilterType) => void;
  variant?: "standalone" | "inline";
  className?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

export function SortFilterControls({
  sortBy,
  sortOrder,
  filterBy,
  serifFontClass,
  t,
  onSortByChange,
  onSortOrderToggle,
  onFilterByChange,
  variant = "standalone",
  className = "",
}: SortFilterControlsProps) {
  const containerClasses = variant === "inline"
    ? `flex flex-wrap items-center gap-2 sm:gap-3 ${className}`.trim()
    : "flex flex-col sm:flex-row sm:items-center gap-2";

  const content = (
    <div className={containerClasses}>
      {/* 排序字段 */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 sm:gap-1.5">
          <AlignJustify size={10} className="text-primary-400/80" />
          <label className={"text-2xs sm:text-xs text-ink-soft font-medium "}>{t("regexScriptEditor.sortBy")}</label>
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as SortField)}
            className={"appearance-none bg-gradient-to-br from-deep via-muted-surface to-deep text-cream-soft px-2 sm:px-3 py-1 sm:py-1.5 pr-5 sm:pr-7 rounded-md border border-border/60 focus:border-primary-500/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-300 hover:border-border backdrop-blur-sm  text-2xs sm:text-xs font-medium  hover: hover:shadow-primary-500/5"}
          >
            <option value="priority" className=" text-cream-soft">{t("regexScriptEditor.priority")}</option>
            <option value="name" className=" text-cream-soft">{t("regexScriptEditor.name")}</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-1.5 sm:pr-2 pointer-events-none">
            <ChevronDown size={8} className="text-ink-soft" />
          </div>
        </div>
      </div>

      {/* 排序顺序 */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        <span className={"text-2xs sm:text-xs text-ink-soft font-medium "}>{t("regexScriptEditor.sortOrder")}:</span>
        <Button
          variant="outline"
          size="sm"
          onClick={onSortOrderToggle}
          className="group relative flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 h-auto bg-gradient-to-br from-deep via-muted-surface to-deep border border-border/60 hover:border-primary-500/40 text-cream-soft hover:text-primary-200 backdrop-blur-sm"
          title={sortOrder === "asc" ? t("regexScriptEditor.ascending") : t("regexScriptEditor.descending")}
        >
          <div className={`flex items-center justify-center w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-gradient-to-br ${sortOrder === "asc" ? "from-primary-500/20 to-primary-600/30 text-primary-400" : "from-blue-500/20 to-blue-600/30 text-blue-400"} transition-all duration-300 group-hover:scale-110`}>
            <span className="text-2xs sm:text-xs font-bold">{sortOrder === "asc" ? "↑" : "↓"}</span>
          </div>
          <span className="text-2xs sm:text-xs font-medium">{sortOrder === "asc" ? t("regexScriptEditor.asc") : t("regexScriptEditor.desc")}</span>
        </Button>
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 sm:gap-1.5">
          <Filter size={10} className="text-blue-400/80" />
          <label className={"text-2xs sm:text-xs text-ink-soft font-medium "}>{t("regexScriptEditor.filterBy")}</label>
        </div>
        <div className="relative">
          <select
            value={filterBy}
            onChange={(e) => onFilterByChange(e.target.value as FilterType)}
            className={"appearance-none bg-gradient-to-br from-deep via-muted-surface to-deep text-cream-soft px-2 sm:px-3 py-1 sm:py-1.5 pr-5 sm:pr-7 rounded-md border border-border/60 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 hover:border-border backdrop-blur-sm  text-2xs sm:text-xs font-medium  hover: hover:shadow-blue-500/5"}
          >
            <option value="all" className=" text-cream-soft">{t("regexScriptEditor.filterAll")}</option>
            <option value="enabled" className=" text-cream-soft">{t("regexScriptEditor.filterEnabled")}</option>
            <option value="disabled" className=" text-cream-soft">{t("regexScriptEditor.filterDisabled")}</option>
            <option value="imported" className=" text-cream-soft">{t("regexScriptEditor.filterImported")}</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-1.5 sm:pr-2 pointer-events-none">
            <ChevronDown size={8} className="text-ink-soft" />
          </div>
        </div>
      </div>
    </div>
  );

  if (variant === "inline") return content;

  return (
    <div className="sticky top-0 z-20  border-b border-border/40 p-2 sm:p-3">
      {content}
    </div>
  );
}
