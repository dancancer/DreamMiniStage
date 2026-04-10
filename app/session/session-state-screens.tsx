/**
 * @input  react, lucide-react, components/ui/stage-empty-state
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

import React from "react";
import { AlertCircle, LoaderCircle, MessageCircleMore } from "lucide-react";
import { StageEmptyState } from "@/components/ui/stage-empty-state";

export function RedirectScreen({ text }: { text: string }) {
  return <LoadingScreen text={text} />;
}

export function EmptySessionScreen({
  eyebrow,
  title,
  message,
  note,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  eyebrow?: string;
  title: string;
  message: string;
  note?: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="flex h-full items-center justify-center px-4">
      <StageEmptyState
        icon={<MessageCircleMore className="h-9 w-9" />}
        eyebrow={eyebrow}
        title={title}
        description={message}
        note={note}
        primaryAction={{ label: primaryLabel, href: primaryHref }}
        secondaryAction={secondaryHref && secondaryLabel
          ? { label: secondaryLabel, href: secondaryHref }
          : undefined}
        className="max-w-lg"
      />
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
    <div className="flex h-full items-center justify-center px-4">
      <StageEmptyState
        icon={<LoaderCircle className="h-9 w-9 animate-spin" />}
        eyebrow="Preparing Stage"
        title={text}
        description={hint || "正在为当前叙事接上舞台与上下文。"}
        className={`max-w-md ${fontClass || ""}`.trim()}
      />
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
    <div className="flex h-full items-center justify-center px-4">
      <StageEmptyState
        icon={<AlertCircle className="h-9 w-9" />}
        eyebrow="Stage Interrupted"
        title={title}
        description={message}
        primaryAction={{ label: backLabel, href: "/" }}
        className="max-w-lg"
      />
    </div>
  );
}
