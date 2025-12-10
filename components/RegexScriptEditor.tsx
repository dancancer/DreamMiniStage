/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                       RegexScriptEditor Component                        ║
 * ║                                                                          ║
 * ║  正则脚本编辑器主组件 - 重构后的简洁版本                                    ║
 * ║  核心逻辑提取到 useRegexScripts hook                                      ║
 * ║  列表项渲染提取到 ScriptListItem 组件                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "@/app/i18n";
import { RegexScript } from "@/lib/models/regex-script-model";
import { trackButtonClick } from "@/utils/google-analytics";
import RegexScriptEntryEditor from "@/components/RegexScriptEntryEditor";
import ImportRegexScriptModal from "@/components/ImportRegexScriptModal";
import { ScriptListItem, SortFilterControls } from "@/components/regex-editor";
import {
  useRegexScripts,
  filterScripts,
  sortScripts,
  SortField,
  SortOrder,
  FilterType,
  ScriptWithKey,
} from "@/hooks/useRegexScripts";
import { X, Plus, Download, Code } from "lucide-react";
import { Button } from "@/components/ui/button";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface Props {
  onClose: () => void;
  characterName: string;
  characterId: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

export default function RegexScriptEditor({ onClose, characterName, characterId }: Props) {
  const { t, fontClass, serifFontClass } = useLanguage();

  // 从 hook 获取数据和操作
  const { scripts, settings, stats, isLoading, isSaving, saveScript, deleteScript, toggleScript, reload } = useRegexScripts({ characterId });

  // UI 状态
  const [editingScript, setEditingScript] = useState<ScriptWithKey | null>(null);
  const [expandedScripts, setExpandedScripts] = useState<Set<string>>(new Set());
  const [animationComplete, setAnimationComplete] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>("priority");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [filterBy, setFilterBy] = useState<FilterType>("all");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // 滚动管理
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scriptRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 计算筛选和排序后的脚本列表
  const filteredScripts = filterScripts(scripts, filterBy);
  const sortedScripts = sortScripts(filteredScripts, sortBy, sortOrder);

  // 动画初始化
  useEffect(() => {
    const timer = setTimeout(() => setAnimationComplete(true), 100);
    const refs = scriptRefs.current;

    return () => {
      clearTimeout(timer);
      const timeoutId = scrollTimeoutRef.current;
      if (timeoutId) clearTimeout(timeoutId);
      refs.clear();
    };
  }, []);

  // 滚动到指定脚本
  const scrollToScript = useCallback((scriptId: string) => {
    const container = scrollContainerRef.current;
    const element = scriptRefs.current.get(scriptId);
    if (!container || !element) return;

    requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect();
      const scriptRect = element.getBoundingClientRect();
      const buffer = 30;

      if (scriptRect.top >= containerRect.top + buffer && scriptRect.bottom <= containerRect.bottom - buffer) return;

      const sortedIds = sortedScripts.map(([id]) => id);
      const isLast = sortedIds.indexOf(scriptId) === sortedIds.length - 1;
      const scriptHeight = scriptRect.height;
      const containerHeight = containerRect.height;

      let targetTop: number;
      if (isLast) {
        targetTop = scriptHeight > containerHeight - 120
          ? element.offsetTop - 40
          : element.offsetTop + scriptHeight - containerHeight + 120;
      } else if (scriptHeight > containerHeight - 80) {
        targetTop = element.offsetTop - 40;
      } else if (scriptRect.bottom > containerRect.bottom) {
        targetTop = element.offsetTop + scriptHeight - containerHeight + 80;
      } else if (scriptRect.top < containerRect.top) {
        targetTop = element.offsetTop - 40;
      } else {
        return;
      }

      const maxTop = container.scrollHeight - containerHeight;
      container.scrollTo({ top: Math.min(Math.max(0, targetTop), maxTop), behavior: "smooth" });
    });
  }, [sortedScripts]);

  // 展开/折叠 + 滚动定位
  const toggleScriptExpansion = useCallback((scriptId: string) => {
    let isExpanding = false;

    setExpandedScripts(prev => {
      const next = new Set(prev);
      if (next.has(scriptId)) {
        next.delete(scriptId);
      } else {
        next.add(scriptId);
        isExpanding = true;
      }
      return next;
    });

    if (!isExpanding) return;

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    setTimeout(() => scrollToScript(scriptId), 150);
    scrollTimeoutRef.current = setTimeout(() => {
      scrollToScript(scriptId);
      scrollTimeoutRef.current = null;
    }, 350);
  }, [scrollToScript]);

  // 保存脚本
  const handleSaveScript = useCallback(async (script: ScriptWithKey) => {
    await saveScript(script);
  }, [saveScript]);

  // 加载状态
  if (isLoading) {
    return <LoadingSpinner t={t} />;
  }

  return (
    <div className="h-full flex flex-col  text-cream-soft">
      {/* ─────────────────────────────────────────────────────────────────────
          头部栏
          ───────────────────────────────────────────────────────────────────── */}
      <HeaderBar
        characterName={characterName}
        stats={stats}
        filteredCount={filteredScripts.length}
        filterBy={filterBy}
        serifFontClass={serifFontClass}
        fontClass={fontClass}
        t={t}
        onClose={onClose}
      />

      {/* ─────────────────────────────────────────────────────────────────────
          工具栏
          ───────────────────────────────────────────────────────────────────── */}
      <Toolbar
        settings={settings}
        serifFontClass={serifFontClass}
        fontClass={fontClass}
        t={t}
        sortBy={sortBy}
        sortOrder={sortOrder}
        filterBy={filterBy}
        onSortByChange={setSortBy}
        onSortOrderToggle={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
        onFilterByChange={setFilterBy}
        onAddNew={() => setEditingScript({})}
        onOpenImport={() => {
          trackButtonClick("page", "打开正则导入");
          setIsImportModalOpen(true);
        }}
      />

      {/* ─────────────────────────────────────────────────────────────────────
          脚本列表
          ───────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <div ref={scrollContainerRef} className="h-full overflow-y-auto p-2 sm:p-4 pb-16 space-y-2 sm:space-y-4">
          {stats.total === 0 ? (
            <EmptyState fontClass={fontClass} t={t} />
          ) : (
            <div className="space-y-2 sm:space-y-3 pb-32">
              {sortedScripts.map(([scriptId, script], index) => (
                <ScriptListItem
                  key={scriptId}
                  ref={(el) => { el ? scriptRefs.current.set(scriptId, el) : scriptRefs.current.delete(scriptId); }}
                  scriptId={scriptId}
                  script={script}
                  isExpanded={expandedScripts.has(scriptId)}
                  animationComplete={animationComplete}
                  index={index}
                  fontClass={fontClass}
                  serifFontClass={serifFontClass}
                  t={t}
                  onToggleExpand={toggleScriptExpansion}
                  onEdit={(s) => setEditingScript({ ...s, scriptKey: scriptId })}
                  onToggle={toggleScript}
                  onDelete={deleteScript}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          弹窗
          ───────────────────────────────────────────────────────────────────── */}
      <RegexScriptEntryEditor
        isOpen={editingScript !== null}
        editingScript={editingScript}
        isSaving={isSaving}
        onClose={() => setEditingScript(null)}
        onSave={handleSaveScript}
        onScriptChange={(script) => setEditingScript(script)}
      />

      <ImportRegexScriptModal
        isOpen={isImportModalOpen}
        characterId={characterId}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          setIsImportModalOpen(false);
          reload();
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   子组件：加载状态
   ═══════════════════════════════════════════════════════════════════════════ */

function LoadingSpinner({ t }: { t: (key: string) => string }) {
  return (
    <div className="h-full flex items-center justify-center ">
      <div className="flex flex-col items-center">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-t-primary-bright border-r-primary-soft border-b-ink-soft border-l-transparent animate-spin" />
          <div className="absolute inset-2 rounded-full border-2 border-t-ink-soft border-r-primary-bright border-b-primary-soft border-l-transparent animate-spin-slow" />
        </div>
        <p className="mt-4 text-primary-soft">{t("regexScriptEditor.loading") || "Loading..."}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   子组件：头部栏
   ═══════════════════════════════════════════════════════════════════════════ */

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

function HeaderBar({ characterName, stats, filteredCount, filterBy, serifFontClass, fontClass, t, onClose }: HeaderBarProps) {
  return (
    <div className="p-2 sm:p-3 border-b border-border bg-muted-surface relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-transparent opacity-50" />
      <div className="relative z-10 flex justify-between items-center min-h-[2rem]">
        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-medium text-cream-soft flex-shrink-0">
            <span className={" "}>
              {t("regexScriptEditor.title")}
            </span>
            <span className={"ml-1 sm:ml-2 text-xs sm:text-sm text-ink-soft  inline-block truncate max-w-[100px] sm:max-w-[150px] align-bottom"} title={characterName}>
              - {characterName}
            </span>
          </h2>

          {/* 桌面端统计 */}
          <div className={"hidden md:flex items-center space-x-2 text-xs text-ink-soft  flex-shrink-0"}>
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
          <div className={`md:hidden flex items-center space-x-1 text-2xs sm:text-xs text-ink-soft ${fontClass} flex-shrink-0`}>
            <span className=" px-1.5 sm:px-2 py-1 rounded border border-border whitespace-nowrap">
              {stats.total} / {stats.enabled} / {stats.disabled}
              {filterBy !== "all" && ` (${filteredCount})`}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => { trackButtonClick("page", "关闭正则编辑器"); onClose(); }}
          className="h-6 w-6 sm:h-7 sm:w-7 text-ink-soft hover:text-cream-soft hover:bg-stroke group flex-shrink-0 ml-2"
        >
          <X size={12} className="transition-transform duration-300 group-hover:scale-110" />
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   子组件：工具栏
   ═══════════════════════════════════════════════════════════════════════════ */

interface ToolbarProps {
  settings: { enabled: boolean; applyToResponse: boolean };
  sortBy: SortField;
  sortOrder: SortOrder;
  filterBy: FilterType;
  serifFontClass: string;
  fontClass: string;
  t: (key: string) => string;
  onSortByChange: (value: SortField) => void;
  onSortOrderToggle: () => void;
  onFilterByChange: (value: FilterType) => void;
  onAddNew: () => void;
  onOpenImport: () => void;
}

function Toolbar({
  settings,
  sortBy,
  sortOrder,
  filterBy,
  serifFontClass,
  fontClass,
  t,
  onSortByChange,
  onSortOrderToggle,
  onFilterByChange,
  onAddNew,
  onOpenImport,
}: ToolbarProps) {
  return (
    <div className="sticky top-0 z-20  border-b border-border p-2 sm:p-3">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            onClick={onAddNew}
            className="h-auto px-2 sm:px-3 py-1 sm:py-1.5 text-primary-soft hover:text-primary-soft text-xs sm:text-sm font-medium group flex-shrink-0 border-border"
          >
            <span className="flex items-center">
              <Plus size={10} className="mr-1 sm:mr-1.5 transition-transform duration-300 group-hover:scale-110" />
              {t("regexScriptEditor.addNewScript")}
            </span>
          </Button>

          <Button
            variant="outline"
            onClick={onOpenImport}
            className="h-auto px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-overlay to-coal text-xs sm:text-sm font-medium group flex-shrink-0 border-stroke-strong"
          >
            <span className="flex items-center">
              <Download size={10} className="mr-1 sm:mr-1.5 transition-transform duration-300 group-hover:scale-110" />
              {t("regexScriptEditor.importScript")}
            </span>
          </Button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-2xs sm:text-xs text-ink-soft bg-muted-surface px-2 sm:px-3 py-1.5 sm:py-2 rounded border border-border flex-shrink-0 overflow-hidden">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className={`whitespace-nowrap ${fontClass} truncate`}>{t("regexScriptEditor.globalEnabled")}:</span>
            <span className={`${settings.enabled ? "text-primary-400" : "text-rose-400"} font-medium flex-shrink-0`}>
              {settings.enabled ? t("regexScriptEditor.yes") : t("regexScriptEditor.no")}
            </span>
          </div>
          <span className="hidden sm:inline">•</span>
          <div className="flex items-center gap-1 sm:gap-2">
            <span className={`whitespace-nowrap ${fontClass} truncate`}>{t("regexScriptEditor.applyToResponse")}:</span>
            <span className={`${settings.applyToResponse ? "text-primary-400" : "text-rose-400"} font-medium flex-shrink-0`}>
              {settings.applyToResponse ? t("regexScriptEditor.yes") : t("regexScriptEditor.no")}
            </span>
          </div>
        </div>

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

/* ═══════════════════════════════════════════════════════════════════════════
   子组件：空状态
   ═══════════════════════════════════════════════════════════════════════════ */

function EmptyState({ fontClass, t }: { fontClass: string; t: (key: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-ink-soft">
      <Code size={48} strokeWidth={1} className="mb-4 opacity-50" />
      <p className={`text-lg mb-2 ${fontClass}`}>{t("regexScriptEditor.noScripts")}</p>
      <p className={`text-sm opacity-70 ${fontClass}`}>{t("regexScriptEditor.noScriptsDescription")}</p>
    </div>
  );
}
