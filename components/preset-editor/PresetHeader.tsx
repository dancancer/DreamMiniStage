/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       PresetHeader                                         ║
 * ║  顶部标题栏：名称/统计/关闭                                                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { X } from "lucide-react";
import { PresetData } from "./index";
import { Button } from "@/components/ui/button";

interface PresetHeaderProps {
  characterName?: string;
  presets: PresetData[];
  filteredCount: number;
  filterBy: string;
  fontClass: string;
  serifFontClass: string;
  t: (key: string) => string;
  onClose: () => void;
}

export function PresetHeader({
  characterName,
  presets,
  filteredCount,
  filterBy,
  fontClass,
  serifFontClass,
  t,
  onClose,
}: PresetHeaderProps) {
  const activeCount = presets.filter((p) => p.totalPrompts > 0).length;
  const emptyCount = presets.filter((p) => p.totalPrompts === 0).length;

  return (
    <div className="p-2 sm:p-3 border-b border-border bg-muted-surface relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-transparent opacity-50"></div>
      <div className="relative z-10 flex justify-between items-center min-h-[2rem]">
        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-medium text-cream-soft flex-shrink-0">
            <span className={" "}>
              {t("preset.title")}
            </span>
            {characterName && (
              <span
                className={"ml-1 sm:ml-2 text-xs sm:text-sm text-ink-soft  inline-block truncate max-w-[100px] sm:max-w-[150px] align-bottom"}
                title={characterName}
              >
                - {characterName}
              </span>
            )}
          </h2>
          <div className={"hidden md:flex items-center space-x-2 text-xs text-ink-soft  flex-shrink-0"}>
            <span className="whitespace-nowrap">
              {t("preset.total")}: {presets.length}
            </span>
            <span>•</span>
            <span className="text-primary-400 whitespace-nowrap">
              {t("preset.active_status")}: {activeCount}
            </span>
            <span>•</span>
            <span className="text-rose-400 whitespace-nowrap">
              {t("preset.empty_status")}: {emptyCount}
            </span>
            {filterBy !== "all" && (
              <>
                <span>•</span>
                <span className="text-blue-400 whitespace-nowrap">
                  {t("preset.filtered")}: {filteredCount}
                </span>
              </>
            )}
          </div>
          <div className={"md:hidden flex items-center space-x-1 text-2xs sm:text-xs text-ink-soft  flex-shrink-0"}>
            <span className=" px-1.5 sm:px-2 py-1 rounded border border-border whitespace-nowrap">
              {presets.length} / {activeCount} / {emptyCount}
              {filterBy !== "all" && ` (${filteredCount})`}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="w-6 h-6 sm:w-7 sm:h-7 text-ink-soft hover:text-cream-soft hover:bg-stroke group flex-shrink-0 ml-2"
        >
          <X size={12} className="transition-transform duration-300 group-hover:scale-110" />
        </Button>
      </div>
    </div>
  );
}
