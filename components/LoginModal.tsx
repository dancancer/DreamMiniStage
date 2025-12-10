/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Login Modal Component                              ║
 * ║                                                                            ║
 * ║  访客登录界面 - 已迁移至 Radix UI Dialog                                     ║
 * ║  简化的登录流程，只需输入用户名                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { toast } from "@/lib/store/toast-store";
import { useLocalStorageBoolean, useLocalStorageString } from "@/hooks/useLocalStorage";
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

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
//                              主组件
// ============================================================================

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { t, serifFontClass } = useLanguage();
  const [guestName, setGuestName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setValue: setUsername } = useLocalStorageString("username", "");
  const { setValue: setUserId } = useLocalStorageString("userId", "");
  const { setValue: setEmail } = useLocalStorageString("email", "");
  const { setValue: setLoginMode } = useLocalStorageString("loginMode", "");
  const { setValue: setIsLoggedIn } = useLocalStorageBoolean("isLoggedIn", false);

  // ========== 表单重置 ==========

  const resetForm = () => {
    setGuestName("");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
      onClose();
    }
  };

  // ========== 输入渲染 ==========

  const renderInput = (
    type: "text",
    value: string,
    onChange: (value: string) => void,
    placeholder: string,
  ) => {
    return (
      <div className="relative w-full group">
        <div className="relative magical-input min-h-[60px] flex items-center justify-center">
          <input
            type={type}
            className={"bg-transparent border-0 outline-none w-full text-center text-base text-cream-soft placeholder-ink-soft shadow-none focus:ring-0 focus:border-0 caret-[var(--color-primary-bright)] tracking-[0.05em] "}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={isLoading}
            autoComplete="off"
          />
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-32 h-0.5 opacity-100 transition-opacity duration-300">
            <div className="w-full h-full bg-gradient-to-r from-transparent via-primary-soft to-transparent"></div>
          </div>
        </div>
      </div>
    );
  };

  // ========== 提交处理 ==========

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guest login mode - only requires a name
    if (!guestName.trim()) {
      toast.error(t("auth.nameRequired"));
      return;
    }

    setIsLoading(true);

    try {
      // Store guest data in localStorage
      setUsername(guestName.trim());
      setUserId(`guest_${Date.now()}`);
      setEmail("");
      setIsLoggedIn(true);
      setLoginMode("guest");

      handleOpenChange(false);
      window.location.reload();
    } catch (err) {
      console.error("Guest login error:", err);
      toast.error(t("auth.loginFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  // ========== 渲染 ==========

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden  border-border gap-0 ">
        <div className="p-4 sm:p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl sm:text-3xl font-bold text-primary-bright text-center magical-text font-cinzel">
              {t("auth.guestLogin")}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div>
              {renderInput(
                "text",
                guestName,
                setGuestName,
                t("auth.guestNamePlaceholder"),
              )}
            </div>

            <div className="text-center mt-8">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <span>{t("auth.entering")}</span>
                ) : (
                  <>
                    <span>{t("auth.enterAsGuest")}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
