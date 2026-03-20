/**
 * @input  react, lib/mvu/debugger/strategy-matrix
 * @output MvuStrategyPanel
 * @pos    MVU 策略矩阵面板 - 展示默认路径与扩展路径的当前支持状态
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MVU_STRATEGY_MATRIX,
  getRecommendedMvuStrategy,
  type MvuStrategySupport,
} from "@/lib/mvu/debugger/strategy-matrix";
import { useMvuConfigStore } from "@/lib/store/mvu-config-store";

function supportLabel(support: MvuStrategySupport): string {
  if (support === "default") return "默认";
  if (support === "conditional") return "条件支持";
  return "未支持";
}

export default function MvuStrategyPanel() {
  const strategy = useMvuConfigStore((state) => state.strategy);
  const setStrategy = useMvuConfigStore((state) => state.setStrategy);
  const recommendation = getRecommendedMvuStrategy({ hasUpdateMarker: false });

  return (
    <div className="rounded-md border border-border bg-background/70 p-3">
      <div className="mb-3">
        <p className="text-sm font-medium text-foreground">策略矩阵</p>
        <p className="text-xs text-muted-foreground">
          明确当前默认路径是 `text-delta`，而 `function-calling` / `extra-model` 仍是显式扩展路径。
        </p>
      </div>

      <div className="grid gap-2">
        <div className="rounded-md border border-border bg-surface/40 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            当前策略
          </p>
          <div className="mt-2">
            <Select value={strategy} onValueChange={(value) => setStrategy(value as typeof strategy)}>
              <SelectTrigger data-mvu-strategy-select="true">
                <SelectValue placeholder="选择 MVU 策略" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text-delta">text-delta</SelectItem>
                <SelectItem value="function-calling">function-calling</SelectItem>
                <SelectItem value="extra-model">extra-model</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {MVU_STRATEGY_MATRIX.map((entry) => (
          <div
            key={entry.id}
            className="rounded-md border border-border bg-surface/50 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">{entry.id}</p>
              <span className="text-xs text-muted-foreground">{supportLabel(entry.support)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{entry.summary}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-md border border-border bg-surface/40 px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          当前建议
        </p>
        <p className="mt-1 text-sm text-foreground">
          默认使用 {recommendation.primary.id}
          {recommendation.secondary ? `，后续可显式评估 ${recommendation.secondary.id}` : ""}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          当前已选择：{strategy}
        </p>
      </div>
    </div>
  );
}
