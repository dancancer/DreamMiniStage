/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      PluginManagerModal                                   ║
 * ║                                                                            ║
 * ║  插件管理器 - 已迁移至 Radix UI Dialog                                      ║
 * ║  管理插件的启用/禁用、查看详情、刷新列表                                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useState, useEffect } from "react";
import { Package, RefreshCw } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PluginFilter, type FilterValue } from "./plugin-manager/PluginFilter";
import { PluginList } from "./plugin-manager/PluginList";
import { PluginStats } from "./plugin-manager/PluginStats";

// ============================================================================
//                              类型定义
// ============================================================================

interface PluginEntry {
  plugin: any;
  manifest: any;
  enabled: boolean;
  initialized: boolean;
  loaded: boolean;
  error?: string;
  loadTime?: Date;
}

interface PluginManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
//                              主组件
// ============================================================================

export default function PluginManagerModal({ isOpen, onClose }: PluginManagerModalProps) {
  const { t, fontClass } = useLanguage();
  
  // ========== 状态管理 ==========
  const [plugins, setPlugins] = useState<PluginEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ========== 数据加载 ==========
  useEffect(() => {
    if (isOpen) {
      loadPlugins();
    }
  }, [isOpen]);

  const loadPlugins = async () => {
    setIsLoading(true);
    try {
      if (typeof window !== "undefined" && (window as any).pluginRegistry) {
        await (window as any).pluginRegistry.initialize();
        const allPlugins = (window as any).pluginRegistry.getPlugins();
        setPlugins(allPlugins);
      }
    } catch (error) {
      console.error("Failed to load plugins:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ========== 事件处理 ==========
  const handleRefreshPlugins = async () => {
    setIsRefreshing(true);
    try {
      if (typeof window !== "undefined" && (window as any).pluginDiscovery) {
        await (window as any).pluginDiscovery.discoverPlugins();
      }
      await loadPlugins();
    } catch (error) {
      console.error("Failed to refresh plugins:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTogglePlugin = async (pluginId: string, enabled: boolean) => {
    try {
      if (typeof window !== "undefined" && (window as any).pluginRegistry) {
        if (enabled) {
          await (window as any).pluginRegistry.enablePlugin(pluginId);
        } else {
          await (window as any).pluginRegistry.disablePlugin(pluginId);
        }
        await loadPlugins();
      }
    } catch (error) {
      console.error(`Failed to ${enabled ? "enable" : "disable"} plugin:`, error);
    }
  };

  // ========== 计算属性 ==========
  const pluginCounts = {
    all: plugins.length,
    enabled: plugins.filter((p) => p.enabled).length,
    disabled: plugins.filter((p) => !p.enabled).length,
  };

  // ========== 渲染 ==========
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 overflow-hidden  bg-opacity-90 border-border/40 backdrop-filter backdrop-blur-md">
        {/* ═══════════════════════════════════════════════════════════
            头部区域 - Header Section
            ═══════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-cream/20 to-primary/20 rounded-xl">
              <Package className="w-5 h-5 text-cream" />
            </div>
            <div>
              <h2 className={`text-lg font-semibold text-cream ${fontClass}`}>
                {t("plugins.title")}
              </h2>
              <p className="text-xs text-primary-soft opacity-80">
                {t("plugins.enhancedSystem")}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefreshPlugins}
              disabled={isRefreshing}
              className="h-9 w-9 bg-ink/30 hover:bg-ink-soft/40 text-cream group hover:scale-105 active:scale-95"
              title={t("plugins.refresh")}
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : "group-hover:rotate-180"} transition-transform duration-300`}
              />
            </Button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            工具栏 - Toolbar
            ═══════════════════════════════════════════════════════════ */}
        <div className="px-6 py-3 border-b border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <PluginFilter
                value={filter}
                onChange={setFilter}
                pluginCounts={pluginCounts}
              />
              <div className="px-3 py-1.5 bg-gradient-to-r from-ink/20 to-ink/10 rounded-md text-primary-soft border border-border/20 text-xs">
                <span className="font-medium text-cream">{pluginCounts[filter]}</span>
                <span className="mx-1 text-primary-soft/60">/</span>
                <span>{pluginCounts.all}</span>
                <span className="ml-1 text-primary-soft/80">{t("plugins.items")}</span>
              </div>
            </div>
            <div className="text-xs text-primary-soft opacity-70">
              <span>{t("plugins.version")}</span>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            内容区域 - Content Section
            ═══════════════════════════════════════════════════════════ */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cream"></div>
              <span className="ml-3 text-cream">{t("plugins.loading")}</span>
            </div>
          ) : (
            <PluginList
              plugins={plugins}
              filter={filter}
              onToggle={handleTogglePlugin}
            />
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            底部状态栏 - Footer Status Bar
            ═══════════════════════════════════════════════════════════ */}
        <div className="px-6 py-4 border-t border-border/30 bg-gradient-to-r from-overlay/20 to-deep/40">
          <PluginStats plugins={plugins} />
        </div>
      </DialogContent>
    </Dialog>
  );
} 
