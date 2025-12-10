/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         PluginFilter                                      ║
 * ║                                                                            ║
 * ║  插件过滤器 - 使用 Radix Dropdown Menu 实现                                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";
import { Filter, Package, CheckCircle, AlertCircle, ChevronDown } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// ============================================================================
//                              类型定义
// ============================================================================

export type FilterValue = "all" | "enabled" | "disabled";

interface PluginFilterProps {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  pluginCounts: {
    all: number;
    enabled: number;
    disabled: number;
  };
}

// ============================================================================
//                              配置
// ============================================================================

const FILTER_OPTIONS = [
  {
    value: "all" as const,
    labelKey: "plugins.allPlugins",
    icon: Package,
    color: "text-cream",
  },
  {
    value: "enabled" as const,
    labelKey: "plugins.enabled",
    icon: CheckCircle,
    color: "text-green-400",
  },
  {
    value: "disabled" as const,
    labelKey: "plugins.disabled",
    icon: AlertCircle,
    color: "text-gray-400",
  },
];

// ============================================================================
//                              主组件
// ============================================================================

export function PluginFilter({ value, onChange, pluginCounts }: PluginFilterProps) {
  const { t, fontClass } = useLanguage();
  const currentFilter = FILTER_OPTIONS.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center space-x-2 bg-gradient-to-r from-ink/25 to-ink/15 hover:from-ink/35 hover:to-ink/25 text-cream px-4 py-2.5 h-auto rounded-xl border border-border/40 hover:border-cream/30 group min-w-[140px]">
          <Filter className="w-4 h-4 text-primary-soft group-hover:text-cream transition-colors" />
          {currentFilter && (
            <>
              <div className="flex items-center space-x-2 flex-1">
                <currentFilter.icon className={`w-4 h-4 ${currentFilter.color}`} />
                <span className={`text-sm font-medium ${fontClass}`}>
                  {t(currentFilter.labelKey)}
                </span>
                <span className="text-xs bg-ink/40 px-2 py-0.5 rounded-full text-primary-soft">
                  {pluginCounts[currentFilter.value]}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-primary-soft transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-[200px]  border-border/40">
        {FILTER_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`flex items-center space-x-3 px-4 py-3 cursor-pointer ${
              value === option.value
                ? "bg-ink/30 border-r-2 border-cream"
                : "hover:bg-ink/20"
            }`}
          >
            <option.icon className={`w-4 h-4 ${option.color}`} />
            <span
              className={`text-sm flex-1 ${
                value === option.value ? "text-cream font-medium" : "text-primary-soft"
              } ${fontClass}`}
            >
              {t(option.labelKey)}
            </span>
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                value === option.value
                  ? "bg-cream/20 text-cream"
                  : "bg-ink/30 text-primary-soft"
              }`}
            >
              {pluginCounts[option.value]}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
