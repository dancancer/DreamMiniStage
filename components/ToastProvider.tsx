/**
 * @input  @/app/i18n
 * @output ToastProvider
 * @pos    全局 Toast 通知提供者
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                        Toast Provider                                    ║
 * ║                                                                          ║
 * ║  Sonner Toast 全局配置 - 统一样式和行为                                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { Toaster } from "sonner";
import { useLanguage } from "@/app/i18n";

export function ToastProvider() {
  const { serifFontClass } = useLanguage();

  return (
    <Toaster
      position="top-center"
      expand={false}
      richColors
      closeButton
      duration={5000}
      toastOptions={{
        classNames: {
          toast: " border border-border  ",
          title: "text-cream font-medium",
          description: "text-primary-soft",
          actionButton: "bg-primary-bright text-deep hover:bg-primary-soft",
          cancelButton: "bg-muted-surface text-ink-soft hover:",
          closeButton: "bg-muted-surface text-ink-soft hover: hover:text-primary-soft",
          success: "border-green-600/50",
          error: "border-red-600/50",
          warning: "border-yellow-600/50",
          info: "border-blue-600/50",
        },
      }}
    />
  );
}
