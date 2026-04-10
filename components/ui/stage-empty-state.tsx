/**
 * @input  @/components/ui/button, @/lib/utils, next/link
 * @output StageEmptyState
 * @pos    共享空状态组件
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                        StageEmptyState                                  ║
 * ║  沉浸式舞台空状态：统一标题、说明、动作与辅助说明的编排。                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StageEmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface StageEmptyStateProps {
  icon?: React.ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  note?: string;
  primaryAction?: StageEmptyStateAction;
  secondaryAction?: StageEmptyStateAction;
  className?: string;
}

export function StageEmptyState({
  icon,
  eyebrow,
  title,
  description,
  note,
  primaryAction,
  secondaryAction,
  className,
}: StageEmptyStateProps) {
  return (
    <section
      className={cn(
        "session-card relative w-full overflow-hidden px-6 py-7 text-center sm:px-10 sm:py-10",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="pointer-events-none absolute -right-12 -top-14 h-32 w-32 rounded-full bg-primary/8 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-3.5rem] left-8 h-24 w-24 rounded-full border border-primary/10" />

      {icon ? (
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-border/70 bg-background/60 text-primary-soft">
          <div className="absolute inset-2 rounded-full border border-primary/12" />
          <div className="relative z-10">{icon}</div>
        </div>
      ) : null}

      {eyebrow ? (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.34em] text-primary/75">
          {eyebrow}
        </p>
      ) : null}

      <h2 className="text-[2rem] font-semibold tracking-[0.01em] text-foreground sm:text-[2.25rem]">
        {title}
      </h2>

      <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-ink sm:text-base">
        {description}
      </p>

      {note ? (
        <p className="mx-auto mt-4 max-w-xl text-xs leading-6 text-ink-soft sm:text-sm">
          {note}
        </p>
      ) : null}

      {primaryAction || secondaryAction ? (
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {primaryAction ? (
            primaryAction.href ? (
              <Button asChild size="sm" className="h-11 rounded-full px-6 sm:h-10">
                <Link href={primaryAction.href}>{primaryAction.label}</Link>
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-11 rounded-full px-6 sm:h-10"
                onClick={primaryAction.onClick}
                type="button"
              >
                {primaryAction.label}
              </Button>
            )
          ) : null}

          {secondaryAction ? (
            secondaryAction.href ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-11 rounded-full border-border/70 bg-background/55 px-6 text-foreground hover:border-primary/20 hover:bg-primary/10 sm:h-10"
              >
                <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-11 rounded-full border-border/70 bg-background/55 px-6 text-foreground hover:border-primary/20 hover:bg-primary/10 sm:h-10"
                onClick={secondaryAction.onClick}
                type="button"
              >
                {secondaryAction.label}
              </Button>
            )
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
