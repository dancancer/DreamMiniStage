/**
 * @input  lib/plugins/plugin-types
 * @output PluginManifest, PluginInstance, PluginEntry, PluginRegistry, PluginDiscovery (+ Window 扩展)
 * @pos    类型定义层 - 扩展 Window 全局对象的插件系统类型
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Global Type Declarations                          ║
 * ║                                                                            ║
 * ║  定义全局对象和接口的类型声明                                                ║
 * ║  消除 window 对象扩展的 any 类型                                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

/* ═══════════════════════════════════════════════════════════════════════════
   插件系统类型定义 - 直接引用模块类型，避免重复定义
   ═══════════════════════════════════════════════════════════════════════════ */

import type {
  PluginCategory,
  PluginPermission,
  PluginManifest,
  PluginContext,
  Plugin as PluginInstance,
  PluginRegistryEntry as PluginEntry,
  PluginOperationResult,
} from "@/lib/plugins/plugin-types";

/**
 * 插件注册表 - 管理所有插件
 * 匹配实际实现：lib/plugins/plugin-registry.ts
 */
interface PluginRegistry {
  /** 初始化注册表 */
  initialize(): Promise<void>;
  /** 获取所有插件（返回数组）*/
  getPlugins(): PluginEntry[];
  /** 启用插件 */
  enablePlugin(pluginId: string): Promise<PluginOperationResult>;
  /** 禁用插件 */
  disablePlugin(pluginId: string): Promise<PluginOperationResult>;
}

/**
 * 插件发现服务 - 自动发现和加载插件
 * 匹配实际实现：lib/plugins/plugin-discovery.ts
 */
interface PluginDiscovery {
  /** 发现所有可用插件 */
  discoverPlugins(): Promise<unknown>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   扩展 Window 接口
   ═══════════════════════════════════════════════════════════════════════════ */

declare global {
  interface Window {
    /** 插件注册表实例 */
    pluginRegistry?: PluginRegistry;
    /** 插件发现服务实例 */
    pluginDiscovery?: PluginDiscovery;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出类型到全局作用域
   ═══════════════════════════════════════════════════════════════════════════ */

// 导出接口供模块使用
export type {
  PluginManifest,
  PluginInstance,
  PluginEntry,
  PluginRegistry,
  PluginDiscovery,
};

// 确保这是一个模块（保持空导出）
export {};
