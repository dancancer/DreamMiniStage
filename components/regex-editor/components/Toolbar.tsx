/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                        Toolbar Component                                  ║
 * ║                                                                           ║
 * ║  工具栏 - 操作按钮和筛选控制                                                 ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { Plus, Download, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SortFilterControls } from "@/components/regex-editor";
import type { SortField, SortOrder, FilterType } from "@/hooks/useRegexScripts";

interface ToolbarProps {
  settings: { enabled: boolean; applyToResponse: boolean };
  sortBy: SortField;
  sortOrder: SortOrder;
  filterBy: FilterType;
  selectionMode: boolean;
  selectedCount: number;
  totalCount: number;
  readOnly?: boolean;
  disableImport?: boolean;
  showExportToGlobal?: boolean;
  serifFontClass: string;
  fontClass: string;
  t: (key: string) => string;
  onSortByChange: (value: SortField) => void;
  onSortOrderToggle: () => void;
  onFilterByChange: (value: FilterType) => void;
  onAddNew: () => void;
  onOpenImport: () => void;
  onToggleSelectionMode: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkEnable: () => void;
  onBulkDisable: () => void;
  onBulkDelete: () => void;
  onExportToGlobal?: () => void;
}

export function Toolbar({
  settings,
  sortBy,
  sortOrder,
  filterBy,
  selectionMode,
  selectedCount,
  totalCount,
  readOnly = false,
  disableImport = false,
  showExportToGlobal = false,
  serifFontClass,
  fontClass,
  t,
  onSortByChange,
  onSortOrderToggle,
  onFilterByChange,
  onAddNew,
  onOpenImport,
  onToggleSelectionMode,
  onSelectAll,
  onDeselectAll,
  onBulkEnable,
  onBulkDisable,
  onBulkDelete,
  onExportToGlobal,
}: ToolbarProps) {
  return (
    <div className="sticky top-0 z-20  border-b border-border p-2 sm:p-3">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {!selectionMode ? (
          /* ═══════════════════════════════════════════════════════════════════
             常规模式：添加、导入、选择模式切换
             ═══════════════════════════════════════════════════════════════════ */
          <>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <Button
                variant="outline"
                onClick={onAddNew}
                disabled={readOnly}
                className="h-auto px-2 sm:px-3 py-1 sm:py-1.5 text-primary-soft hover:text-primary-soft text-xs sm:text-sm font-medium group shrink-0 border-border"
              >
                <span className="flex items-center">
                  <Plus size={10} className="mr-1 sm:mr-1.5 transition-transform duration-300 group-hover:scale-110" />
                  {t("regexScriptEditor.addNewScript")}
                </span>
              </Button>

              <Button
                variant="outline"
                onClick={onOpenImport}
                disabled={readOnly || disableImport}
                className="h-auto px-2 sm:px-3 py-1 sm:py-1.5 bg-linear-to-r from-overlay to-coal text-xs sm:text-sm font-medium group shrink-0 border-stroke-strong"
              >
                <span className="flex items-center">
                  <Download size={10} className="mr-1 sm:mr-1.5 transition-transform duration-300 group-hover:scale-110" />
                  {t("regexScriptEditor.importScript")}
                </span>
              </Button>

              <Button
                variant="outline"
                onClick={onToggleSelectionMode}
                className="h-auto px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium group shrink-0 border-border"
              >
                <span className="flex items-center">
                  <Check size={10} className="mr-1 sm:mr-1.5" />
                  {t("regexScriptEditor.selectMode") || "Select"}
                </span>
              </Button>
            </div>
          </>
        ) : (
          /* ═══════════════════════════════════════════════════════════════════
             选择模式：批量操作按钮组
             ═══════════════════════════════════════════════════════════════════ */
          <>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <Button
                variant="outline"
                onClick={onToggleSelectionMode}
                className="h-auto px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium shrink-0 border-border"
              >
                <X size={10} className="mr-1 sm:mr-1.5" />
                {t("regexScriptEditor.cancel") || "Cancel"}
              </Button>

              <div className="h-4 w-px bg-border" />

              <Button
                variant="outline"
                onClick={onSelectAll}
                disabled={selectedCount === totalCount}
                className="h-auto px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium shrink-0"
              >
                {t("regexScriptEditor.selectAll") || "All"}
              </Button>

              <Button
                variant="outline"
                onClick={onDeselectAll}
                disabled={selectedCount === 0}
                className="h-auto px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium shrink-0"
              >
                {t("regexScriptEditor.deselectAll") || "None"}
              </Button>

              {showExportToGlobal && (
                <>
                  <div className="h-4 w-px bg-border" />
                  <Button
                    variant="outline"
                    onClick={onExportToGlobal}
                    disabled={selectedCount === 0}
                    className="h-auto px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium shrink-0 text-primary-soft border-primary-500/40"
                  >
                    {t("regexScriptEditor.exportToGlobal")}
                  </Button>
                </>
              )}

              <div className="h-4 w-px bg-border" />

              <Button
                variant="outline"
                onClick={onBulkEnable}
                disabled={selectedCount === 0 || readOnly}
                className="h-auto px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium shrink-0 text-primary-400 border-primary-500/30"
              >
                {t("regexScriptEditor.bulkEnable") || "Enable"}
              </Button>

              <Button
                variant="outline"
                onClick={onBulkDisable}
                disabled={selectedCount === 0 || readOnly}
                className="h-auto px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium shrink-0 text-orange-400 border-orange-500/30"
              >
                {t("regexScriptEditor.bulkDisable") || "Disable"}
              </Button>

              <Button
                variant="outline"
                onClick={onBulkDelete}
                disabled={selectedCount === 0 || readOnly}
                className="h-auto px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium shrink-0 text-rose-400 border-rose-500/30"
              >
                {t("regexScriptEditor.bulkDelete") || "Delete"}
              </Button>

              <div className={`text-xs text-ink-soft ${fontClass} ml-2`}>
                {selectedCount} / {totalCount} {t("regexScriptEditor.selected") || "selected"}
              </div>
            </div>
          </>
        )}

        {/* 全局设置显示 */}
        <div className="flex items-center gap-2 sm:gap-3 text-2xs sm:text-xs text-ink-soft bg-muted-surface px-2 sm:px-3 py-1.5 sm:py-2 rounded border border-border shrink-0 overflow-hidden">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className={`whitespace-nowrap ${fontClass} truncate`}>{t("regexScriptEditor.globalEnabled")}:</span>
            <span className={`${settings.enabled ? "text-primary-400" : "text-rose-400"} font-medium shrink-0`}>
              {settings.enabled ? t("regexScriptEditor.yes") : t("regexScriptEditor.no")}
            </span>
          </div>
          <span className="hidden sm:inline">•</span>
          <div className="flex items-center gap-1 sm:gap-2">
            <span className={`whitespace-nowrap ${fontClass} truncate`}>{t("regexScriptEditor.applyToResponse")}:</span>
            <span className={`${settings.applyToResponse ? "text-primary-400" : "text-rose-400"} font-medium shrink-0`}>
              {settings.applyToResponse ? t("regexScriptEditor.yes") : t("regexScriptEditor.no")}
            </span>
          </div>
        </div>

        {/* 排序和筛选控制 */}
        <div className="flex-1 min-w-[260px]">
          <SortFilterControls
            variant="inline"
            sortBy={sortBy}
            sortOrder={sortOrder}
            filterBy={filterBy}
            serifFontClass={serifFontClass}
            t={t}
            onSortByChange={onSortByChange}
            onSortOrderToggle={onSortOrderToggle}
            onFilterByChange={onFilterByChange}
          />
        </div>
      </div>
    </div>
  );
}
