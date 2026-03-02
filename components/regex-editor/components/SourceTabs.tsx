/**
 * @input  @/components
 * @output SourceTabs
 * @pos    正则脚本编辑器组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      Source Tabs Component                                ║
 * ║                                                                           ║
 * ║  来源切换标签 - Scoped / Global / Preset                                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { Button } from "@/components/ui/button";
import type { SourceScripts } from "@/hooks/useRegexScripts/index";

interface SourceTabsProps {
  sourceTab: "scoped" | "global" | "preset";
  activeGlobalId: string | null;
  globalSources: SourceScripts[];
  presetSource: SourceScripts | null;
  fontClass: string;
  t: (key: string) => string;
  onTabChange: (tab: "scoped" | "global" | "preset") => void;
  onGlobalIdChange: (id: string | null) => void;
  onRefreshGlobal: () => void;
}

export function SourceTabs({
  sourceTab,
  activeGlobalId,
  globalSources,
  presetSource,
  fontClass,
  t,
  onTabChange,
  onGlobalIdChange,
  onRefreshGlobal,
}: SourceTabsProps) {
  const isGlobalView = sourceTab === "global";
  const isPresetView = sourceTab === "preset";

  return (
    <div className="px-3 sm:px-4 py-2 border-b border-border/60 flex flex-wrap items-center gap-2 sm:gap-3">
      {/* 标签按钮组 */}
      <div className="flex items-center gap-1.5">
        <Button
          variant={sourceTab === "scoped" ? "default" : "outline"}
          size="sm"
          onClick={() => onTabChange("scoped")}
          className="h-8"
        >
          {t("regexScriptEditor.tabScoped")}
        </Button>
        <Button
          variant={sourceTab === "global" ? "default" : "outline"}
          size="sm"
          onClick={() => onTabChange("global")}
          className="h-8"
        >
          {t("regexScriptEditor.tabGlobal")}
        </Button>
        <Button
          variant={sourceTab === "preset" ? "default" : "outline"}
          size="sm"
          onClick={() => presetSource && onTabChange("preset")}
          disabled={!presetSource}
          className="h-8"
        >
          {t("regexScriptEditor.tabPreset")}
        </Button>
      </div>

      {/* Global 视图的控制 */}
      {isGlobalView && (
        <div className="flex items-center gap-2">
          <select
            value={activeGlobalId || ""}
            onChange={(e) => onGlobalIdChange(e.target.value || null)}
            className="bg-muted-surface border border-border rounded px-2 py-1 text-sm text-cream-soft"
          >
            {globalSources.length === 0 && (
              <option value="">{t("regexScriptEditor.noGlobalSources")}</option>
            )}
            {globalSources.map((g) => (
              <option key={g.ownerId} value={g.ownerId}>
                {g.name || g.ownerId}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={onRefreshGlobal} className="h-8">
            {t("regexScriptEditor.refreshGlobal")}
          </Button>
        </div>
      )}

      {/* Preset 视图的提示 */}
      {isPresetView && (
        <div className="text-xs text-ink-soft">
          {t("regexScriptEditor.currentPreset")}: {presetSource?.name || t("regexScriptEditor.noActivePreset")}
        </div>
      )}
    </div>
  );
}
