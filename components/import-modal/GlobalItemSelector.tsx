/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                       Global Item Selector                                ║
 * ║                                                                          ║
 * ║  通用全局资源选择器（世界书/正则脚本）                                        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

export interface GlobalItem {
  id: string;
  name: string;
  description?: string;
  count: number;
  createdAt: string;
  sourceCharacterName?: string;
}

interface GlobalItemSelectorProps {
  items: GlobalItem[];
  selectedId: string;
  isLoading: boolean;
  deletingId: string | null;
  emptyTitle: string;
  emptyHint: string;
  selectLabel: string;
  loadingText: string;
  deleteTitle: string;
  serifFontClass: string;
  onSelect: (id: string) => void;
  onDelete: (id: string, event: React.MouseEvent) => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   加载状态
   ═══════════════════════════════════════════════════════════════════════════ */

function LoadingState({ text, serifFontClass }: { text: string; serifFontClass: string }) {
  return (
    <div className="flex items-center justify-center py-6">
      <div className="flex items-center space-x-2">
        <div className="relative">
          <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <div className="absolute inset-0 w-4 h-4 border-2 border-transparent border-r-blue-400 rounded-full animate-spin animate-reverse" />
        </div>
        <span className={"text-ink-soft text-sm "}>{text}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   空状态
   ═══════════════════════════════════════════════════════════════════════════ */

function EmptyState({ title, hint, serifFontClass }: { title: string; hint: string; serifFontClass: string }) {
  return (
    <div className="text-center py-6">
      <div className="relative inline-block">
        <FileText className="mx-auto mb-3 h-8 w-8 text-ink-soft/50" strokeWidth={1} />
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-blue-400/50 to-blue-600/50 rounded-full animate-pulse" />
      </div>
      <p className={"text-ink-soft text-sm "}>{title}</p>
      <p className="text-ink-soft/70 text-xs mt-1">{hint}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   单个项目
   ═══════════════════════════════════════════════════════════════════════════ */

interface ItemCardProps {
  item: GlobalItem;
  isSelected: boolean;
  isDeleting: boolean;
  deleteTitle: string;
  serifFontClass: string;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function ItemCard({ item, isSelected, isDeleting, deleteTitle, serifFontClass, onSelect, onDelete }: ItemCardProps) {
  return (
    <label
      className={`relative block p-2.5 border rounded-md cursor-pointer transition-all duration-300 group ${
        isSelected
          ? "border-blue-500/60 bg-gradient-to-br from-blue-500/10 via-blue-400/5 to-blue-500/10  shadow-blue-500/10"
          : "border-border/60 hover:border-border/80 hover:bg-muted-surface/30"
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <input type="radio" value={item.id} checked={isSelected} onChange={onSelect} className="sr-only" />
      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h4 className={"text-cream-soft font-medium text-sm truncate "}>{item.name}</h4>
          {item.description && <p className="text-ink-soft text-xs mt-0.5 line-clamp-2">{item.description}</p>}
          <div className="flex items-center space-x-3 mt-1.5 text-xs text-ink-soft/80">
            <span className="flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-400/60 rounded-full mr-1" />
              {item.count}
            </span>
            <span className="flex items-center">
              <span className="w-1.5 h-1.5 bg-primary-400/60 rounded-full mr-1" />
              {new Date(item.createdAt).toLocaleDateString()}
            </span>
            {item.sourceCharacterName && (
              <span className="flex items-center truncate">
                <span className="w-1.5 h-1.5 bg-green-400/60 rounded-full mr-1" />
                <span className="truncate">{item.sourceCharacterName}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={isDeleting}
            className="w-6 h-6 text-ink-soft/70 hover:text-red-400 group-hover:opacity-100 opacity-0"
            title={deleteTitle}
          >
            {isDeleting ? (
              <div className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
          <div className={`relative w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
            isSelected
              ? "border-blue-500 bg-gradient-to-br from-blue-500 to-blue-600  shadow-blue-500/30"
              : "border-border group-hover:border-border"
          }`}>
            {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
          </div>
        </div>
      </div>
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

export function GlobalItemSelector({
  items,
  selectedId,
  isLoading,
  deletingId,
  emptyTitle,
  emptyHint,
  selectLabel,
  loadingText,
  deleteTitle,
  serifFontClass,
  onSelect,
  onDelete,
}: GlobalItemSelectorProps) {
  if (isLoading) {
    return <LoadingState text={loadingText} serifFontClass={serifFontClass} />;
  }

  if (items.length === 0) {
    return <EmptyState title={emptyTitle} hint={emptyHint} serifFontClass={serifFontClass} />;
  }

  return (
    <div className="space-y-2">
      <h3 className={"text-xs font-medium text-ink-soft mb-2 "}>{selectLabel}</h3>
      <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin scrollbar-track-deep scrollbar-thumb-ink">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            isSelected={selectedId === item.id}
            isDeleting={deletingId === item.id}
            deleteTitle={deleteTitle}
            serifFontClass={serifFontClass}
            onSelect={() => onSelect(item.id)}
            onDelete={(e) => onDelete(item.id, e)}
          />
        ))}
      </div>
    </div>
  );
}
