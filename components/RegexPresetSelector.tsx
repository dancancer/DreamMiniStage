/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    RegexPresetSelector Component                         ║
 * ║                                                                          ║
 * ║  正则预设选择器 - 保存、加载、删除预设配置                                   ║
 * ║  设计理念：简洁、直观、快速切换                                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, FolderOpen, Trash2, Plus, X } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { RegexPresetConfig } from "@/lib/models/regex-script-model";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/store/toast-store";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface RegexPresetSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePreset: (name: string, description?: string) => Promise<boolean>;
  onLoadPreset: (name: string) => Promise<RegexPresetConfig | null>;
  onApplyPreset: (name: string) => Promise<boolean>;
  onDeletePreset: (name: string) => Promise<boolean>;
  onListPresets: () => Promise<RegexPresetConfig[]>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

export default function RegexPresetSelector({
  isOpen,
  onClose,
  onSavePreset,
  onLoadPreset,
  onApplyPreset,
  onDeletePreset,
  onListPresets,
}: RegexPresetSelectorProps) {
  const { t, fontClass } = useLanguage();

  // 状态
  const [presets, setPresets] = useState<RegexPresetConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetDescription, setNewPresetDescription] = useState("");

  /* ─────────────────────────────────────────────────────────────────────────
     加载预设列表
     ───────────────────────────────────────────────────────────────────────── */
  
  const loadPresets = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await onListPresets();
      setPresets(list);
    } catch (error) {
      console.error("Error loading presets:", error);
      toast.error(t("regexPreset.loadError") || "Failed to load presets");
    } finally {
      setIsLoading(false);
    }
  }, [onListPresets, t]);

  useEffect(() => {
    if (isOpen) {
      loadPresets();
    }
  }, [isOpen, loadPresets]);

  /* ─────────────────────────────────────────────────────────────────────────
     保存预设
     ───────────────────────────────────────────────────────────────────────── */
  
  const handleSavePreset = useCallback(async () => {
    if (!newPresetName.trim()) {
      toast.error(t("regexPreset.nameRequired") || "Preset name is required");
      return;
    }

    const success = await onSavePreset(newPresetName.trim(), newPresetDescription.trim() || undefined);
    
    if (success) {
      toast.success(t("regexPreset.saved") || "Preset saved successfully");
      setShowSaveDialog(false);
      setNewPresetName("");
      setNewPresetDescription("");
      await loadPresets();
    } else {
      toast.error(t("regexPreset.saveError") || "Failed to save preset");
    }
  }, [newPresetName, newPresetDescription, onSavePreset, loadPresets, t]);

  /* ─────────────────────────────────────────────────────────────────────────
     应用预设
     ───────────────────────────────────────────────────────────────────────── */
  
  const handleApplyPreset = useCallback(async (name: string) => {
    const success = await onApplyPreset(name);
    
    if (success) {
      toast.success(t("regexPreset.applied") || "Preset applied successfully");
      onClose();
    } else {
      toast.error(t("regexPreset.applyError") || "Failed to apply preset");
    }
  }, [onApplyPreset, onClose, t]);

  /* ─────────────────────────────────────────────────────────────────────────
     删除预设
     ───────────────────────────────────────────────────────────────────────── */
  
  const handleDeletePreset = useCallback(async (name: string) => {
    if (!confirm(t("regexPreset.confirmDelete") || `Delete preset "${name}"?`)) {
      return;
    }

    const success = await onDeletePreset(name);
    
    if (success) {
      toast.success(t("regexPreset.deleted") || "Preset deleted successfully");
      await loadPresets();
    } else {
      toast.error(t("regexPreset.deleteError") || "Failed to delete preset");
    }
  }, [onDeletePreset, loadPresets, t]);

  /* ─────────────────────────────────────────────────────────────────────────
     渲染
     ───────────────────────────────────────────────────────────────────────── */

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
          主对话框
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={isOpen && !showSaveDialog} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-border gap-0">
          {/* 头部 */}
          <div className="p-5 border-b border-border/60 relative z-10">
            <DialogHeader>
              <DialogTitle className="text-lg text-cream-soft font-medium">
                {t("regexPreset.title") || "Regex Presets"}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* 内容区域 */}
          <div className="p-5 space-y-4">
            {/* 操作按钮 */}
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowSaveDialog(true)}
                className="shrink-0"
              >
                <Plus className="h-3 w-3 mr-2" />
                {t("regexPreset.saveNew") || "Save Current as Preset"}
              </Button>
            </div>

            {/* 预设列表 */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
              </div>
            ) : presets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-ink-soft">
                <FolderOpen className="h-12 w-12 mb-3 opacity-50" />
                <p className={`text-sm ${fontClass}`}>
                  {t("regexPreset.noPresets") || "No presets saved yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {presets.map((preset) => (
                  <PresetCard
                    key={preset.name}
                    preset={preset}
                    onApply={handleApplyPreset}
                    onDelete={handleDeletePreset}
                    fontClass={fontClass}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          保存预设对话框
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-border gap-0">
          {/* 头部 */}
          <div className="p-5 border-b border-border/60 relative z-10">
            <DialogHeader>
              <DialogTitle className="text-lg text-cream-soft font-medium">
                {t("regexPreset.saveNew") || "Save New Preset"}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* 表单 */}
          <div className="p-5 space-y-4">
            <div>
              <label className={`block text-xs text-ink-soft mb-1.5 font-medium ${fontClass}`}>
                {t("regexPreset.name") || "Preset Name"} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder={t("regexPreset.namePlaceholder") || "Enter preset name..."}
                className="w-full px-3 py-2 bg-linear-to-br from-deep to-muted-surface border border-border/60 rounded-md text-cream 
                  focus:border-primary-500/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-300
                  placeholder-ink-soft/70 hover:border-border text-sm"
              />
            </div>

            <div>
              <label className={`block text-xs text-ink-soft mb-1.5 font-medium ${fontClass}`}>
                {t("regexPreset.description") || "Description"} <span className="text-ink-soft text-2xs">({t("regexPreset.optional") || "optional"})</span>
              </label>
              <textarea
                value={newPresetDescription}
                onChange={(e) => setNewPresetDescription(e.target.value)}
                placeholder={t("regexPreset.descriptionPlaceholder") || "Enter description..."}
                className="w-full h-20 px-3 py-2 bg-linear-to-br from-deep to-muted-surface border border-border/60 rounded-md text-cream 
                  focus:border-primary-500/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-300
                  placeholder-ink-soft/70 hover:border-border text-sm resize-none"
              />
            </div>

            {/* 按钮 */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border/30">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSaveDialog(false);
                  setNewPresetName("");
                  setNewPresetDescription("");
                }}
              >
                {t("regexPreset.cancel") || "Cancel"}
              </Button>
              <Button onClick={handleSavePreset}>
                <Save className="h-3 w-3 mr-2" />
                {t("regexPreset.save") || "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   子组件：预设卡片
   ═══════════════════════════════════════════════════════════════════════════ */

interface PresetCardProps {
  preset: RegexPresetConfig;
  onApply: (name: string) => void;
  onDelete: (name: string) => void;
  fontClass: string;
  t: (key: string) => string;
}

function PresetCard({ preset, onApply, onDelete, fontClass, t }: PresetCardProps) {
  const enabledCount = Object.values(preset.scriptStates).filter(Boolean).length;
  const totalCount = Object.keys(preset.scriptStates).length;
  
  return (
    <div className="rounded-md border border-border/50 bg-muted-surface/30 p-3 hover:border-primary-500/30 hover:bg-primary-500/5 transition-all duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-cream-soft truncate">
            {preset.name}
          </h4>
          {preset.description && (
            <p className={`text-xs text-ink-soft mt-1 ${fontClass}`}>
              {preset.description}
            </p>
          )}
          <div className={`text-2xs text-ink-soft mt-2 flex items-center gap-2 ${fontClass}`}>
            <span>
              {enabledCount} / {totalCount} {t("regexPreset.scriptsEnabled") || "scripts enabled"}
            </span>
            <span>•</span>
            <span>
              {new Date(preset.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onApply(preset.name)}
            className="h-auto px-2 py-1 text-xs"
          >
            <FolderOpen className="h-3 w-3 mr-1" />
            {t("regexPreset.apply") || "Apply"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(preset.name)}
            className="h-auto px-2 py-1 text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
