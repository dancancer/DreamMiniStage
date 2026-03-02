/**
 * @input  @/lib, @/app, @/components, @/function, @/hooks
 * @output WorldBookEditor
 * @pos    世界书编辑器入口
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         WorldBookEditor                                    ║
 * ║  世界书编辑：列表/排序/筛选/展开 + 条目编辑/导入                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "@/lib/store/toast-store";
import { useLanguage } from "@/app/i18n";
import WorldBookEntryEditor from "@/components/WorldBookEntryEditor";
import ImportWorldBookModal from "@/components/ImportWorldBookModal";

import { getWorldBookEntries } from "@/function/worldbook/info";
import { deleteWorldBookEntry } from "@/function/worldbook/delete";
import { saveAdvancedWorldBookEntry } from "@/function/worldbook/edit";
import { bulkToggleWorldBookEntries } from "@/function/worldbook/bulk-operations";
import { useTableSort, sortItems } from "@/hooks/useTableSort";
import { useTableFilter, filterItems } from "@/hooks/useTableFilter";

import React, { memo } from "react";
import {
  WorldBookHeader,
  WorldBookControls,
  WorldBookTable,
  WorldBookEntryData,
  EditingEntry,
} from "@/components/worldbook-editor";

// ============================================================================
//                    Memo 包装：隔离表格与模态框状态
// ============================================================================

const MemoizedWorldBookTable = memo(WorldBookTable);

interface WorldBookEditorProps {
  onClose: () => void;
  characterName: string;
  characterId: string;
  /** 可选：对话键（用于会话级世界书） */
  dialogueKey?: string;
  /** 可选：初始层级（默认为 character） */
  initialBookLevel?: "character" | "dialogue" | "global";
  /** 可选：全局世界书键（用于编辑全局世界书） */
  globalKey?: string;
}

export default function WorldBookEditor({
  onClose,
  characterName,
  characterId,
  dialogueKey,
  initialBookLevel = "character",
  globalKey,
}: WorldBookEditorProps) {
  const { t, fontClass, serifFontClass } = useLanguage();
  const [entries, setEntries] = useState<WorldBookEntryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ════════════════════════════════════════════════════════════════════════
  // 层级管理（新增）
  // ════════════════════════════════════════════════════════════════════════
  const [bookLevel, setBookLevel] = useState<"character" | "dialogue" | "global">(
    initialBookLevel,
  );

  // 计算存储键（好品味：无 if-else）
  const storageKey = useMemo(() => {
    if (bookLevel === "global" && globalKey) return globalKey;
    if (bookLevel === "dialogue" && dialogueKey) return `dialogue:${dialogueKey}`;
    return `character:${characterId}`;
  }, [bookLevel, characterId, dialogueKey, globalKey]);

  const { sortBy, sortOrder, handleSortByChange, handleSortOrderToggle } = useTableSort({
    storageKey: `worldbook_sort_${characterId}`,
    defaultSortBy: "position",
    defaultSortOrder: "asc",
  });
  const { filterBy, handleFilterChange } = useTableFilter({
    storageKey: `worldbook_filter_${characterId}`,
    defaultFilter: "all",
  });

  const sortComparators = useMemo(
    () => ({
      position: (a: WorldBookEntryData, b: WorldBookEntryData) => Number(a.position ?? 4) - Number(b.position ?? 4),
      priority: (a: WorldBookEntryData, b: WorldBookEntryData) => a.insertion_order - b.insertion_order,
      characterCount: (a: WorldBookEntryData, b: WorldBookEntryData) => a.contentLength - b.contentLength,
      keywords: (a: WorldBookEntryData, b: WorldBookEntryData) => a.keyCount - b.keyCount,
      comment: (a: WorldBookEntryData, b: WorldBookEntryData) => (a.comment || "").localeCompare(b.comment || ""),
      depth: (a: WorldBookEntryData, b: WorldBookEntryData) => a.depth - b.depth,
      lastUpdated: (a: WorldBookEntryData, b: WorldBookEntryData) => a.lastUpdated - b.lastUpdated,
    }),
    [],
  );

  const filterMap = useMemo(
    () => ({
      all: () => true,
      enabled: (entry: WorldBookEntryData) => entry.isActive,
      disabled: (entry: WorldBookEntryData) => !entry.isActive,
      constant: (entry: WorldBookEntryData) => entry.constant,
      imported: (entry: WorldBookEntryData) => entry.isImported,
    }),
    [],
  );

  const formatEntry = useCallback(
    (entry: unknown): WorldBookEntryData => {
      // 运行时类型检查（好品味：防御性编程）
      if (typeof entry !== "object" || entry === null) {
        throw new Error("Invalid entry format");
      }

      const rawEntry = entry as Record<string, unknown>;
      const extensions = (rawEntry.extensions as Record<string, unknown>) || {};
      const keys = (Array.isArray(rawEntry.keys) ? rawEntry.keys : []) as string[];
      const secondaryKeys = (Array.isArray(rawEntry.secondary_keys) ? rawEntry.secondary_keys : []) as string[];
      const updated = extensions.updatedAt || rawEntry.updated_at || rawEntry.created_at || Date.now();

      return {
        ...rawEntry,
        keys,
        secondary_keys: secondaryKeys,
        primaryKey: keys[0] || t("worldBook.noKeyword"),
        keyCount: keys.length,
        secondaryKeyCount: secondaryKeys.length,
        contentLength: (String(rawEntry.content || "")).length,
        isActive: rawEntry.enabled !== false,
        lastUpdated: typeof updated === "number" ? updated : new Date(String(updated)).getTime(),
        isImported: Boolean(extensions.importedAt),
        importedAt: extensions.importedAt || null,
      } as WorldBookEntryData;
    },
    [t],
  );

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      // 使用 storageKey 而不是 characterId（支持多层级）
      const result = await getWorldBookEntries(storageKey);
      if (result.success) {
        setEntries((result.entries || []).map(formatEntry));
      } else {
        toast.error(t("worldBook.loadingFailed") || "Failed to load entries");
      }
    } catch (error) {
      console.error("Failed to load world book entries:", error);
      toast.error(t("worldBook.loadingFailed") || "Failed to load entries");
    } finally {
      setIsLoading(false);
    }
  }, [storageKey, formatEntry, t]);

  // ========== 使用 ref 稳定回调引用 ==========
  const entriesLengthRef = useRef(entries.length);
  entriesLengthRef.current = entries.length;

  const handleEditEntry = useCallback((entry?: WorldBookEntryData) => {
    if (entry) {
      setEditingEntry({
        entry_id: entry.entry_id,
        id: entry.id,
        comment: entry.comment || "",
        keys: entry.keys || [],
        secondary_keys: entry.secondary_keys || [],
        content: entry.content || "",
        position: Number(entry.position ?? 4),
        depth: entry.depth || 1,
        enabled: entry.enabled !== false,
        use_regex: entry.use_regex || false,
        selective: entry.selective || false,
        constant: entry.constant || false,
        insertion_order: entry.insertion_order || 0,
      });
    } else {
      setEditingEntry({
        entry_id: `entry_${uuidv4()}`,
        id: entriesLengthRef.current + 1,
        comment: "",
        keys: [""],
        secondary_keys: [],
        content: "",
        position: 4,
        depth: 1,
        enabled: true,
        use_regex: false,
        selective: false,
        constant: false,
        insertion_order: 0,
      });
    }
    setIsEditModalOpen(true);
  }, []);

  const handleSaveEntry = useCallback(async () => {
    if (!editingEntry) return;
    if (!editingEntry.content.trim()) {
      toast.error(t("worldBook.contentRequired") || "Content is required");
      return;
    }

    setIsSaving(true);
    try {
      // 使用 storageKey 而不是 characterId（支持多层级）
      await saveAdvancedWorldBookEntry(storageKey, {
        entry_id: editingEntry.entry_id,
        content: editingEntry.content,
        keys: editingEntry.keys.filter((k) => k.trim()),
        secondary_keys: editingEntry.secondary_keys.filter((k) => k.trim()),
        comment: editingEntry.comment,
        position: editingEntry.position,
        depth: editingEntry.depth,
        enabled: editingEntry.enabled,
        use_regex: editingEntry.use_regex,
        selective: editingEntry.selective,
        constant: editingEntry.constant,
        insertion_order: editingEntry.insertion_order,
      });
      toast.success(t("worldBook.saveSuccess") || "Saved");
      setIsEditModalOpen(false);
      setEditingEntry(null);
      await loadEntries();
    } catch (error) {
      console.error("Save failed:", error);
      toast.error(t("worldBook.saveFailed") || "Failed to save entry");
    } finally {
      setIsSaving(false);
    }
  }, [storageKey, editingEntry, loadEntries, t]);

  const handleDeleteEntry = useCallback(
    async (entryId: string) => {
      try {
        const result = await deleteWorldBookEntry(storageKey, entryId);
        if (result.success) {
          toast.success(t("worldBook.deleteSuccess"));
          setEntries((prev) => prev.filter((entry) => entry.entry_id !== entryId));
        }
      } catch (error) {
        console.error("Delete failed:", error);
        toast.error(t("worldBook.deleteFailed") || "Failed to delete entry");
      }
    },
    [storageKey, t],
  );

  const handleToggleEntry = useCallback(
    async (entryId: string, enabled: boolean) => {
      // 乐观更新：立即更新 UI
      setEntries((prev) => prev.map((entry) => (entry.entry_id === entryId ? { ...entry, isActive: enabled, enabled } : entry)));

      try {
        const result = await bulkToggleWorldBookEntries(storageKey, [entryId], enabled);
        if (result.success) {
          toast.success(enabled ? t("worldBook.enabled") : t("worldBook.disabled"));
          // 不需要重新加载全部数据，已经乐观更新了
        } else {
          // 失败时回滚
          setEntries((prev) => prev.map((entry) => (entry.entry_id === entryId ? { ...entry, isActive: !enabled, enabled: !enabled } : entry)));
          toast.error(t("worldBook.toggleFailed") || "Failed to toggle entry");
        }
      } catch (error) {
        // 失败时回滚
        setEntries((prev) => prev.map((entry) => (entry.entry_id === entryId ? { ...entry, isActive: !enabled, enabled: !enabled } : entry)));
        console.error("Toggle failed:", error);
        toast.error(t("worldBook.toggleFailed") || "Failed to toggle entry");
      }
    },
    [storageKey, t],
  );

  const handleBulkToggle = useCallback(
    async (enabled: boolean) => {
      const entryIds = filterItems(entries, filterBy, filterMap).map((entry) => entry.entry_id);
      if (entryIds.length === 0) {
        toast.error(t("worldBook.noEntries") || "No entries selected");
        return;
      }

      // 乐观更新：立即更新 UI
      setEntries((prev) =>
        prev.map((entry) => (entryIds.includes(entry.entry_id) ? { ...entry, isActive: enabled, enabled } : entry)),
      );

      try {
        const result = await bulkToggleWorldBookEntries(storageKey, entryIds, enabled);
        if (result.success) {
          toast.success(enabled ? t("worldBook.enabledAll") : t("worldBook.disabledAll"));
          // 不需要重新加载全部数据，已经乐观更新了
        } else {
          // 失败时回滚
          setEntries((prev) =>
            prev.map((entry) => (entryIds.includes(entry.entry_id) ? { ...entry, isActive: !enabled, enabled: !enabled } : entry)),
          );
          toast.error(t("worldBook.bulkOperationFailed") || "Bulk operation failed");
        }
      } catch (error) {
        // 失败时回滚
        setEntries((prev) =>
          prev.map((entry) => (entryIds.includes(entry.entry_id) ? { ...entry, isActive: !enabled, enabled: !enabled } : entry)),
        );
        console.error("Bulk toggle failed:", error);
        toast.error(t("worldBook.bulkOperationFailed") || "Bulk operation failed");
      }
    },
    [storageKey, entries, filterBy, filterMap, t],
  );

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // ========== 缓存过滤和排序结果 ==========
  
  const filteredEntries = useMemo(
    () => filterItems(entries, filterBy, filterMap),
    [entries, filterBy, filterMap],
  );
  
  const sortedEntries = useMemo(
    () => sortItems(filteredEntries, sortBy, sortOrder, sortComparators),
    [filteredEntries, sortBy, sortOrder, sortComparators],
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center ">
        <div className="flex flex-col items-center">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-t-primary-bright border-r-primary-soft border-b-ink-soft border-l-transparent animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-2 border-t-ink-soft border-r-primary-bright border-b-primary-soft border-l-transparent animate-spin-slow"></div>
          </div>
          <p className="mt-4 text-primary-soft magical-text">{t("worldBook.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col  text-cream-soft">
      <WorldBookHeader
        characterName={characterName}
        entries={entries}
        filteredCount={filteredEntries.length}
        filterBy={filterBy}
        fontClass={fontClass}
        serifFontClass={serifFontClass}
        t={t}
        onClose={onClose}
      />

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 层级选择器（仅在支持多层级时显示） */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {(dialogueKey || globalKey) && (
        <div className="px-6 py-3 border-b border-cream-soft/20 bg-cream-soft/5">
          <div className="flex items-center gap-3">
            <span className={`text-sm text-cream-soft/70 ${fontClass}`}>
              世界书层级：
            </span>
            <select
              value={bookLevel}
              onChange={(e) => setBookLevel(e.target.value as "character" | "dialogue" | "global")}
              className={`px-3 py-1.5 rounded bg-ink-soft/30 border border-cream-soft/20 text-cream-soft ${fontClass} hover:bg-ink-soft/40 transition-colors`}
            >
              <option value="character">角色级（所有会话共享）</option>
              {dialogueKey && <option value="dialogue">会话级（仅当前会话）</option>}
              {globalKey && <option value="global">全局级（编辑中）</option>}
            </select>
            <span className={`text-xs text-cream-soft/50 ${fontClass}`}>
              {bookLevel === "character" && "此层级的世界书在该角色的所有会话中生效"}
              {bookLevel === "dialogue" && "此层级的世界书仅在当前会话中生效"}
              {bookLevel === "global" && "此层级的世界书在所有会话中生效"}
            </span>
          </div>
        </div>
      )}

      <WorldBookControls
        sortBy={sortBy}
        sortOrder={sortOrder}
        filterBy={filterBy}
        canBulk={filteredEntries.length > 0}
        onCreate={() => handleEditEntry()}
        onImport={() => setIsImportModalOpen(true)}
        onSortByChange={handleSortByChange}
        onSortOrderToggle={handleSortOrderToggle}
        onFilterChange={handleFilterChange}
        onBulkToggle={handleBulkToggle}
        fontClass={fontClass}
        serifFontClass={serifFontClass}
        t={t}
      />

      <MemoizedWorldBookTable
        entries={sortedEntries}
        fontClass={fontClass}
        serifFontClass={serifFontClass}
        t={t}
        onToggleEntry={handleToggleEntry}
        onEdit={handleEditEntry}
        onDelete={handleDeleteEntry}
      />

      {isImportModalOpen && (
        <ImportWorldBookModal
          isOpen={isImportModalOpen}
          characterId={storageKey}
          onClose={() => setIsImportModalOpen(false)}
          onImportSuccess={() => {
            setIsImportModalOpen(false);
            loadEntries();
          }}
        />
      )}

      <WorldBookEntryEditor
        isOpen={isEditModalOpen}
        editingEntry={editingEntry}
        isSaving={isSaving}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingEntry(null);
        }}
        onSave={handleSaveEntry}
        onEntryChange={(entry) => setEditingEntry(entry)}
      />
    </div>
  );
}
