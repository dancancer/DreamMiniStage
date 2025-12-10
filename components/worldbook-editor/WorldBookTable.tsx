/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       WorldBookTable                                       ║
 * ║  世界书条目表格 - 高性能版本                                                 ║
 * ║                                                                            ║
 * ║  核心优化策略：                                                             ║
 * ║  1. 展开状态内部管理，避免父组件重渲染                                        ║
 * ║  2. 使用 useCallback + entry_id 稳定回调引用                                ║
 * ║  3. 分批渲染大数据量                                                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { memo, useState, useEffect, useCallback, useMemo } from "react";
import { ChevronRight, Edit3, Trash2 } from "lucide-react";
import { WorldBookEntryData } from "./index";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

// ============================================================================
//                              类型定义
// ============================================================================

interface WorldBookTableProps {
  entries: WorldBookEntryData[];
  fontClass: string;
  serifFontClass: string;
  t: (key: string) => string;
  onToggleEntry: (entryId: string, enabled: boolean) => void;
  onEdit: (entry: WorldBookEntryData) => void;
  onDelete: (entryId: string) => void;
}

// ============================================================================
//                              配置常量
// ============================================================================

const BATCH_SIZE = 50;
const BATCH_DELAY = 16;

// ============================================================================
//                              主组件
// ============================================================================

export function WorldBookTable({
  entries,
  fontClass,
  serifFontClass,
  t,
  onToggleEntry,
  onEdit,
  onDelete,
}: WorldBookTableProps) {
  // ========== 展开状态内部管理 ==========
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // ========== 分批渲染 ==========
  const [renderedCount, setRenderedCount] = useState(BATCH_SIZE);

  useEffect(() => {
    if (entries.length <= BATCH_SIZE) {
      setRenderedCount(entries.length);
      return;
    }
    if (renderedCount >= entries.length) return;

    const timer = setTimeout(() => {
      setRenderedCount((prev) => Math.min(prev + BATCH_SIZE, entries.length));
    }, BATCH_DELAY);

    return () => clearTimeout(timer);
  }, [entries.length, renderedCount]);

  useEffect(() => {
    setRenderedCount(Math.min(BATCH_SIZE, entries.length));
  }, [entries.length]);

  // ========== 稳定的回调函数 ==========
  const handleToggleRow = useCallback((entryId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  // ========== 计算可见条目 ==========
  const visibleEntries = useMemo(
    () => entries.slice(0, renderedCount),
    [entries, renderedCount],
  );

  const hasMore = renderedCount < entries.length;

  return (
    <div className="h-full overflow-y-auto fantasy-scrollbar pb-15">
      <table className="w-full table-fixed">
        <TableHeader fontClass={fontClass} t={t} />
        <tbody>
          {visibleEntries.map((entry) => (
            <MemoizedTableRow
              key={entry.entry_id}
              entry={entry}
              isExpanded={expandedRows.has(entry.entry_id)}
              fontClass={fontClass}
              t={t}
              onToggleRow={handleToggleRow}
              onToggleEntry={onToggleEntry}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
          {hasMore && <LoadingRow renderedCount={renderedCount} total={entries.length} />}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
//                              表头组件
// ============================================================================

const TableHeader = memo(function TableHeader({
  fontClass,
  t,
}: {
  fontClass: string;
  t: (key: string) => string;
}) {
  return (
    <thead className="sticky top-0 bg-muted-surface border-b border-border z-10">
      <tr>
        <th className={`w-10 sm:w-12 p-1.5 sm:p-3 text-left text-2xs sm:text-xs font-medium text-ink-soft uppercase tracking-wider whitespace-nowrap ${fontClass}`}>
          {t("worldBook.status")}
        </th>
        <th className={`w-32 sm:w-48 p-1.5 sm:p-3 text-left text-2xs sm:text-xs font-medium text-ink-soft uppercase tracking-wider whitespace-nowrap ${fontClass}`}>
          {t("worldBook.keyword")}
        </th>
        <th className={`w-10 sm:w-12 p-1.5 sm:p-3 text-left text-2xs sm:text-xs font-medium text-ink-soft uppercase tracking-wider whitespace-nowrap ${fontClass}`}>
          {t("worldBook.position")}
        </th>
        <th className={`w-10 sm:w-12 p-1.5 sm:p-3 text-left text-2xs sm:text-xs font-medium text-ink-soft uppercase tracking-wider whitespace-nowrap ${fontClass}`}>
          {t("worldBook.depth")}
        </th>
        <th className={`w-10 sm:w-12 p-1.5 sm:p-3 text-left text-2xs sm:text-xs font-medium text-ink-soft uppercase tracking-wider whitespace-nowrap ${fontClass}`}>
          {t("worldBook.length")}
        </th>
        <th className={`w-10 sm:w-12 p-1.5 sm:p-3 text-left text-2xs sm:text-xs font-medium text-ink-soft uppercase tracking-wider whitespace-nowrap ${fontClass}`}>
          {t("worldBook.actions")}
        </th>
      </tr>
    </thead>
  );
});

// ============================================================================
//                              加载指示器
// ============================================================================

const LoadingRow = memo(function LoadingRow({
  renderedCount,
  total,
}: {
  renderedCount: number;
  total: number;
}) {
  return (
    <tr>
      <td colSpan={6} className="p-4 text-center">
        <div className="flex items-center justify-center space-x-2 text-ink-soft text-xs">
          <div className="w-3 h-3 border-2 border-t-primary-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
          <span>加载中... ({renderedCount} / {total})</span>
        </div>
      </td>
    </tr>
  );
});

// ============================================================================
//                              表格行组件
// ============================================================================

interface TableRowProps {
  entry: WorldBookEntryData;
  isExpanded: boolean;
  fontClass: string;
  t: (key: string) => string;
  onToggleRow: (entryId: string) => void;
  onToggleEntry: (entryId: string, enabled: boolean) => void;
  onEdit: (entry: WorldBookEntryData) => void;
  onDelete: (entryId: string) => void;
}

const MemoizedTableRow = memo(
  function TableRow({
    entry,
    isExpanded,
    fontClass,
    t,
    onToggleRow,
    onToggleEntry,
    onEdit,
    onDelete,
  }: TableRowProps) {
    // 使用 entry_id 创建稳定的回调
    const handleToggle = useCallback(() => {
      onToggleEntry(entry.entry_id, !entry.isActive);
    }, [entry.entry_id, entry.isActive, onToggleEntry]);

    const handleExpand = useCallback(() => {
      onToggleRow(entry.entry_id);
    }, [entry.entry_id, onToggleRow]);

    const handleEdit = useCallback(() => {
      onEdit(entry);
    }, [entry, onEdit]);

    const handleDelete = useCallback(() => {
      onDelete(entry.entry_id);
    }, [entry.entry_id, onDelete]);

    return (
      <React.Fragment>
        <tr className="border-b border-border hover:bg-muted-surface transition-all duration-300 group">
          <td className="p-1.5 sm:p-3">
            <ToggleSwitch isActive={entry.isActive} onToggle={handleToggle} t={t} />
          </td>
          <td className="p-1.5 sm:p-3 text-xs sm:text-sm text-cream-soft max-w-xs">
            <KeywordCell
              entry={entry}
              isExpanded={isExpanded}
              onExpand={handleExpand}
              t={t}
            />
          </td>
          <td className="p-1.5 sm:p-3 text-xs sm:text-sm text-primary-soft">
            {getPositionText(entry.position, t)}
          </td>
          <td className="p-1.5 sm:p-3 text-xs sm:text-sm text-primary-soft">{entry.depth}</td>
          <td className="p-1.5 sm:p-3 text-xs sm:text-sm text-primary-soft">{entry.contentLength}</td>
          <td className="p-1.5 sm:p-3">
            <ActionButtons onEdit={handleEdit} onDelete={handleDelete} t={t} />
          </td>
        </tr>
        {isExpanded && <ExpandedRow entry={entry} fontClass={fontClass} t={t} />}
      </React.Fragment>
    );
  },
  // 自定义比较函数：只比较关键 props
  (prev, next) => {
    return (
      prev.entry.entry_id === next.entry.entry_id &&
      prev.entry.isActive === next.entry.isActive &&
      prev.entry.primaryKey === next.entry.primaryKey &&
      prev.entry.contentLength === next.entry.contentLength &&
      prev.entry.depth === next.entry.depth &&
      prev.entry.position === next.entry.position &&
      prev.entry.constant === next.entry.constant &&
      prev.entry.selective === next.entry.selective &&
      prev.entry.use_regex === next.entry.use_regex &&
      prev.isExpanded === next.isExpanded
    );
  },
);

// ============================================================================
//                              子组件：开关
// ============================================================================

const ToggleSwitch = memo(function ToggleSwitch({
  isActive,
  onToggle,
  t,
}: {
  isActive: boolean;
  onToggle: () => void;
  t: (key: string) => string;
}) {
  return (
    <Switch
      checked={isActive}
      onCheckedChange={onToggle}
      title={isActive ? t("worldBook.disable") : t("worldBook.enable")}
    />
  );
});

// ============================================================================
//                              子组件：关键词单元格
// ============================================================================

const KeywordCell = memo(function KeywordCell({
  entry,
  isExpanded,
  onExpand,
  t,
}: {
  entry: WorldBookEntryData;
  isExpanded: boolean;
  onExpand: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 max-w-full">
      <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 max-w-full min-w-0">
        <Badge>
          {entry.primaryKey || t("worldBook.noKeyword")}
        </Badge>
        {entry.constant && (
          <Badge variant="info">
            {t("worldBook.constant")}
          </Badge>
        )}
        {entry.selective && (
          <Badge variant="success">
            {t("worldBook.selective")}
          </Badge>
        )}
        {entry.use_regex && (
          <Badge variant="primary">
            regex
          </Badge>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onExpand}
        className="w-5 h-5 sm:w-6 sm:h-6"
        title={isExpanded ? t("worldBook.collapse") : t("worldBook.expand")}
      >
        <ChevronRight className={`w-2.5 h-2.5 ${isExpanded ? "rotate-90" : ""}`} />
      </Button>
    </div>
  );
});

// ============================================================================
//                              子组件：操作按钮
// ============================================================================

const ActionButtons = memo(function ActionButtons({
  onEdit,
  onDelete,
  t,
}: {
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-center space-x-0.5 sm:space-x-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={onEdit}
        className="w-5 h-5 sm:w-6 sm:h-6"
        title={t("worldBook.edit")}
      >
        <Edit3 className="w-2.5 h-2.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="w-5 h-5 sm:w-6 sm:h-6 text-red-400 hover:text-red-300"
        title={t("worldBook.delete")}
      >
        <Trash2 className="w-2.5 h-2.5" />
      </Button>
    </div>
  );
});

// ============================================================================
//                              子组件：展开行
// ============================================================================

const ExpandedRow = memo(function ExpandedRow({
  entry,
  fontClass,
  t,
}: {
  entry: WorldBookEntryData;
  fontClass: string;
  t: (key: string) => string;
}) {
  return (
    <tr className="border-b border-border bg-gradient-to-b from-deep to-coal transition-all duration-300">
      <td colSpan={6} className="p-2 sm:p-4">
        <div className="space-y-2 sm:space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-2xs sm:text-xs text-ink-soft">
            <span>{t("worldBook.secondaryKeys")}: {entry.secondaryKeyCount}</span>
            <span>{t("worldBook.keywords")}: {entry.keyCount}</span>
            <span>{t("worldBook.updatedAt")}: {new Date(entry.lastUpdated).toLocaleDateString()}</span>
          </div>
          {entry.comment && (
            <div className="text-ink-soft text-2xs sm:text-xs bg-overlay/40 border border-border rounded p-2 sm:p-3">
              {entry.comment}
            </div>
          )}
          <p className={`text-2xs sm:text-xs text-cream-soft leading-relaxed ${fontClass} whitespace-pre-line`}>
            {entry.content.slice(0, 800)}
            {entry.content.length > 800 ? "..." : ""}
          </p>
        </div>
      </td>
    </tr>
  );
});

// ============================================================================
//                              工具函数
// ============================================================================

function getPositionText(position: string | number, t: (key: string) => string) {
  const map: Record<string | number, string> = {
    0: t("worldBook.positionOptions.systemPromptStart"),
    1: t("worldBook.positionOptions.afterSystemPrompt"),
    2: t("worldBook.positionOptions.userMessageStart"),
    3: t("worldBook.positionOptions.afterResponseMode"),
    4: t("worldBook.positionOptions.basedOnDepth"),
  };
  return map[position] || t("worldBook.positionOptions.basedOnDepth");
}
