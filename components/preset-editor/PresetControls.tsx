/**
 * @input  @/components
 * @output PresetControls
 * @pos    预设编辑器组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       PresetControls                                       ║
 * ║  顶部控制区：创建/导入 + 排序/筛选（单行合并）                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { Plus, FileText, AlignJustify, ChevronDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PresetControlsProps {
  sortBy: string;
  sortOrder: "asc" | "desc";
  filterBy: string;
  onCreate: () => void;
  onImport: () => void;
  onSortByChange: (value: string) => void;
  onSortOrderToggle: () => void;
  onFilterChange: (value: string) => void;
  t: (key: string) => string;
}

export function PresetControls({
  sortBy,
  sortOrder,
  filterBy,
  onCreate,
  onImport,
  onSortByChange,
  onSortOrderToggle,
  onFilterChange,
  t,
}: PresetControlsProps) {
  return (
    <div className="sticky top-0 z-20  border-b border-border p-2 sm:p-3">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* ─────────────────────────────────────────────────────────────────
         * 左侧：创建 / 导入按钮
         * ───────────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCreate}
            className="px-2 sm:px-3 py-1 sm:py-1.5 h-auto text-primary-soft  text-xs sm:text-sm font-medium group border border-border"
          >
            <span className="flex items-center">
              <Plus size={10} className="mr-1 sm:mr-1.5" />
              <span className="hidden sm:inline">{t("preset.createPreset")}</span>
              <span className="sm:hidden">{t("preset.create")}</span>
            </span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onImport}
            className="px-2 sm:px-3 py-1 sm:py-1.5 h-auto text-xs sm:text-sm font-medium group  border border-border"
          >
            <span className="flex items-center">
              <FileText size={10} className="mr-1 sm:mr-1.5" />
              {t("preset.importPreset")}
            </span>
          </Button>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
         * 分隔线
         * ───────────────────────────────────────────────────────────────── */}
        <div className="hidden sm:block w-px h-6 bg-border/60" />

        {/* ─────────────────────────────────────────────────────────────────
         * 右侧：排序 / 筛选控件
         * ───────────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* 排序字段 */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <AlignJustify size={10} className="text-primary-400/80" />
            <label className="text-2xs sm:text-xs text-ink-soft font-medium">{t("preset.sortBy")}</label>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value)}
                className="appearance-none bg-muted-surface text-cream-soft px-2 sm:px-3 py-1 sm:py-1.5 pr-5 sm:pr-7 rounded-md border border-border/60 focus:border-primary-500/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-300 hover:border-border backdrop-blur-sm text-2xs sm:text-xs font-medium"
              >
                <option value="name" className=" text-cream-soft">{t("preset.name")}</option>
                <option value="promptCount" className=" text-cream-soft">{t("preset.promptCount")}</option>
                <option value="lastUpdated" className=" text-cream-soft">{t("preset.lastUpdated")}</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-1.5 sm:pr-2 pointer-events-none">
                <ChevronDown size={8} className="text-ink-soft" />
              </div>
            </div>
          </div>

          {/* 排序方向 */}
          <Button
            variant="outline"
            size="sm"
            onClick={onSortOrderToggle}
            className="group flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 h-auto bg-muted-surface border border-border/60 hover:border-primary-500/40 text-cream-soft hover:text-primary-200 backdrop-blur-sm"
            title={sortOrder === "asc" ? t("preset.ascending") : t("preset.descending")}
          >
            <div
              className={`flex items-center justify-center w-3 h-3 sm:w-4 sm:h-4 rounded-full transition-all duration-300 ${
                sortOrder === "asc"
                  ? "bg-primary/20 text-primary-400"
                  : "bg-blue-500/20 text-blue-400"
              }`}
            >
              <span className="text-3xs sm:text-xs font-bold">{sortOrder === "asc" ? "↑" : "↓"}</span>
            </div>
            <span className="text-2xs sm:text-xs font-medium">{sortOrder === "asc" ? t("preset.asc") : t("preset.desc")}</span>
          </Button>

          {/* 筛选 */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <Filter size={10} className="text-blue-400/80" />
            <label className="text-2xs sm:text-xs text-ink-soft font-medium">{t("preset.filterBy")}</label>
            <div className="relative">
              <select
                value={filterBy}
                onChange={(e) => onFilterChange(e.target.value)}
                className="appearance-none bg-muted-surface text-cream-soft px-2 sm:px-3 py-1 sm:py-1.5 pr-5 sm:pr-7 rounded-md border border-border/60 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 hover:border-border backdrop-blur-sm text-2xs sm:text-xs font-medium"
              >
                <option value="all" className=" text-cream-soft">{t("preset.all")}</option>
                <option value="active" className=" text-cream-soft">{t("preset.active")}</option>
                <option value="empty" className=" text-cream-soft">{t("preset.empty")}</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-1.5 sm:pr-2 pointer-events-none">
                <ChevronDown size={8} className="text-ink-soft" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
