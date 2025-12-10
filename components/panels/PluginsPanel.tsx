/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                         PluginsPanel 插件面板                       ║
 * ║  嵌入插件列表/过滤/统计，复用插件管理逻辑，无额外模态。               ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import { Package, RefreshCw } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { PluginFilter, type FilterValue } from "@/components/plugin-manager/PluginFilter";
import { Button } from "@/components/ui/button";
import { PluginList } from "@/components/plugin-manager/PluginList";
import { PluginStats } from "@/components/plugin-manager/PluginStats";

interface PluginEntry {
  plugin: any;
  manifest: any;
  enabled: boolean;
  initialized: boolean;
  loaded: boolean;
  error?: string;
  loadTime?: Date;
}

export function PluginsPanel() {
  const { t, fontClass } = useLanguage();
  const [plugins, setPlugins] = useState<PluginEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadPlugins();
  }, []);

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

  const pluginCounts = useMemo(
    () => ({
      all: plugins.length,
      enabled: plugins.filter((p) => p.enabled).length,
      disabled: plugins.filter((p) => !p.enabled).length,
    }),
    [plugins],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-cream/20 to-primary/20 rounded-xl">
            <Package className="w-5 h-5 text-cream" />
          </div>
          <div>
            <h2 className={`text-base font-semibold text-foreground ${fontClass}`}>
              {t("plugins.title")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("plugins.enhancedSystem")}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefreshPlugins}
          disabled={isRefreshing}
          className="p-2 bg-muted text-foreground hover:bg-muted/80"
          title={t("plugins.refresh")}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PluginFilter value={filter} onChange={setFilter} pluginCounts={pluginCounts} />
          <div className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{pluginCounts[filter]}</span>
            <span className="mx-1 text-muted-foreground">/</span>
            <span>{pluginCounts.all}</span>
            <span className="ml-1 text-muted-foreground">{t("plugins.items")}</span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{t("plugins.version")}</div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground/80"></div>
            <span className="ml-3 text-foreground">{t("plugins.loading")}</span>
          </div>
        ) : (
          <PluginList plugins={plugins} filter={filter} onToggle={handleTogglePlugin} />
        )}
      </div>

      <div className="border-t border-border px-4 py-3 bg-muted/40">
        <PluginStats plugins={plugins} />
      </div>
    </div>
  );
}
