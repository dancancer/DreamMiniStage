"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, Copy, LogOut, X } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/lib/store/toast-store";
import { useLocalStorageString } from "@/hooks/useLocalStorage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AccountModal({ isOpen, onClose }: AccountModalProps) {
  const { t, fontClass, serifFontClass } = useLanguage();
  const { user, logout, isAuthenticated, updateUsername } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState(user?.username || "");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (user?.username) {
      setEditedUsername(user.username);
    }
  }, [user?.username]);

  const handleSaveUsername = async () => {
    if (!editedUsername.trim()) {
      toast.error(t("account.usernameRequired"));
      return;
    }
    
    if (editedUsername.trim().length < 3 || editedUsername.trim().length > 30) {
      toast.error(t("account.usernameLength"));
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await updateUsername(editedUsername.trim());
      
      if (result.success) {
        setSuccessMessage(t("account.usernameUpdated"));
        setIsEditing(false);
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage("");
        }, 3000);
      } else {
        toast.error(result.message || t("account.updateFailed"));
      }
    } catch (error) {
      console.error("Failed to update username:", error);
      toast.error(t("account.updateFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const { value: loginMode } = useLocalStorageString("loginMode", "");
  const isGuest = loginMode === "guest";

  if (!isAuthenticated || !user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="relative w-full max-w-md bg-gradient-to-br from-canvas via-surface to-canvas rounded-2xl border border-muted-surface/50 overflow-hidden p-0"
        hideCloseButton
      >
        <DialogTitle className="sr-only">{t("account.title")}</DialogTitle>
        {/* ═══════════════════════════════════════════════════════════
            动画背景 - Animated Background
            ═══════════════════════════════════════════════════════════ */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-purple-500/5 opacity-60" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f59e0b' fill-opacity='0.03'%3E%3Cpath d='M30 30l30-30v60L30 30z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20" />
        
        {/* ═══════════════════════════════════════════════════════════
            头部区域 - Header Section
            ═══════════════════════════════════════════════════════════ */}
        <div className="relative p-6 pb-4">
          {/* 关闭按钮 - Close Button */}
          <Button 
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 text-text-muted hover:text-cream hover:bg-white/5"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          
          <h2 className={"text-xl font-bold text-cream mb-2 "}>
            {t("account.title")}
          </h2>
          
          {isGuest && (
            <div className="flex items-center gap-2 text-xs text-primary-400/80">
              <div className="w-2 h-2 rounded-full bg-primary-400/60"></div>
              <span className={fontClass}>{t("account.guestMode")}</span>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            头像和用户信息 - Avatar and User Info
            ═══════════════════════════════════════════════════════════ */}
        <div className="relative px-6 pb-6">
          <div className="flex items-start gap-4">
            {/* 用户头像 - User Avatar */}
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 via-primary-500 to-orange-500 p-[2px] ">
                <div className="w-full h-full rounded-full bg-canvas flex items-center justify-center text-2xl font-bold text-primary-300">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              </div>
              
              {/* 在线状态指示器 - Online Indicator */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-canvas p-1">
                <div className="w-full h-full rounded-full bg-green-500"></div>
              </div>
            </div>

            {/* 用户详细信息 - User Details */}
            <div className="flex-1 pt-2">
              {/* 用户名 - Username */}
              <div className="mb-3">
                <label className={`block text-xs font-medium text-ink-soft mb-2 ${fontClass}`}>
                  {t("account.username")}
                </label>
                {isEditing ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editedUsername}
                        onChange={(e) => setEditedUsername(e.target.value)}
                        className="flex-1 bg-input border border-muted-surface rounded-md px-3 py-2 text-cream text-sm focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveUsername}
                        disabled={isLoading || !editedUsername.trim()}
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs"
                      >
                        {isLoading ? "..." : "✓"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setIsEditing(false);
                          setEditedUsername(user.username);
                        }}
                        className="px-3 py-2 bg-muted-surface hover:bg-stroke-strong text-text text-xs"
                      >
                        ✕
                      </Button>
                    </div>
                    
                    {/* 成功消息 - Success Message */}
                    {successMessage && (
                      <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{successMessage}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between group">
                    <span className={`text-cream font-medium ${fontClass}`}>
                      {user.username}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs text-text-muted hover:text-primary-400"
                    >
                      {t("account.edit")}
                    </Button>
                  </div>
                )}
              </div>

              {/* 邮箱 - Email (仅注册用户) */}
              {!isGuest && user.email && (
                <div className="mb-3">
                  <label className={`block text-xs font-medium text-ink-soft mb-2 ${fontClass}`}>
                    {t("account.email")}
                  </label>
                  <div className="flex items-center justify-between">
                    <span className={`text-text text-sm ${fontClass}`}>
                      {user.email}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-green-400">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{t("account.verified")}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 用户 ID - User ID */}
              <div className="mb-4">
                <label className={`block text-xs font-medium text-ink-soft mb-2 ${fontClass}`}>
                  {t("account.userId")}
                </label>
                <div className="flex items-center gap-2">
                  <span className={`text-text-muted text-sm font-mono ${fontClass}`}>
                    {user.id}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigator.clipboard.writeText(user.id)}
                    className="p-1 h-6 w-6 text-text-muted hover:text-primary-400"
                    title={t("account.copyId")}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            分隔线 - Divider
            ═══════════════════════════════════════════════════════════ */}
        <div className="mx-6 h-[1px] bg-gradient-to-r from-transparent via-muted-surface to-transparent"></div>

        {/* ═══════════════════════════════════════════════════════════
            账户类型标识 - Account Type Badge
            ═══════════════════════════════════════════════════════════ */}
        <div className="px-6 py-4">
          <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-md ${
            isGuest 
              ? "bg-primary-500/10 border border-primary-500/20" 
              : "bg-green-500/10 border border-green-500/20"
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isGuest ? "bg-primary-400" : "bg-green-400"
            }`}></div>
            <span className={`text-xs font-medium ${
              isGuest ? "text-primary-300" : "text-green-300"
            } ${fontClass}`}>
              {isGuest ? t("account.guestAccount") : t("account.verifiedAccount")}
            </span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            操作按钮 - Actions
            ═══════════════════════════════════════════════════════════ */}
        <div className="p-6 pt-2">
          <Button
            variant="destructive"
            onClick={handleLogout}
            className="w-full group relative overflow-hidden bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 rounded-xl py-3 px-4"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-red-600/0 via-red-600/5 to-red-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            
            <div className="relative flex items-center justify-center gap-2">
              <LogOut className="h-4 w-4" />
              <span className={`${fontClass}`}>{t("account.logout")}</span>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
