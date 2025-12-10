"use client";

import { useState, useEffect } from "react";
import { Check, RefreshCcw, X } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { setDisplayUsername, resetDisplayUsername } from "@/utils/username-helper";
import { getString } from "@/lib/storage/client-storage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UserNameSettingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDisplayName?: string;
  onSave: (newDisplayName: string) => void;
}

export default function UserNameSettingModal({ 
  isOpen, 
  onClose, 
  currentDisplayName = "",
  onSave, 
}: UserNameSettingModalProps) {
  const { t, fontClass, serifFontClass } = useLanguage();
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDisplayName(currentDisplayName);
    setError("");
  }, [currentDisplayName, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      setError(t("userNameSetting.nameRequired"));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Save the display name using helper function
      setDisplayUsername(displayName.trim());
      onSave(displayName.trim());
      onClose();
    } catch (err) {
      console.error("Save display name error:", err);
      setError(t("userNameSetting.saveFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    resetDisplayUsername();
    const loginUsername = getString("username", "");
    setDisplayName(loginUsername);
    setError("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className=" bg-opacity-75 border border-border rounded-md  p-4 sm:p-8 w-full max-w-sm sm:max-w-md backdrop-filter backdrop-blur-sm"
        hideCloseButton
      >
        <DialogTitle className="sr-only">{t("userNameSetting.title")}</DialogTitle>
        {/* ═══════════════════════════════════════════════════════════
            关闭按钮 - Close Button
            ═══════════════════════════════════════════════════════════ */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-4 sm:right-4"
        >
          <X className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
        
        {/* ═══════════════════════════════════════════════════════════
            头部标题 - Header Title
            ═══════════════════════════════════════════════════════════ */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-bright mb-2 font-cinzel">
            {t("userNameSetting.title")}
          </h1>
          <p className={`text-sm text-ink-soft ${fontClass}`}>
            {t("userNameSetting.description")}
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            错误提示 - Error Message
            ═══════════════════════════════════════════════════════════ */}
        {error && (
          <div className="text-red-400 text-xs sm:text-sm text-center mb-4 p-2 bg-red-900/20 rounded border border-red-500/20">
            {error}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            表单区域 - Form Section
            ═══════════════════════════════════════════════════════════ */}
        <form onSubmit={handleSubmit} className="w-full space-y-6">
          {/* 登录用户名显示 - Login Username Display */}
          <div>
            <label className={`block text-sm text-primary-soft mb-2 ${fontClass}`}>
              {t("userNameSetting.loginUsername")}
            </label>
            <div className="relative magical-input min-h-[50px] flex items-center justify-center bg-overlay/50 border border-border/50">
              <span className={"text-center text-sm text-text-muted "}>
                {typeof window !== "undefined"
                  ? getString("username", t("userNameSetting.notLoggedIn"))
                  : t("userNameSetting.notLoggedIn")}
              </span>
            </div>
          </div>

          {/* 显示名称输入 - Display Name Input */}
          <div>
            <label className={`block text-sm text-primary-soft mb-2 ${fontClass}`}>
              {t("userNameSetting.displayUsername")}
            </label>
            <div className="relative w-full group">
              <div className="relative magical-input min-h-[60px] flex items-center justify-center">
                <input
                  type="text"
                  placeholder={t("userNameSetting.displayNamePlaceholder")}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isLoading}
                  autoComplete="off"
                  className={"bg-transparent border-0 outline-none w-full text-center text-base text-cream-soft placeholder-ink-soft shadow-none focus:ring-0 focus:border-0 caret-[var(--color-primary-bright)] tracking-[0.05em] "}
                />
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-32 h-0.5 opacity-100 transition-opacity duration-300">
                  <div className="w-full h-full bg-gradient-to-r from-transparent via-primary-soft to-transparent"></div>
                </div>
              </div>
            </div>
          </div>

          {/* 操作按钮 - Action Buttons */}
          <div className="flex gap-3 justify-center items-center">
            <Button variant="outline" type="button" onClick={handleReset} disabled={isLoading}>
              <RefreshCcw className="h-3 w-3" />
              {t("userNameSetting.reset")}
            </Button>
            <Button type="submit" disabled={isLoading || !displayName.trim()}>
              {isLoading ? t("userNameSetting.saving") : t("userNameSetting.save")}
              {!isLoading && <Check className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {/* 帮助文本 - Helper Text */}
          <div className={`text-center mt-4 text-xs text-ink-soft ${fontClass}`}>
            <p>{t("userNameSetting.helperText")}</p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 
