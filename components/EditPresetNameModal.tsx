/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   Edit Preset Name Modal Component                         ║
 * ║                                                                            ║
 * ║  编辑预设名称模态框 - 已迁移至 Radix UI Dialog                                ║
 * ║  统一的 Modal 实现，消除重复代码                                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/app/i18n";
import { PresetOperations } from "@/lib/data/roleplay/preset-operation";
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

interface EditPresetNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  presetId: string;
  currentName: string;
}

// ============================================================================
//                              主组件
// ============================================================================

export default function EditPresetNameModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  presetId, 
  currentName, 
}: EditPresetNameModalProps) {
  const { t, fontClass, serifFontClass } = useLanguage();
  const [presetName, setPresetName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // ========== 初始化 ==========

  useEffect(() => {
    if (isOpen) {
      setPresetName(currentName);
    }
  }, [isOpen, currentName]);

  // ========== 提交处理 ==========

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!presetName.trim()) {
      toast.error(t("preset.presetNameRequired"));
      return;
    }

    if (presetName.trim() === currentName) {
      toast.success(t("preset.nameNotChanged"));
      handleOpenChange(false);
      return;
    }

    setIsUpdating(true);
    
    try {
      const success = await PresetOperations.updatePreset(presetId, {
        name: presetName.trim(),
      });

      if (success) {
        toast.success(t("preset.nameUpdateSuccess"));
        onSuccess();
        handleOpenChange(false);
      } else {
        toast.error(t("preset.nameUpdateFailed"));
      }
    } catch (error) {
      console.error("Update preset name failed:", error);
      toast.error(t("preset.nameUpdateFailed"));
    } finally {
      setIsUpdating(false);
    }
  };

  // ========== 表单重置 ==========

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPresetName("");
      setIsUpdating(false);
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
                {t("preset.editPresetName")}
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
              disabled={isUpdating}
              className={`w-full px-3 py-2 bg-gradient-to-br from-deep via-muted-surface to-deep 
                text-cream-soft rounded-md border border-border 
                focus:border-primary-500/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 
                transition-all duration-300 hover:border-border backdrop-blur-sm
                 ${fontClass}
                disabled:opacity-50 disabled:cursor-not-allowed`}
              autoFocus
            />
            <p className={`mt-1 text-xs text-ink-soft/70 ${fontClass}`}>
              {t("preset.currentName")}: {currentName}
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isUpdating}
              className={fontClass}
            >
              {t("preset.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isUpdating || !presetName.trim() || presetName.trim() === currentName}
              className={fontClass}
            >
              {isUpdating ? t("preset.updating") : t("preset.update")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
