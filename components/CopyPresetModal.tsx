/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      Copy Preset Modal Component                           ║
 * ║                                                                            ║
 * ║  复制预设模态框 - 已迁移至 Radix UI Dialog                                   ║
 * ║  消除了重复的 backdrop 和 positioning 代码                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/app/i18n";
import { createPreset, getPreset } from "@/function/preset/global";
import { toast } from "@/lib/store/toast-store";
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

interface CopyPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sourcePresetId: string;
  sourcePresetName: string;
}

// ============================================================================
//                              主组件
// ============================================================================

export default function CopyPresetModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  sourcePresetId, 
  sourcePresetName, 
}: CopyPresetModalProps) {
  const { t, fontClass, serifFontClass } = useLanguage();
  const [presetName, setPresetName] = useState("");
  const [isCopying, setIsCopying] = useState(false);

  // ========== 初始化 ==========

  useEffect(() => {
    if (isOpen) {
      setPresetName(`${sourcePresetName} (Copy)`);
    }
  }, [isOpen, sourcePresetName]);

  // ========== 提交处理 ==========

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!presetName.trim()) {
      toast.error(t("preset.presetNameRequired"));
      return;
    }

    if (!sourcePresetId) {
      toast.error(t("preset.sourcePresetNotFound"));
      return;
    }

    setIsCopying(true);
    
    try {
      const sourceResult = await getPreset(sourcePresetId);
      
      if (!sourceResult.success || !sourceResult.data) {
        toast.error(t("preset.loadSourceFailed"));
        return;
      }

      const newPreset = {
        name: presetName.trim(),
        enabled: false,
        prompts: sourceResult.data.prompts || [],
      };

      const result = await createPreset(newPreset);
      if (result.success) {
        toast.success(t("preset.copySuccess"));
        onSuccess();
        handleOpenChange(false);
      } else {
        toast.error(t("preset.copyFailed"));
      }
    } catch (error) {
      console.error("Copy preset failed:", error);
      toast.error(t("preset.copyFailed"));
    } finally {
      setIsCopying(false);
    }
  };

  // ========== 表单重置 ==========

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPresetName("");
      setIsCopying(false);
      onClose();
    }
  };

  // ========== 渲染 ==========

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden  border-border gap-0">
        <div className="p-4 border-b border-border bg-gradient-to-r from-blue-500/5 to-transparent">
          <DialogHeader>
            <DialogTitle className={"text-lg font-medium text-cream-soft magical-text "}>
              <span className="">
                {t("preset.copyPreset")}
              </span>
            </DialogTitle>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className={`block text-sm font-medium text-ink-soft mb-2 ${fontClass}`}>
              {t("preset.sourcePreset")}
            </label>
            <div className="px-3 py-2 bg-muted-surface/50 text-ink-soft rounded-md border border-border/50 text-sm">
              {sourcePresetName}
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium text-ink-soft mb-2 ${fontClass}`}>
              {t("preset.newPresetName")}
            </label>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder={t("preset.newPresetNamePlaceholder")}
              disabled={isCopying}
              className={`w-full px-3 py-2 bg-gradient-to-br from-deep via-muted-surface to-deep 
                text-cream-soft rounded-md border border-border 
                focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 
                transition-all duration-300 hover:border-border backdrop-blur-sm
                 ${fontClass}
                disabled:opacity-50 disabled:cursor-not-allowed`}
              autoFocus
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCopying}
              className={`px-4 py-2 text-sm font-medium text-ink-soft hover:text-cream-soft 
                bg-gradient-to-br from-deep via-muted-surface to-deep 
                border border-border hover:border-border backdrop-blur-sm ${fontClass}`}
            >
              {t("preset.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isCopying || !presetName.trim()}
              className={`px-4 py-2 text-sm font-medium 
                bg-gradient-to-r from-ember to-coal 
                hover:from-ember hover:to-coal 
                text-sky hover:text-sky/80 
                border border-info ${fontClass}
                flex items-center`}
            >
              {isCopying && (
                <div className="w-4 h-4 mr-2 border-2 border-sky border-t-transparent rounded-full animate-spin"></div>
              )}
              {isCopying ? t("preset.copying") : t("preset.copy")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
