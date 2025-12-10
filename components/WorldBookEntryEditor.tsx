/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   World Book Entry Editor Component                        ║
 * ║                                                                            ║
 * ║  世界书条目编辑器 - 已迁移至 Radix UI Dialog                                  ║
 * ║  关键词、内容编辑 + 全屏模式支持                                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useLanguage } from "@/app/i18n";
import { useState } from "react";
import { X, Plus, Maximize } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ============================================================================
//                              类型定义
// ============================================================================

interface EditingEntry {
  entry_id: string;
  id?: number;
  comment: string;
  keys: string[];
  secondary_keys: string[];
  content: string;
  position: number;
  depth: number;
  enabled: boolean;
  use_regex: boolean;
  selective: boolean;
  constant: boolean;
  insertion_order: number;
}

interface WorldBookEntryEditorProps {
  isOpen: boolean;
  editingEntry: EditingEntry | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  onEntryChange: (entry: EditingEntry) => void;
}

// ============================================================================
//                              主组件
// ============================================================================

export default function WorldBookEntryEditor({
  isOpen,
  editingEntry,
  isSaving,
  onClose,
  onSave,
  onEntryChange,
}: WorldBookEntryEditorProps) {
  const { t, fontClass, serifFontClass } = useLanguage();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ========== 关键词处理 ==========

  const handleKeywordChange = (index: number, value: string) => {
    if (!editingEntry) return;
    const newKeys = [...editingEntry.keys];
    newKeys[index] = value;
    onEntryChange({ ...editingEntry, keys: newKeys });
  };

  const handleRemoveKeyword = (index: number) => {
    if (!editingEntry) return;
    const newKeys = editingEntry.keys.filter((_, i) => i !== index);
    onEntryChange({ ...editingEntry, keys: newKeys });
  };

  const handleAddKeyword = () => {
    if (!editingEntry) return;
    onEntryChange({ ...editingEntry, keys: [...editingEntry.keys, ""] });
  };

  const handleSecondaryKeywordChange = (index: number, value: string) => {
    if (!editingEntry) return;
    const newKeys = [...editingEntry.secondary_keys];
    newKeys[index] = value;
    onEntryChange({ ...editingEntry, secondary_keys: newKeys });
  };

  const handleRemoveSecondaryKeyword = (index: number) => {
    if (!editingEntry) return;
    const newKeys = editingEntry.secondary_keys.filter((_, i) => i !== index);
    onEntryChange({ ...editingEntry, secondary_keys: newKeys });
  };

  const handleAddSecondaryKeyword = () => {
    if (!editingEntry) return;
    onEntryChange({ ...editingEntry, secondary_keys: [...editingEntry.secondary_keys, ""] });
  };

  // ========== 渲染 ==========

  return (
    <>
      <Dialog open={isOpen && !isFullscreen && !!editingEntry} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden  border-border gap-0 max-h-[85vh]">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-orange-500/5 pointer-events-none"></div>
          
          {editingEntry && (
            <>
              <div className="p-4 bg-muted-surface/90 border-b border-border/60 relative z-10">
                <DialogHeader>
                  <DialogTitle className={"text-lg font-semibold text-transparent  "}>
                    {editingEntry.id ? t("worldBook.editEntry") : t("worldBook.newEntry")}
                  </DialogTitle>
                </DialogHeader>
              </div>

              <div className="p-5 overflow-y-auto fantasy-scrollbar max-h-[calc(85vh-140px)] relative z-10">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={`block text-sm font-medium text-primary-soft ${fontClass}`}>
                        {t("worldBook.commentTitle")}
                      </label>
                      <input
                        type="text"
                        value={editingEntry.comment}
                        onChange={(e) => onEntryChange({ ...editingEntry, comment: e.target.value })}
                        className={`w-full bg-muted-surface/80 border border-border/60 rounded-md px-3 py-2.5 text-cream-soft focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300 backdrop-blur-sm ${fontClass}`}
                        placeholder={t("worldBook.commentPlaceholder")}
                      />
                    </div>
                
                    <div className="space-y-2">
                      <label className={`block text-sm font-medium text-primary-soft ${fontClass}`}>
                        {t("worldBook.insertionOrder")}
                      </label>
                      <input
                        type="number"
                        value={editingEntry.insertion_order}
                        onChange={(e) => onEntryChange({ ...editingEntry, insertion_order: Number(e.target.value) })}
                        className={`w-full bg-muted-surface/80 border border-border/60 rounded-md px-3 py-2.5 text-cream-soft focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300 backdrop-blur-sm ${fontClass}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className={`block text-sm font-medium text-primary-soft ${fontClass}`}>
                      {t("worldBook.primaryKeywords")}
                    </label>
                    <div className="space-y-2">
                      {editingEntry.keys.map((key, index) => (
                        <div key={index} className="flex items-center space-x-2 group">
                          <input
                            type="text"
                            value={key}
                            onChange={(e) => handleKeywordChange(index, e.target.value)}
                            className={`flex-1 bg-muted-surface/80 border border-border/60 rounded-md px-3 py-2.5 text-cream-soft focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300 backdrop-blur-sm ${fontClass}`}
                            placeholder={t("worldBook.keywordPlaceholder")}
                          />
                          {editingEntry.keys.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveKeyword(index)}
                              className="w-8 h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 opacity-0 group-hover:opacity-100"
                            >
                              <X size={14} />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        variant="link"
                        size="sm"
                        onClick={handleAddKeyword}
                        className={`text-primary-400 hover:text-primary-300 ${fontClass}`}
                      >
                        <Plus size={14} />
                        <span>{t("worldBook.addKeyword")}</span>
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className={`block text-sm font-medium text-primary-soft ${fontClass}`}>
                      {t("worldBook.secondaryKeywords")}
                    </label>
                    <div className="space-y-2">
                      {editingEntry.secondary_keys.map((key, index) => (
                        <div key={index} className="flex items-center space-x-2 group">
                          <input
                            type="text"
                            value={key}
                            onChange={(e) => handleSecondaryKeywordChange(index, e.target.value)}
                            className={`flex-1 bg-muted-surface/80 border border-border/60 rounded-md px-3 py-2.5 text-cream-soft focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 backdrop-blur-sm ${fontClass}`}
                            placeholder={t("worldBook.keywordPlaceholder")}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveSecondaryKeyword(index)}
                            className="w-8 h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 opacity-0 group-hover:opacity-100"
                          >
                            <X size={14} />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="link"
                        size="sm"
                        onClick={handleAddSecondaryKeyword}
                        className={`text-blue-400 hover:text-blue-300 ${fontClass}`}
                      >
                        <Plus size={14} />
                        <span>{t("worldBook.addKeyword")}</span>
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={`block text-sm font-medium text-primary-soft ${fontClass}`}>
                        {t("worldBook.position")}
                      </label>
                      <select
                        value={editingEntry.position}
                        onChange={(e) => onEntryChange({ ...editingEntry, position: Number(e.target.value) })}
                        className={`w-full bg-muted-surface/80 border border-border/60 rounded-md px-3 py-2.5 text-cream-soft focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300 backdrop-blur-sm ${fontClass}`}
                      >
                        <option value={0}>{t("worldBook.positionOptions.systemPromptStart")}</option>
                        <option value={1}>{t("worldBook.positionOptions.afterSystemPrompt")}</option>
                        <option value={2}>{t("worldBook.positionOptions.userMessageStart")}</option>
                        <option value={3}>{t("worldBook.positionOptions.afterResponseMode")}</option>
                        <option value={4}>{t("worldBook.positionOptions.basedOnDepth")}</option>
                      </select>
                    </div>
          
                    <div className="space-y-2">
                      <label className={`block text-sm font-medium text-primary-soft ${fontClass}`}>
                        {t("worldBook.depthLabel")}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={editingEntry.depth}
                        onChange={(e) => onEntryChange({ ...editingEntry, depth: Number(e.target.value) })}
                        className={`w-full bg-muted-surface/80 border border-border/60 rounded-md px-3 py-2.5 text-cream-soft focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300 backdrop-blur-sm ${fontClass}`}
                      />
                    </div>
                  </div>
              
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex items-center space-x-3 cursor-pointer p-3 rounded-md bg-muted-surface/40 border border-border/40 hover:bg-muted-surface/60 hover:border-border/60 transition-all duration-300 group ${fontClass}`}>
                      <input
                        type="checkbox"
                        checked={editingEntry.enabled}
                        onChange={(e) => onEntryChange({ ...editingEntry, enabled: e.target.checked })}
                        className="w-4 h-4 rounded border-border  text-primary-500 focus:ring-primary-500/50 focus:ring-2 transition-all duration-300"
                      />
                      <span className="text-sm text-cream-soft group-hover:text-primary-200 transition-colors duration-300">{t("worldBook.enabledLabel")}</span>
                    </label>
                
                    <label className={`flex items-center space-x-3 cursor-pointer p-3 rounded-md bg-muted-surface/40 border border-border/40 hover:bg-muted-surface/60 hover:border-border/60 transition-all duration-300 group ${fontClass}`}>
                      <input
                        type="checkbox"
                        checked={editingEntry.use_regex}
                        onChange={(e) => onEntryChange({ ...editingEntry, use_regex: e.target.checked })}
                        className="w-4 h-4 rounded border-border  text-blue-500 focus:ring-blue-500/50 focus:ring-2 transition-all duration-300"
                      />
                      <span className="text-sm text-cream-soft group-hover:text-blue-200 transition-colors duration-300">{t("worldBook.regexLabel")}</span>
                    </label>
                
                    <label className={`flex items-center space-x-3 cursor-pointer p-3 rounded-md bg-muted-surface/40 border border-border/40 hover:bg-muted-surface/60 hover:border-border/60 transition-all duration-300 group ${fontClass}`}>
                      <input
                        type="checkbox"
                        checked={editingEntry.selective}
                        onChange={(e) => onEntryChange({ ...editingEntry, selective: e.target.checked })}
                        className="w-4 h-4 rounded border-border  text-green-500 focus:ring-green-500/50 focus:ring-2 transition-all duration-300"
                      />
                      <span className="text-sm text-cream-soft group-hover:text-green-200 transition-colors duration-300">{t("worldBook.selectiveLabel")}</span>
                    </label>
                
                    <label className={`flex items-center space-x-3 cursor-pointer p-3 rounded-md bg-muted-surface/40 border border-border/40 hover:bg-muted-surface/60 hover:border-border/60 transition-all duration-300 group ${fontClass}`}>
                      <input
                        type="checkbox"
                        checked={editingEntry.constant}
                        onChange={(e) => onEntryChange({ ...editingEntry, constant: e.target.checked })}
                        className="w-4 h-4 rounded border-border  text-purple-500 focus:ring-purple-500/50 focus:ring-2 transition-all duration-300"
                      />
                      <span className="text-sm text-cream-soft group-hover:text-purple-200 transition-colors duration-300">{t("worldBook.constantLabel")}</span>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className={`block text-sm font-medium text-primary-soft ${fontClass}`}>
                        {t("worldBook.contentLabel")}
                      </label>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs text-ink-soft/70 bg-muted-surface/60 px-2 py-1 rounded-md ${fontClass}`}>
                          {editingEntry.content.length} {t("worldBook.characters")}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsFullscreen(true)}
                          className="w-7 h-7"
                          title={t("worldBook.fullscreenContent")}
                        >
                          <Maximize size={14} />
                        </Button>
                      </div>
                    </div>
                    <textarea
                      value={editingEntry.content}
                      onChange={(e) => onEntryChange({ ...editingEntry, content: e.target.value })}
                      className={`w-full h-36 bg-muted-surface/80 border border-border/60 rounded-md px-3 py-3 text-cream-soft focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300 resize-none fantasy-scrollbar backdrop-blur-sm ${fontClass}`}
                      placeholder={t("worldBook.contentPlaceholder")}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border/60 backdrop-blur-sm flex justify-end space-x-3 relative z-10">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  disabled={isSaving}
                  className={fontClass}
                >
                  {t("worldBook.cancel")}
                </Button>
                <Button
                  onClick={onSave}
                  disabled={isSaving}
                  className={fontClass}
                >
                  {isSaving ? t("worldBook.saving") : t("worldBook.save")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 全屏模式 */}
      <Dialog open={isFullscreen && !!editingEntry} onOpenChange={(open) => !open && setIsFullscreen(false)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden  border-border gap-0 h-[85vh]">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-orange-500/5 pointer-events-none"></div>
          
          <div className="p-4 bg-muted-surface/90 border-b border-border/60 relative z-10">
            <DialogHeader>
              <div className="flex items-center space-x-3">
                <DialogTitle className={"text-lg font-semibold text-transparent "}>
                  {t("worldBook.contentLabel")} - {editingEntry?.comment || t("worldBook.newEntry")}
                </DialogTitle>
                <span className={`text-sm text-ink-soft/70 bg-muted-surface/60 px-3 py-1.5 rounded-md ${fontClass}`}>
                  {editingEntry?.content.length || 0} {t("worldBook.characters")}
                </span>
              </div>
            </DialogHeader>
          </div>
          
          <div className="p-6 h-[calc(85vh-80px)] relative z-10">
            {editingEntry && (
              <textarea
                value={editingEntry.content}
                onChange={(e) => onEntryChange({ ...editingEntry, content: e.target.value })}
                className={`w-full h-full bg-muted-surface/80 border border-border/60 rounded-md px-4 py-4 text-cream-soft focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300 resize-none fantasy-scrollbar backdrop-blur-sm text-[16px] leading-[1.6] ${fontClass}`}
                placeholder={t("worldBook.contentPlaceholder")}
                autoFocus
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
