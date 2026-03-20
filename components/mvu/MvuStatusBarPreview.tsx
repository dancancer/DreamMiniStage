/**
 * @input  react, lib/mvu/debugger/status-bar
 * @output MvuStatusBarPreview
 * @pos    MVU 状态栏预览 - 把 status_bar 变量渲染成作者可读的卡片
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

"use client";

import React from "react";
import { buildStatusBarEntries } from "@/lib/mvu/debugger/status-bar";
import type { MvuData } from "@/lib/mvu";

interface Props {
  title: string;
  variables: Pick<MvuData, "stat_data" | "display_data"> | null | undefined;
  emptyText: string;
  dataKey: string;
}

export default function MvuStatusBarPreview({
  title,
  variables,
  emptyText,
  dataKey,
}: Props) {
  const entries = buildStatusBarEntries(variables);

  return (
    <div className="rounded-md border border-border bg-background/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </p>
      </div>

      {entries.length > 0 ? (
        <div data-mvu-status-bar={dataKey} className="flex flex-wrap gap-2">
          {entries.map((entry) => (
            <div
              key={entry.key}
              className="min-w-[7rem] rounded-md border border-border bg-surface px-3 py-2"
            >
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {entry.label}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {entry.displayValue || String(entry.rawValue ?? "")}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}
