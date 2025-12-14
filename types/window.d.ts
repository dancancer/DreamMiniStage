/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Window 对象扩展 - 全局类型声明
   ────────────────────────────────────────────────────────────────────
   为挂载到 window 对象上的调试工具和插件系统提供类型安全
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import type { PluginRegistry } from "../lib/plugins/plugin-registry";
import type { PluginDiscovery } from "../lib/plugins/plugin-discovery";
import type { ToolRegistry } from "../lib/tools/tool-registry";

declare global {
  interface Window {
    // ═══════════════════════════════════════════════════════════════════
    // 插件系统
    // ═══════════════════════════════════════════════════════════════════
    pluginRegistry: PluginRegistry;
    pluginDiscovery: PluginDiscovery;
    toolRegistry: typeof ToolRegistry;

    // ═══════════════════════════════════════════════════════════════════
    // 调试和测试工具
    // ═══════════════════════════════════════════════════════════════════
    testPluginSystem: () => Promise<void>;
    quickHealthCheck: () => void;
    testDialogueIntegration: () => void;
    createTestPlugin: () => void;
    createTestPluginFiles: () => void;
  }
}

export {}; 
