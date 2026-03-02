/**
 * @input  @/components, @/utils
 * @output HeaderBar
 * @pos    正则脚本编辑器组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                        Header Bar Component                               ║
 * ║                                                                           ║
 * ║  头部栏 - 显示标题和统计信息                                                 ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackButtonClick } from "@/utils/google-analytics";
import type { FilterType } from "@/hooks/useRegexScripts/index";

interface HeaderBarProps {
  characterName: string;
  stats: { total: number; enabled: number; disabled: number };
  filteredCount: number;
  filterBy: FilterType;
  serifFontClass: string;
  fontClass: string;
  t: (key: string) => string;
  onClose: () => void;
}

export function HeaderBar({
  characterName,
  stats,
  filteredCount,
  filterBy,
  serifFontClass,
  fontClass,
  t,
  onClose,
}: HeaderBarProps) {
  return (
    <div className="p-2 sm:p-3 border-b border-border bg-muted-surface relative overflow-hidden">
      <div className="absolute inset-0 bg-primary/5 opacity-50" />
      <div className="relative z-10 flex justify-between items-center min-h-8">
        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-medium text-cream-soft shrink-0">
            <span className=" ">
              {t("regexScriptEditor.title")}
            </span>
            <span
              className={"ml-1 sm:ml-2 text-xs sm:text-sm text-ink-soft  inline-block truncate max-w-[100px] sm:max-w-[150px] align-bottom"}
              title={characterName}
            >
              - {characterName}
            </span>
          </h2>

          {/* 桌面端统计 */}
          <div className={"hidden md:flex items-center space-x-2 text-xs text-ink-soft  shrink-0"}>
            <span className="whitespace-nowrap">{t("regexScriptEditor.totalCount")} {stats.total}</span>
            <span>•</span>
            <span className="text-primary-400 whitespace-nowrap">{t("regexScriptEditor.enabledCount")} {stats.enabled}</span>
            <span>•</span>
            <span className="text-rose-400 whitespace-nowrap">{t("regexScriptEditor.disabledCount")} {stats.disabled}</span>
            {filterBy !== "all" && (
              <>
                <span>•</span>
                <span className="text-blue-400 whitespace-nowrap">{t("regexScriptEditor.filteredCount")} {filteredCount}</span>
              </>
            )}
          </div>

          {/* 移动端统计 */}
          <div className={`md:hidden flex items-center space-x-1 text-2xs sm:text-xs text-ink-soft ${fontClass} shrink-0`}>
            <span className=" px-1.5 sm:px-2 py-1 rounded border border-border whitespace-nowrap">
              {stats.total} / {stats.enabled} / {stats.disabled}
              {filterBy !== "all" && ` (${filteredCount})`}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            trackButtonClick("page", "关闭正则编辑器");
            onClose();
          }}
          className="h-6 w-6 sm:h-7 sm:w-7 text-ink-soft hover:text-cream-soft hover:bg-stroke group shrink-0 ml-2"
        >
          <X size={12} />
        </Button>
      </div>
    </div>
  );
}
