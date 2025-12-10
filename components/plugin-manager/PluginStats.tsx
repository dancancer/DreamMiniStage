/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         PluginStats                                       ║
 * ║                                                                            ║
 * ║  插件统计信息 - 显示系统状态和插件数量                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";
import { useLanguage } from "@/app/i18n";

// ============================================================================
//                              类型定义
// ============================================================================

interface PluginEntry {
  enabled: boolean;
}

interface PluginStatsProps {
  plugins: PluginEntry[];
}

// ============================================================================
//                              主组件
// ============================================================================

export function PluginStats({ plugins }: PluginStatsProps) {
  const { t } = useLanguage();
  const enabledCount = plugins.filter((p) => p.enabled).length;

  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center space-x-3 text-primary-soft">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span>{t("plugins.systemStatus")}</span>
        </div>
        <span className="text-ink">•</span>
        <span>
          {t("plugins.pluginStats")
            .replace("{enabled}", enabledCount.toString())
            .replace("{total}", plugins.length.toString())}
        </span>
      </div>
      <div className="text-primary-soft/70">
        <span>v1.0.0</span>
      </div>
    </div>
  );
}
