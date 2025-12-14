/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  RegexScriptEditor - Main Component                       ║
 * ║                                                                           ║
 * ║  正则脚本编辑器主组件 - 好品味：组合优于继承，简洁清晰                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/app/i18n";
import { trackButtonClick } from "@/utils/google-analytics";
import RegexScriptEntryEditor from "@/components/RegexScriptEntryEditor";
import ImportRegexScriptModal from "@/components/ImportRegexScriptModal";
import { ScriptListItem } from "@/components/regex-editor";
import {
  useRegexScripts,
  filterScripts,
  sortScripts,
  type SortField,
  type SortOrder,
  type FilterType,
  type ScriptWithKey,
} from "@/hooks/useRegexScripts";
import { toast } from "@/lib/store/toast-store";

// 导入子组件
import { LoadingSpinner } from "./components/LoadingSpinner";
import { EmptyState } from "./components/EmptyState";
import { HeaderBar } from "./components/HeaderBar";
import { SourceTabs } from "./components/SourceTabs";
import { Toolbar } from "./components/Toolbar";
import { useScriptScroll } from "./hooks/useScriptScroll";

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

  // ─── 数据层 ───
  const {
    scopedScripts,
    settings,
    globalSources,
    presetSource,
    isLoading,
    isSaving,
    saveScriptForOwner,
    deleteScriptForOwner,
    toggleScriptForOwner,
    reload,
    reloadGlobals,
    exportSelectedToGlobal,
    bulkEnableForOwner,
    bulkDisableForOwner,
    bulkDeleteForOwner,
  } = useRegexScripts({ characterId });

  // ─── UI 状态 ───
  const [editingScript, setEditingScript] = useState<ScriptWithKey | null>(null);
  const [expandedScripts, setExpandedScripts] = useState<Set<string>>(new Set());
  const [animationComplete, setAnimationComplete] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>("priority");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [filterBy, setFilterBy] = useState<FilterType>("all");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [sourceTab, setSourceTab] = useState<"scoped" | "global" | "preset">("scoped");
  const [activeGlobalId, setActiveGlobalId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set());

  // ─── 来源选择逻辑 ───
  useEffect(() => {
    if (sourceTab === "global" && !activeGlobalId && globalSources.length > 0) {
      setActiveGlobalId(globalSources[0].ownerId);
    }
  }, [sourceTab, activeGlobalId, globalSources]);

  const currentOwnerId = useMemo(() => {
    if (sourceTab === "global") return activeGlobalId || "";
    if (sourceTab === "preset") return presetSource?.ownerId || "";
    return characterId;
  }, [activeGlobalId, characterId, presetSource, sourceTab]);

  const currentScripts = useMemo(() => {
    if (sourceTab === "global") {
      const found = globalSources.find((g) => g.ownerId === activeGlobalId);
      return found?.scripts || {};
    }
    if (sourceTab === "preset") {
      return presetSource?.scripts || {};
    }
    return scopedScripts;
  }, [activeGlobalId, globalSources, presetSource, scopedScripts, sourceTab]);

  // ─── 滚动管理 ───
  const filteredScripts = filterScripts(currentScripts, filterBy);
  const sortedScripts = sortScripts(filteredScripts, sortBy, sortOrder);
  const { scrollContainerRef, scriptRefs, scheduleScroll, cleanup } = useScriptScroll(sortedScripts);

  const currentStats = useMemo(() => {
    const total = Object.keys(currentScripts).length;
    const enabled = Object.values(currentScripts).filter((s) => !s.disabled).length;
    const disabled = Object.values(currentScripts).filter((s) => s.disabled).length;
    return { total, enabled, disabled };
  }, [currentScripts]);

  const isPresetView = sourceTab === "preset";
  const isGlobalView = sourceTab === "global";

  // ─── 切换来源时重置状态 ───
  useEffect(() => {
    setSelectedScripts(new Set());
    setSelectionMode(false);
    setExpandedScripts(new Set());
    setEditingScript(null);
    setIsImportModalOpen(false);
  }, [sourceTab, currentOwnerId]);

  // ─── 初始化动画 ───
  useEffect(() => {
    const timer = setTimeout(() => setAnimationComplete(true), 100);
    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, [cleanup]);

  // ─── 展开/折叠脚本 ───
  const toggleScriptExpansion = useCallback(
    (scriptId: string) => {
      let isExpanding = false;
      setExpandedScripts((prev) => {
        const next = new Set(prev);
        if (next.has(scriptId)) {
          next.delete(scriptId);
        } else {
          next.add(scriptId);
          isExpanding = true;
        }
        return next;
      });

      if (isExpanding) {
        scheduleScroll(scriptId);
      }
    },
    [scheduleScroll],
  );

  // ─── 保存脚本 ───
  const handleSaveScript = useCallback(
    async (script: ScriptWithKey) => {
      if (!currentOwnerId || isPresetView) return;
      await saveScriptForOwner(currentOwnerId, script);
      if (isGlobalView) await reloadGlobals();
      else await reload();
    },
    [currentOwnerId, isGlobalView, isPresetView, reload, reloadGlobals, saveScriptForOwner],
  );

  // ─── 批量操作处理器 ───
  const handleToggleSelection = useCallback((scriptId: string) => {
    setSelectedScripts((prev) => {
      const next = new Set(prev);
      next.has(scriptId) ? next.delete(scriptId) : next.add(scriptId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedScripts(new Set(sortedScripts.map(([id]) => id)));
  }, [sortedScripts]);

  const handleDeselectAll = useCallback(() => {
    setSelectedScripts(new Set());
  }, []);

  const handleBulkEnable = useCallback(async () => {
    if (!currentOwnerId || isPresetView) {
      toast.error(t("regexScriptEditor.bulkNotAllowed"));
      return;
    }
    const ids = Array.from(selectedScripts);
    const success = await bulkEnableForOwner(currentOwnerId, ids, currentScripts);
    if (success) {
      setSelectedScripts(new Set());
      setSelectionMode(false);
    }
  }, [bulkEnableForOwner, currentOwnerId, currentScripts, isPresetView, selectedScripts, t]);

  const handleBulkDisable = useCallback(async () => {
    if (!currentOwnerId || isPresetView) {
      toast.error(t("regexScriptEditor.bulkNotAllowed"));
      return;
    }
    const ids = Array.from(selectedScripts);
    const success = await bulkDisableForOwner(currentOwnerId, ids, currentScripts);
    if (success) {
      setSelectedScripts(new Set());
      setSelectionMode(false);
    }
  }, [bulkDisableForOwner, currentOwnerId, currentScripts, isPresetView, selectedScripts, t]);

  const handleBulkDelete = useCallback(async () => {
    if (!currentOwnerId || isPresetView) {
      toast.error(t("regexScriptEditor.bulkNotAllowed"));
      return;
    }
    if (!confirm(t("regexScriptEditor.confirmBulkDelete") || `Delete ${selectedScripts.size} scripts?`)) {
      return;
    }
    const ids = Array.from(selectedScripts);
    const success = await bulkDeleteForOwner(currentOwnerId, ids, currentScripts);
    if (success) {
      setSelectedScripts(new Set());
      setSelectionMode(false);
    }
  }, [bulkDeleteForOwner, currentOwnerId, currentScripts, isPresetView, selectedScripts, t]);

  const handleExportToGlobal = useCallback(async () => {
    if (selectedScripts.size === 0) {
      toast.error(t("regexScriptEditor.selectScriptsToExport"));
      return;
    }
    if (!currentOwnerId) {
      toast.error(t("regexScriptEditor.noOwnerForExport"));
      return;
    }
    const defaultName = `Global Regex ${new Date().toLocaleString()}`;
    const name = prompt(t("regexScriptEditor.inputGlobalName"), defaultName) || defaultName;
    const result = await exportSelectedToGlobal(currentOwnerId, Array.from(selectedScripts), {
      name,
      sourceCharacterName: characterName,
    });
    if (result.success) {
      toast.success(result.message || t("regexScriptEditor.exportSuccess"));
      setSelectionMode(false);
      setSelectedScripts(new Set());
      await reloadGlobals();
    } else {
      toast.error(result.message || t("regexScriptEditor.exportFailed"));
    }
  }, [characterName, currentOwnerId, exportSelectedToGlobal, reloadGlobals, selectedScripts, t]);

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    setSelectedScripts(new Set());
  }, []);

  // ─── 加载状态 ───
  if (isLoading) {
    return <LoadingSpinner t={t} />;
  }

  // ─── 主渲染 ───
  return (
    <div className="h-full flex flex-col  text-cream-soft">
      <HeaderBar
        characterName={characterName}
        stats={currentStats}
        filteredCount={filteredScripts.length}
        filterBy={filterBy}
        serifFontClass={serifFontClass}
        fontClass={fontClass}
        t={t}
        onClose={onClose}
      />

      <SourceTabs
        sourceTab={sourceTab}
        activeGlobalId={activeGlobalId}
        globalSources={globalSources}
        presetSource={presetSource}
        fontClass={fontClass}
        t={t}
        onTabChange={setSourceTab}
        onGlobalIdChange={setActiveGlobalId}
        onRefreshGlobal={reloadGlobals}
      />

      <Toolbar
        settings={settings}
        serifFontClass={serifFontClass}
        fontClass={fontClass}
        t={t}
        sortBy={sortBy}
        sortOrder={sortOrder}
        filterBy={filterBy}
        selectionMode={selectionMode}
        selectedCount={selectedScripts.size}
        totalCount={currentStats.total}
        readOnly={isPresetView || !currentOwnerId}
        disableImport={!currentOwnerId}
        showExportToGlobal={sourceTab !== "global"}
        onSortByChange={setSortBy}
        onSortOrderToggle={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
        onFilterByChange={setFilterBy}
        onAddNew={() => setEditingScript({})}
        onOpenImport={() => {
          trackButtonClick("page", "打开正则导入");
          setIsImportModalOpen(true);
        }}
        onToggleSelectionMode={handleToggleSelectionMode}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onBulkEnable={handleBulkEnable}
        onBulkDisable={handleBulkDisable}
        onBulkDelete={handleBulkDelete}
        onExportToGlobal={handleExportToGlobal}
      />

      {/* 脚本列表 */}
      <div className="flex-1 overflow-hidden">
        <div ref={scrollContainerRef} className="h-full overflow-y-auto p-2 sm:p-4 pb-16 space-y-2 sm:space-y-4">
          {currentStats.total === 0 ? (
            <EmptyState fontClass={fontClass} t={t} />
          ) : (
            <div className="space-y-2 sm:space-y-3 pb-32">
              {sortedScripts.map(([scriptId, script], index) => (
                <ScriptListItem
                  key={scriptId}
                  ref={(el) => {
                    el ? scriptRefs.current.set(scriptId, el) : scriptRefs.current.delete(scriptId);
                  }}
                  scriptId={scriptId}
                  script={script}
                  isExpanded={expandedScripts.has(scriptId)}
                  animationComplete={animationComplete}
                  index={index}
                  fontClass={fontClass}
                  serifFontClass={serifFontClass}
                  t={t}
                  selectionMode={selectionMode}
                  isSelected={selectedScripts.has(scriptId)}
                  onToggleExpand={toggleScriptExpansion}
                  onEdit={(s) => {
                    if (isPresetView) return;
                    setEditingScript({ ...s, scriptKey: scriptId });
                  }}
                  onToggle={() => {
                    if (isPresetView || !currentOwnerId) return;
                    toggleScriptForOwner(currentOwnerId, scriptId, currentScripts);
                  }}
                  onDelete={() => {
                    if (isPresetView || !currentOwnerId) return;
                    deleteScriptForOwner(currentOwnerId, scriptId);
                  }}
                  onToggleSelection={handleToggleSelection}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 弹窗 */}
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
        characterId={currentOwnerId || characterId}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          setIsImportModalOpen(false);
          if (isGlobalView) reloadGlobals();
          else reload();
        }}
      />
    </div>
  );
}
