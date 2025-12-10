/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       WorldBookControls                                    ║
 * ║  顶部控制区：新增/导入/批量 + 排序/筛选（单栏合并，参考预设）                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { Plus, FileText, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WorldBookControlsProps {
  sortBy: string;
  sortOrder: "asc" | "desc";
  filterBy: string;
  canBulk: boolean;
  onCreate: () => void;
  onImport: () => void;
  onSortByChange: (value: string) => void;
  onSortOrderToggle: () => void;
  onFilterChange: (value: string) => void;
  onBulkToggle: (enabled: boolean) => void;
  fontClass: string;
  serifFontClass: string;
  t: (key: string) => string;
}

export function WorldBookControls({
  sortBy,
  sortOrder,
  filterBy,
  canBulk,
  onCreate,
  onImport,
  onSortByChange,
  onSortOrderToggle,
  onFilterChange,
  onBulkToggle,
  fontClass,
  serifFontClass,
  t,
}: WorldBookControlsProps) {
  return (
    <div className="sticky top-0 z-20  border-b border-border p-2 sm:p-3">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Button variant="outline" size="sm" onClick={onCreate}>
            <Plus className="w-3 h-3" />
            {t("worldBook.addEntry")}
          </Button>

          <Button variant="outline" size="sm" onClick={onImport}>
            <FileText className="w-3 h-3" />
            {t("worldBook.import")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkToggle(true)}
            disabled={!canBulk}
          >
            {t("worldBook.enableAll")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkToggle(false)}
            disabled={!canBulk}
          >
            {t("worldBook.disableAll")}
          </Button>
        </div>

        <div className="hidden sm:block w-px h-6 bg-border/60" />

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Selector
            label={t("worldBook.sortBy")}
            value={sortBy}
            onChange={onSortByChange}
            options={[
              { value: "position", label: t("worldBook.position") },
              { value: "priority", label: t("worldBook.priority") },
              { value: "characterCount", label: t("worldBook.characterCount") },
              { value: "keywords", label: t("worldBook.keywords") },
              { value: "comment", label: t("worldBook.comment") },
              { value: "depth", label: t("worldBook.depth") },
              { value: "lastUpdated", label: t("worldBook.lastUpdated") },
            ]}
            fontClass={fontClass}
            serifFontClass={serifFontClass}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={onSortOrderToggle}
            title={sortOrder === "asc" ? t("worldBook.asc") : t("worldBook.desc")}
          >
            <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>
            <span className="text-xs">{sortOrder === "asc" ? t("worldBook.asc") : t("worldBook.desc")}</span>
          </Button>

          <Selector
            label={t("worldBook.filterBy")}
            value={filterBy}
            onChange={onFilterChange}
            options={[
              { value: "all", label: t("worldBook.all") },
              { value: "enabled", label: t("worldBook.enabled") },
              { value: "disabled", label: t("worldBook.disabled") },
              { value: "constant", label: t("worldBook.constant") },
              { value: "imported", label: t("worldBook.imported") },
            ]}
            fontClass={fontClass}
            serifFontClass={serifFontClass}
          />
        </div>
      </div>
    </div>
  );
}

function Selector({
  label,
  value,
  onChange,
  options,
  fontClass,
  serifFontClass,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  fontClass: string;
  serifFontClass: string;
}) {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <div className="flex items-center gap-1 sm:gap-1.5">
        <span className={"text-2xs sm:text-xs text-ink-soft font-medium "}>{label}</span>
      </div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={"appearance-none bg-gradient-to-br from-deep via-muted-surface to-deep text-cream-soft px-2 sm:px-3 py-1 sm:py-1.5 pr-5 sm:pr-7 rounded-md border border-border/60 focus:border-primary-500/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-300 hover:border-border backdrop-blur-sm  text-2xs sm:text-xs font-medium  hover: hover:shadow-primary-500/5"}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className=" text-cream-soft">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-1.5 sm:pr-2 pointer-events-none">
          <ChevronDown className="w-2 h-2 text-ink-soft" />
        </div>
      </div>
    </div>
  );
}
