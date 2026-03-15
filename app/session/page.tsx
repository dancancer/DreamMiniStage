/**
 * @input  react, app/i18n, app/session/session-page-content
 * @output SessionPage (default export)
 * @pos    /session 页面入口壳
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                           Session Page Entry                             ║
 * ║                                                                           ║
 * ║  只负责 Suspense 壳与 loading fallback；复杂逻辑下沉到 session-page-content。║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { Suspense } from "react";
import { useLanguage } from "@/app/i18n";
import SessionPageContent from "@/app/session/session-page-content";

export default function SessionPage() {
  const { t } = useLanguage();

  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <p className="text-sm text-foreground">{t("characterChat.loading") || "Loading..."}</p>
        </div>
      }
    >
      <SessionPageContent />
    </Suspense>
  );
}
