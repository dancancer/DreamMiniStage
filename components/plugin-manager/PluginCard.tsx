/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          PluginCard                                       ║
 * ║                                                                            ║
 * ║  插件卡片组件 - 显示单个插件的信息和操作按钮                                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";
import Image from "next/image";
import {
  Power,
  PowerOff,
  Info,
  CheckCircle,
  AlertCircle,
  Package,
  ExternalLink,
  User,
  Wrench,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { useLanguage } from "@/app/i18n";

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

interface PluginCardProps {
  plugin: PluginEntry;
  onToggle: (pluginId: string, enabled: boolean) => void;
}

// ============================================================================
//                              工具函数
// ============================================================================

function getPluginStatusIcon(plugin: PluginEntry) {
  if (plugin.error) {
    return <AlertTriangle className="w-4 h-4 text-red-400" />;
  }
  if (plugin.enabled) {
    return <CheckCircle className="w-4 h-4 text-green-400" />;
  }
  return <AlertCircle className="w-4 h-4 text-gray-400" />;
}

function getPluginStatusText(plugin: PluginEntry) {
  if (plugin.error) {
    return { text: "错误", color: "text-red-400" };
  }
  if (plugin.enabled) {
    return { text: "已启用", color: "text-green-400" };
  }
  return { text: "已禁用", color: "text-gray-400" };
}

// ============================================================================
//                              主组件
// ============================================================================

export function PluginCard({ plugin, onToggle }: PluginCardProps) {
  const { t } = useLanguage();
  const statusText = getPluginStatusText(plugin);

  return (
    <div className="group bg-gradient-to-br from-overlay/30 to-deep/50 rounded-xl p-5 border border-border/30 hover:border-cream/40 transition-all duration-300 backdrop-blur-sm hover:-translate-y-0.5 hover:shadow-cream/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start justify-between">
        {/* ═══════════════════════════════════════════════════════════
            插件信息 - Plugin Info
            ═══════════════════════════════════════════════════════════ */}
        <div className="flex items-start space-x-4 flex-1">
          {/* 插件图标 - Plugin Icon */}
          <div className="w-12 h-12 bg-gradient-to-br from-ink/40 to-overlay/60 rounded-xl flex items-center justify-center overflow-hidden relative group-hover:from-cream/20 group-hover:to-primary/20 transition-all duration-300">
            {plugin.manifest.icon ? (
              plugin.manifest.icon.startsWith("http") || plugin.manifest.icon.startsWith("/") ? (
                plugin.manifest.id === "dialogue-stats" ? (
                  <BarChart3 className="h-6 w-6 text-cream" />
                ) : (
                  <Image
                    src={plugin.manifest.icon}
                    alt={plugin.manifest.name}
                    fill
                    sizes="48px"
                    className="rounded object-cover"
                  />
                )
              ) : (
                <span className="text-2xl select-none">{plugin.manifest.icon}</span>
              )
            ) : (
              <Package className="w-6 h-6 text-cream" />
            )}
          </div>

          {/* 插件详情 - Plugin Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="font-medium text-cream truncate">
                {plugin.manifest.name}
              </h3>
              <span className="text-xs bg-ink/30 px-2 py-1 rounded-md text-primary-soft flex-shrink-0">
                v{plugin.manifest.version}
              </span>
              <div className="flex items-center space-x-1 flex-shrink-0">
                {getPluginStatusIcon(plugin)}
                <span className={`text-xs font-medium ${statusText.color}`}>
                  {statusText.text}
                </span>
              </div>
            </div>

            <p className="text-sm text-primary-soft mb-3 leading-relaxed line-clamp-2 overflow-hidden">
              {plugin.manifest.description}
            </p>

            <div className="flex items-center space-x-3 text-xs text-primary-soft/70">
              <div className="flex items-center space-x-1">
                <User className="w-3 h-3" />
                <span>{plugin.manifest.author}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Wrench className="w-3 h-3" />
                <span className="capitalize">{plugin.manifest.category}</span>
              </div>
            </div>

            {plugin.error && (
              <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-md text-red-400 text-xs">
                <strong>{t("plugins.error")}</strong> {plugin.error}
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            操作按钮 - Action Buttons
            ═══════════════════════════════════════════════════════════ */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={() => onToggle(plugin.manifest.id, !plugin.enabled)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
              plugin.enabled
                ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                : "bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30"
            }`}
          >
            {plugin.enabled ? (
              <PowerOff className="w-4 h-4" />
            ) : (
              <Power className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {plugin.enabled ? t("plugins.disable") : t("plugins.enable")}
            </span>
          </button>

          <button
            onClick={() => {
              if (plugin.manifest.homepage) {
                window.open(plugin.manifest.homepage, "_blank");
              }
            }}
            disabled={!plugin.manifest.homepage}
            className="p-2 bg-ink/20 hover:bg-ink/40 text-primary-soft rounded-md transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
            title={t("plugins.homepage")}
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          <button
            className="p-2 bg-ink/20 hover:bg-ink/40 text-primary-soft rounded-md transition-all duration-200"
            onClick={() => {
              console.log("Plugin details:", plugin);
            }}
            title={t("plugins.details")}
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
