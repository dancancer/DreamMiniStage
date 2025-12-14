/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                        Plugin API Factory                                 ║
 * ║                                                                          ║
 * ║  插件 API 工厂函数：为每个插件创建独立的 API 实例                            ║
 * ║  从 plugin-registry.ts 提取                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { PluginAPI, CustomButton, UIComponent, SettingsTab, WSHook, MessageContext, PluginTool, PluginConfig, JSONValue } from "./plugin-types";
import { ToolRegistry } from "../tools/tool-registry";
import { PluginEventEmitter } from "./plugin-event-emitter";
import { pluginConfigStorage } from "./plugin-config-storage";
import { ToolType, ExecutionContext, ExecutionResult } from "../models/agent-model";
import type { SimpleTool } from "../tools/base-tool";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

export interface UIRegistries {
  buttons: Map<string, CustomButton>;
  components: Map<string, UIComponent>;
  settingsTabs: Map<string, SettingsTab>;
}

export interface WSHooks {
  beforeSend: WSHook[];
  afterReceive: WSHook[];
}

export interface PluginAPIContext {
  uiRegistries: UIRegistries;
  wsHooks: WSHooks;
  messageModifiers: Array<(message: MessageContext) => MessageContext>;
  eventEmitter: PluginEventEmitter;
}

/* ═══════════════════════════════════════════════════════════════════════════
   工厂函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 为指定插件创建 API 实例
 */
export function createPluginAPI(pluginId: string, ctx: PluginAPIContext): PluginAPI {
  const { uiRegistries, wsHooks, messageModifiers, eventEmitter } = ctx;

  return {
    /* ─────────────────────────────────────────────────────────────────────────
       工具注册
       ───────────────────────────────────────────────────────────────────────── */
    registerTool: (toolId: string, tool: PluginTool) => {
      const simpleTool: SimpleTool = {
        name: tool.name || toolId,
        description: tool.description || "Plugin tool",
        toolType: ToolType.SUPPLEMENT,
        parameters: [],
        async execute(_context: ExecutionContext, parameters: Record<string, unknown>): Promise<ExecutionResult> {
          try {
            const executePlugin = tool.execute || (async () => ({ success: false, error: "Tool not implemented" }));
            const pluginResult = await executePlugin(parameters as PluginConfig);
            if (typeof pluginResult === "object" && pluginResult !== null && "success" in pluginResult) {
              return pluginResult as ExecutionResult;
            }
            return { success: true, result: pluginResult };
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
          }
        },
      };

      Object.defineProperty(simpleTool, "constructor", { value: { name: toolId } });
      ToolRegistry.registerDynamicTool(simpleTool);
    },

    unregisterTool: (toolId: string) => {
      ToolRegistry.unregisterDynamicTool(toolId);
    },

    /* ─────────────────────────────────────────────────────────────────────────
       UI 注入
       ───────────────────────────────────────────────────────────────────────── */
    registerButton: (button: CustomButton) => {
      uiRegistries.buttons.set(button.id, button);
    },
    unregisterButton: (buttonId: string) => {
      uiRegistries.buttons.delete(buttonId);
    },
    registerUIComponent: (component: UIComponent) => {
      uiRegistries.components.set(component.id, component);
    },
    unregisterUIComponent: (componentId: string) => {
      uiRegistries.components.delete(componentId);
    },
    registerSettingsTab: (tab: SettingsTab) => {
      uiRegistries.settingsTabs.set(tab.id, tab);
    },
    unregisterSettingsTab: (tabId: string) => {
      uiRegistries.settingsTabs.delete(tabId);
    },

    /* ─────────────────────────────────────────────────────────────────────────
       WebSocket 钩子
       ───────────────────────────────────────────────────────────────────────── */
    addWSHookBeforeSend: (hook: WSHook) => {
      wsHooks.beforeSend.push(hook);
    },
    addWSHookAfterReceive: (hook: WSHook) => {
      wsHooks.afterReceive.push(hook);
    },
    removeWSHook: (_hookId: string) => {
      // 依赖钩子标识系统的实现
    },

    /* ─────────────────────────────────────────────────────────────────────────
       消息修改
       ───────────────────────────────────────────────────────────────────────── */
    addChatMessageModifier: (modifier: (message: MessageContext) => MessageContext) => {
      messageModifiers.push(modifier);
    },
    removeChatMessageModifier: (_modifierId: string) => {
      // 依赖修改器标识系统的实现
    },

    /* ─────────────────────────────────────────────────────────────────────────
       配置管理
       ───────────────────────────────────────────────────────────────────────── */
    getConfig: () => pluginConfigStorage.get() as PluginConfig,
    setConfig: (config: PluginConfig) => pluginConfigStorage.set(config as Record<string, unknown>),
    updateConfig: (updates: PluginConfig) => pluginConfigStorage.update(updates as Record<string, unknown>),

    /* ─────────────────────────────────────────────────────────────────────────
       通知与日志
       ───────────────────────────────────────────────────────────────────────── */
    showNotification: (message: string, type?: "info" | "success" | "warning" | "error") => {
      console.log(`📢 Plugin Notification [${type || "info"}]: ${message}`);
      // TODO: 集成实际通知系统
    },
    log: (message: string, level?: "debug" | "info" | "warn" | "error") => {
      console.log(`🔌 Plugin Log [${level || "info"}]: ${message}`);
    },

    /* ─────────────────────────────────────────────────────────────────────────
       存储
       ───────────────────────────────────────────────────────────────────────── */
    getStorage: (key: string) => localStorage.getItem(`plugin_${key}`),
    setStorage: (key: string, value: unknown) => localStorage.setItem(`plugin_${key}`, JSON.stringify(value)),
    removeStorage: (key: string) => localStorage.removeItem(`plugin_${key}`),

    /* ─────────────────────────────────────────────────────────────────────────
       系统集成
       ───────────────────────────────────────────────────────────────────────── */
    getSystemInfo: () => ({
      version: "1.0.0",
      platform: navigator.platform,
      userAgent: navigator.userAgent,
    }),
    getCurrentCharacter: () => ({}), // TODO: 实现
    getCurrentConversation: () => ({}), // TODO: 实现

    /* ─────────────────────────────────────────────────────────────────────────
       事件系统
       ───────────────────────────────────────────────────────────────────────── */
    emit: (event: string, data?: unknown) => eventEmitter.emit(event, data),
    on: (event: string, callback: (data?: unknown) => void) => eventEmitter.on(event, callback),
    off: (event: string, callback: (data?: unknown) => void) => eventEmitter.off(event, callback),
  };
}
