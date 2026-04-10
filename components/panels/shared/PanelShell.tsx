/**
 * @input  @/components/ui/button, @/lib/utils, next/link
 * @output PanelShell, PanelCard, PanelLinkCard
 * @pos    面板共享壳层
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                         PanelShell 共享壳层                         ║
 * ║  统一右侧工作区面板的标题、说明、节奏与卡片结构。                    ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { createContext, useContext } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PanelShellEmbeddedContext = createContext(false);

interface PanelShellProps {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  headerMode?: "full" | "actions-only" | "none";
  embeddedHeaderMode?: "full" | "actions-only" | "none";
}

export function PanelShellEmbeddedProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PanelShellEmbeddedContext.Provider value={true}>
      {children}
    </PanelShellEmbeddedContext.Provider>
  );
}

export function PanelShell({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  headerMode = "full",
  embeddedHeaderMode,
}: PanelShellProps) {
  const isEmbedded = useContext(PanelShellEmbeddedContext);
  const effectiveHeaderMode = isEmbedded ? (embeddedHeaderMode ?? headerMode) : headerMode;

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      {effectiveHeaderMode === "full" ? (
        <div className="border-b border-border/60 bg-muted/20 px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <div className="text-base font-semibold text-foreground">{title}</div>
              <div className="text-sm text-ink">{description}</div>
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        </div>
      ) : null}

      {effectiveHeaderMode === "actions-only" && actions ? (
        <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
          <div className="flex justify-end">{actions}</div>
        </div>
      ) : null}

      <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:pb-8", bodyClassName)}>
        {children}
      </div>
    </div>
  );
}

export function PanelCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-muted/30 p-4", className)}>
      {children}
    </section>
  );
}

export function PanelLinkCard({
  href,
  icon,
  label,
  meta,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  meta?: string;
}) {
  return (
    <Button asChild variant="outline" className="h-auto w-full justify-between px-3 py-3 text-left">
      <Link href={href}>
        <span className="flex items-center gap-2">
          {icon}
          <span>{label}</span>
        </span>
        {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
      </Link>
    </Button>
  );
}
