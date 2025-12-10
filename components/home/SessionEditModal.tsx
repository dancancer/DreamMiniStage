/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                        SessionEditModal                                   ║
 * ║                                                                           ║
 * ║  会话编辑弹窗 - 修改会话名称                                                 ║
 * ║  使用 Radix Dialog 原语，支持名称校验                                        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useState, useEffect } from "react";
import { SessionWithCharacter, isValidSessionName } from "@/types/session";
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

export interface SessionEditModalProps {
  session: SessionWithCharacter | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

const SessionEditModal: React.FC<SessionEditModalProps> = ({
  session,
  isOpen,
  onClose,
  onSave,
}) => {
  const { t, fontClass } = useLanguage();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  // 当弹窗打开或 session 变化时，重置表单
  useEffect(() => {
    if (isOpen && session) {
      setName(session.name);
      setError("");
    }
  }, [isOpen, session]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!isValidSessionName(trimmedName)) {
      setError(t("sessionEditModal.nameRequired"));
      return;
    }

    onSave(trimmedName);
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
          <DialogTitle>{t("sessionEditModal.title")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="session-name"
              className={`block text-sm font-medium text-primary-soft mb-2 ${fontClass}`}
            >
              {t("sessionEditModal.nameLabel")}
            </label>
            <input
              type="text"
              id="session-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder={t("sessionEditModal.namePlaceholder")}
              className={`w-full bg-muted-surface border border-border rounded p-3 text-cream-soft focus:outline-none focus:ring-1 focus:ring-primary-soft ${fontClass} fantasy-input`}
              autoFocus
            />
            {error && (
              <p className={`text-sm text-danger mt-1 ${fontClass}`}>
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-text-muted hover:text-cream"
            >
              {t("sessionEditModal.cancel")}
            </Button>
            <Button
              type="submit"
              variant="ghost"
              className="text-primary-400 hover:text-primary-300"
            >
              {t("sessionEditModal.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SessionEditModal;
