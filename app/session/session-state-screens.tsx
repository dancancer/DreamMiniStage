/**
 * @input  react, next/link
 * @output RedirectScreen, ErrorScreen, LoadingScreen
 * @pos    /session 状态占位屏
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      Session State Screens                               ║
 * ║                                                                           ║
 * ║  收口 /session 的 redirect / loading / error 这批状态占位视图。            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import Link from "next/link";
import React from "react";

export function RedirectScreen({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <p className="text-sm text-foreground">{text}</p>
    </div>
  );
}

export function LoadingScreen({
  text,
  hint,
  fontClass,
}: {
  text: string;
  hint?: string;
  fontClass?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <p className="text-sm text-foreground">{text}</p>
      {hint ? (
        <p className={`text-ink-soft text-xs max-w-xs text-center ${fontClass || ""}`.trim()}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function ErrorScreen({
  title,
  message,
  backLabel,
}: {
  title: string;
  message: string;
  backLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h1 className="text-2xl text-cream mb-4">{title}</h1>
      <p className="text-primary-soft mb-6">{message}</p>
      <Link
        href="/"
        className="bg-muted-surface hover:bg-muted-surface text-cream font-medium py-2 px-4 rounded border border-border"
      >
        {backLabel}
      </Link>
    </div>
  );
}
