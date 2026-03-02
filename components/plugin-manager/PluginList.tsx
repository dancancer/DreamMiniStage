/**
 * @input  @/app
 * @output PluginList
 * @pos    插件管理组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          PluginList                                       ║
 * ║                                                                            ║
 * ║  插件列表组件 - 显示过滤后的插件列表                                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useMemo } from "react";
import { Package } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { PluginCard } from "./PluginCard";
import type { FilterValue } from "./PluginFilter";
import type { PluginEntry } from "@/types/global";

// ============================================================================
//                              类型定义
// ============================================================================

// PluginEntry 类型定义在 types/global.d.ts 中
// 此处直接使用全局类型，避免重复定义

interface PluginListProps {
  plugins: PluginEntry[];
  filter: FilterValue;
  onToggle: (pluginId: string, enabled: boolean) => void;
}

// ============================================================================
//                              工具函数
// ============================================================================

function filterPlugins(plugins: PluginEntry[], filter: FilterValue): PluginEntry[] {
  switch (filter) {
  case "enabled":
    return plugins.filter((plugin) => plugin.enabled);
  case "disabled":
    return plugins.filter((plugin) => !plugin.enabled);
  default:
    return plugins;
  }
}

// ============================================================================
//                              主组件
// ============================================================================

export function PluginList({ plugins, filter, onToggle }: PluginListProps) {
  const { t } = useLanguage();
  
  const filteredPlugins = useMemo(
    () => filterPlugins(plugins, filter),
    [plugins, filter],
  );

  if (filteredPlugins.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">
          {filter === "all"
            ? t("plugins.noPluginsFound")
            : filter === "enabled"
              ? t("plugins.noEnabledPlugins")
              : t("plugins.noDisabledPlugins")}
        </p>
        <p className="text-gray-500 text-sm mt-2">{t("plugins.pluginDirectory")}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {filteredPlugins.map((plugin) => (
        <PluginCard
          key={plugin.manifest.id}
          plugin={plugin}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
