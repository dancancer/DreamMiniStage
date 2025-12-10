/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    Character Route - Deprecated Redirect                   ║
 * ║                                                                            ║
 * ║  此路由已废弃，聊天功能已迁移至 /session 路由                                ║
 * ║  保留此文件用于向后兼容，处理旧链接和书签的重定向                             ║
 * ║                                                                            ║
 * ║  重定向规则：                                                               ║
 * ║  - /character?sessionId={id} → /session?id={id}                           ║
 * ║  - /character?id={characterId} → / (首页，显示 toast)                      ║
 * ║  - /character → / (首页)                                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/store/toast-store";
import { useLanguage } from "@/app/i18n";

// ============================================================================
//                              主组件
// ============================================================================

export default function CharacterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  useEffect(() => {
    // ═══════════════════════════════════════════════════════════════
    // 废弃警告 - 开发者调试用
    // ═══════════════════════════════════════════════════════════════
    console.warn(
      "[Deprecation] /character route is deprecated. " +
      "Chat functionality has been moved to /session. " +
      "Please update your links to use /session?id={sessionId}",
    );

    const sessionId = searchParams.get("sessionId");
    const characterId = searchParams.get("id");

    // ═══════════════════════════════════════════════════════════════
    // 重定向逻辑
    // ═══════════════════════════════════════════════════════════════

    if (sessionId) {
      // 新格式：/character?sessionId={id} → /session?id={id}
      router.replace(`/session?id=${sessionId}`);
      return;
    }

    if (characterId) {
      // 旧格式：/character?id={characterId} → 首页 + toast 提示
      toast.info(t("characterChat.routeDeprecated") || "此链接格式已更新，请从首页重新进入会话");
      router.replace("/");
      return;
    }

    // 无参数：直接重定向到首页
    router.replace("/");
  }, [router, searchParams, t]);

  // ═══════════════════════════════════════════════════════════════
  // 渲染：重定向中的加载状态
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">
          {t("common.redirecting") || "正在跳转..."}
        </p>
      </div>
    </div>
  );
}
