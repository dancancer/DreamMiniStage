/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                       SessionDeleteModal                                  ║
 * ║                                                                           ║
 * ║  会话删除确认弹窗 - 二次确认删除操作                                          ║
 * ║  使用 Radix Dialog 原语实现确认流程                                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { SessionWithCharacter } from "@/types/session";
import { useLanguage } from "@/app/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SessionDeleteModalProps {
  session: SessionWithCharacter | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

const SessionDeleteModal: React.FC<SessionDeleteModalProps> = ({
  session,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const { t, fontClass } = useLanguage();

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md border-border">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <DialogTitle>{t("sessionDeleteModal.title")}</DialogTitle>
          </div>
        </DialogHeader>

        <div className={`text-sm text-ink-soft py-2 ${fontClass}`}>
          {t("sessionDeleteModal.message")}
        </div>

        {session && (
          <div className="bg-muted-surface rounded p-3 border border-border">
            <p className="text-cream-soft text-sm font-medium">
              {session.name}
            </p>
            <p className={`text-xs text-ink-soft mt-1 ${fontClass}`}>
              {session.characterName}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-text-muted hover:text-cream"
          >
            {t("sessionDeleteModal.cancel")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleConfirm}
            className="text-danger hover:text-danger/80 hover:bg-danger/10"
          >
            {t("sessionDeleteModal.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SessionDeleteModal;
