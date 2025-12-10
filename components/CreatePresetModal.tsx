/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Create Preset Modal Component                          ║
 * ║                                                                            ║
 * ║  创建预设模态框 - 已迁移至 Radix UI Dialog                                   ║
 * ║  统一的 Modal 实现，消除重复代码                                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState } from "react";
import { useLanguage } from "@/app/i18n";
import { createPreset } from "@/function/preset/global";
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

interface CreatePresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ============================================================================
//                              主组件
// ============================================================================

export default function CreatePresetModal({ isOpen, onClose, onSuccess }: CreatePresetModalProps) {
  const { t, fontClass, serifFontClass } = useLanguage();
  const [presetName, setPresetName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // ========== 提交处理 ==========

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!presetName.trim()) {
      toast.error(t("preset.presetNameRequired"));
      return;
    }

    setIsCreating(true);
    
    try {
      const newPreset = {
        name: presetName.trim(),
        enabled: true,
        prompts: [],
      };

      const result = await createPreset(newPreset);
      if (result.success) {
        toast.success(t("preset.createSuccess"));
        onSuccess();
        handleOpenChange(false);
      } else {
        toast.error(t("preset.createFailed"));
      }
    } catch (error) {
      console.error("Create preset failed:", error);
      toast.error(t("preset.createFailed"));
    } finally {
      setIsCreating(false);
    }
  };

  // ========== 表单重置 ==========

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPresetName("");
      setIsCreating(false);
      onClose();
    }
  };

  // ========== 渲染 ==========

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden  border-border gap-0">
        <div className="p-4 border-b border-border bg-gradient-to-r from-primary-500/5 to-transparent">
          <DialogHeader>
            <DialogTitle className={"text-lg font-medium text-cream-soft magical-text "}>
              <span className="">
                {t("preset.createPreset")}
              </span>
            </DialogTitle>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className={`block text-sm font-medium text-ink-soft mb-2 ${fontClass}`}>
              {t("preset.presetName")}
            </label>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder={t("preset.presetNamePlaceholder")}
              disabled={isCreating}
              className={`w-full px-3 py-2 bg-gradient-to-br from-deep via-muted-surface to-deep 
                text-cream-soft rounded-md border border-border 
                focus:border-primary-500/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 
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
              disabled={isCreating}
              className={`px-4 py-2 text-sm font-medium text-ink-soft hover:text-cream-soft 
                bg-gradient-to-br from-deep via-muted-surface to-deep 
                border border-border hover:border-border backdrop-blur-sm ${fontClass}`}
            >
              {t("preset.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isCreating || !presetName.trim()}
              className={`px-4 py-2 text-sm font-medium 
                bg-gradient-to-r from-ember to-coal 
                hover:from-muted-surface hover:to-ember 
                text-primary-soft hover:text-primary-soft 
                border border-border ${fontClass}
                flex items-center`}
            >
              {isCreating && (
                <div className="w-4 h-4 mr-2 border-2 border-primary-soft border-t-transparent rounded-full animate-spin"></div>
              )}
              {isCreating ? t("preset.creating") : t("preset.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
