/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      Edit Prompt Modal Component                           ║
 * ║                                                                            ║
 * ║  提示词编辑模态框 - 已迁移至 Radix UI Dialog                                  ║
 * ║  预设提示词内容编辑 + 实时验证                                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useState, useEffect } from "react";
import { toast } from "@/lib/store/toast-store";
import { useLanguage } from "@/app/i18n";
import { updatePromptInPreset } from "@/function/preset/edit";
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

interface PresetPromptData {
  identifier: string;
  name: string;
  system_prompt?: boolean;
  enabled?: boolean;
  marker?: boolean;
  role?: string;
  content?: string;
  injection_position?: number;
  injection_depth?: number;
  forbid_overrides?: boolean;
  contentLength: number;
}

interface EditPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetId: string;
  prompt: PresetPromptData | null;
  onSave: () => void;
}

// ============================================================================
//                              主组件
// ============================================================================

const EditPromptModal = ({
  isOpen,
  onClose,
  presetId,
  prompt,
  onSave,
}: EditPromptModalProps) => {
  const { t, serifFontClass } = useLanguage();
  const [editedContent, setEditedContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // ========== 初始化 ==========

  useEffect(() => {
    if (isOpen && prompt) {
      setEditedContent(prompt.content || "");
    }
  }, [isOpen, prompt]);

  // ========== 保存处理 ==========

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updatePromptInPreset(presetId, prompt!.identifier, {
        content: editedContent,
      });
      if (result.success) {
        toast.success(t("preset.promptUpdateSuccess"));
        onSave();
        handleOpenChange(false);
      } else {
        toast.error(t("preset.promptUpdateFailed"));
      }
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast.error(t("preset.promptUpdateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  // ========== 表单重置 ==========

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setEditedContent("");
      setIsSaving(false);
      onClose();
    }
  };

  // ========== 渲染 ==========

  return (
    <Dialog open={isOpen && !!prompt} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden  border-border gap-0">
        <div className="p-6 border-b border-border">
          <DialogHeader>
            <DialogTitle className={"text-xl font-medium text-primary-soft magical-text "}>
              {t("preset.editPrompt")} - {prompt?.name || ""}
            </DialogTitle>
          </DialogHeader>
        </div>

        {prompt && (
          <div className="p-6">
            <div className="mb-4">
              <label htmlFor="promptContent" className="block text-sm font-medium text-ink-soft mb-2">
                {t("preset.promptContent")}
              </label>
              <textarea
                id="promptContent"
                className="w-full p-3 bg-muted-surface border border-border rounded-md text-cream-soft focus:outline-none focus:border-primary-500 h-40 resize-y fantasy-scrollbar"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSaving}
              >
                {t("preset.cancel")}
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditPromptModal;
