/**
 * Plugin Registry - SillyTavern 风格的插件管理系统
 * 重构版本：API 工厂和配置存储提取到独立文件
 */

import { PluginRegistryEntry, PluginLoadResult, PluginEvent, PluginEventData, PluginCategory, MessageContext, CustomButton, UIComponent, SettingsTab, WSHook, WSHookContext, PluginStats, PluginOperationResult } from "./plugin-types";
import { ToolRegistry } from "../tools/tool-registry";
import { pluginDiscovery } from "./plugin-discovery";
import { PluginEventEmitter } from "./plugin-event-emitter";
import { createPluginAPI, UIRegistries, WSHooks, PluginAPIContext } from "./plugin-api-factory";
import { pluginConfigStorage } from "./plugin-config-storage";

export class PluginRegistry {
  private static instance: PluginRegistry;
  private plugins: Map<string, PluginRegistryEntry> = new Map();
  private initialized = false;
  private eventEmitter = new PluginEventEmitter();
  private uiRegistries: UIRegistries = { buttons: new Map(), components: new Map(), settingsTabs: new Map() };
  private wsHooks: WSHooks = { beforeSend: [], afterReceive: [] };
  private messageModifiers: Array<(message: MessageContext) => MessageContext> = [];

  private constructor() {}

  static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) PluginRegistry.instance = new PluginRegistry();
    return PluginRegistry.instance;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     初始化
     ───────────────────────────────────────────────────────────────────────── */

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log("🔌 Initializing Enhanced Plugin Registry...");

    try {
      ToolRegistry.initialize();

      const discovery = await pluginDiscovery.discoverPlugins();
      console.log(`🔍 Discovery complete: ${discovery.found.length} plugins found`);

      for (const manifest of discovery.found) {
        if (manifest.enabled) {
          await this.loadPlugin(manifest.id);
        }
      }

      this.initialized = true;
      console.log("✅ Enhanced Plugin Registry initialized");

      // 调试用全局暴露
      (window as unknown as Record<string, unknown>).enhancedPluginRegistry = this;
      (window as unknown as Record<string, unknown>).pluginRegistry = this;
      (window as unknown as Record<string, unknown>).ToolRegistry = ToolRegistry;
    } catch (error) {
      console.error("❌ Failed to initialize Enhanced Plugin Registry:", error);
      throw error;
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     插件加载
     ───────────────────────────────────────────────────────────────────────── */

  async loadPlugin(pluginId: string): Promise<PluginLoadResult> {
    console.log(`📦 Loading plugin: ${pluginId}`);

    const apiContext = this.createAPIContext();
    const result = await pluginDiscovery.loadPlugin(pluginId, createPluginAPI(pluginId, apiContext));

    if (result.success && result.plugin) {
      const entry: PluginRegistryEntry = {
        plugin: result.plugin,
        manifest: result.manifest!,
        enabled: false,
        initialized: false,
        loaded: true,
        context: result.plugin.context,
        loadTime: new Date(),
      };

      this.plugins.set(pluginId, entry);

      if (result.manifest?.enabled) {
        await this.enablePlugin(pluginId);
      }

      this.eventEmitter.emit(PluginEvent.LOAD, {
        pluginId,
        event: PluginEvent.LOAD,
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     插件启用/禁用
     ───────────────────────────────────────────────────────────────────────── */

  async enablePlugin(pluginId: string): Promise<PluginOperationResult> {
    console.log(`🔌 Enabling plugin: ${pluginId}`);

    const entry = this.plugins.get(pluginId);
    if (!entry) return { success: false, error: `Plugin ${pluginId} not found` };
    if (entry.enabled) return { success: true, message: `Plugin ${pluginId} already enabled` };

    try {
      if (entry.plugin.onEnable && entry.context) {
        await entry.plugin.onEnable(entry.context);
      }

      entry.enabled = true;
      entry.initialized = true;
      this.savePluginStates();

      this.eventEmitter.emit(PluginEvent.ENABLE, {
        pluginId,
        event: PluginEvent.ENABLE,
        timestamp: new Date().toISOString(),
      });

      console.log(`✅ Plugin enabled: ${pluginId}`);
      return { success: true, message: `Plugin ${pluginId} enabled successfully` };
    } catch (error) {
      console.error(`❌ Failed to enable plugin ${pluginId}:`, error);
      entry.error = error instanceof Error ? error.message : "Enable failed";
      return { success: false, error: entry.error };
    }
  }

  async disablePlugin(pluginId: string): Promise<PluginOperationResult> {
    console.log(`🔌 Disabling plugin: ${pluginId}`);

    const entry = this.plugins.get(pluginId);
    if (!entry) return { success: false, error: `Plugin ${pluginId} not found` };
    if (!entry.enabled) return { success: true, message: `Plugin ${pluginId} already disabled` };

    try {
      if (entry.plugin.onDisable && entry.context) {
        await entry.plugin.onDisable(entry.context);
      }

      entry.enabled = false;
      this.savePluginStates();

      this.eventEmitter.emit(PluginEvent.DISABLE, {
        pluginId,
        event: PluginEvent.DISABLE,
        timestamp: new Date().toISOString(),
      });

      console.log(`✅ Plugin disabled: ${pluginId}`);
      return { success: true, message: `Plugin ${pluginId} disabled successfully` };
    } catch (error) {
      console.error(`❌ Failed to disable plugin ${pluginId}:`, error);
      entry.error = error instanceof Error ? error.message : "Disable failed";
      return { success: false, error: entry.error };
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     消息处理
     ───────────────────────────────────────────────────────────────────────── */

  async processMessage(message: MessageContext): Promise<MessageContext> {
    let result = message;

    // 应用消息修改器
    for (const modifier of this.messageModifiers) {
      try {
        result = modifier(result);
      } catch (error) {
        console.error("❌ Error in message modifier:", error);
      }
    }

    // 调用启用插件的 onMessage 钩子
    for (const entry of this.plugins.values()) {
      if (entry.enabled && entry.plugin.onMessage && entry.context) {
        try {
          result = await entry.plugin.onMessage(result, entry.context);
        } catch (error) {
          console.error(`❌ Error in onMessage hook for ${entry.manifest.id}:`, error);
        }
      }
    }

    return result;
  }

  async processResponse(message: MessageContext): Promise<MessageContext> {
    let result = message;

    for (const entry of this.plugins.values()) {
      if (entry.enabled && entry.plugin.onResponse && entry.context) {
        try {
          result = await entry.plugin.onResponse(result, entry.context);
        } catch (error) {
          console.error(`❌ Error in onResponse hook for ${entry.manifest.id}:`, error);
        }
      }
    }

    return result;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     WebSocket 处理
     ───────────────────────────────────────────────────────────────────────── */

  async processWSBeforeSend(context: WSHookContext): Promise<WSHookContext> {
    let result = context;
    for (const hook of this.wsHooks.beforeSend) {
      try {
        result = await hook(result);
      } catch (error) {
        console.error("❌ Error in WebSocket before-send hook:", error);
      }
    }
    return result;
  }

  async processWSAfterReceive(context: WSHookContext): Promise<WSHookContext> {
    let result = context;
    for (const hook of this.wsHooks.afterReceive) {
      try {
        result = await hook(result);
      } catch (error) {
        console.error("❌ Error in WebSocket after-receive hook:", error);
      }
    }
    return result;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     统计与查询
     ───────────────────────────────────────────────────────────────────────── */

  getStats(): PluginStats {
    const plugins = Array.from(this.plugins.values());
    const categories: Record<PluginCategory, number> = {
      [PluginCategory.TOOL]: 0,
      [PluginCategory.UI]: 0,
      [PluginCategory.WORKFLOW]: 0,
      [PluginCategory.UTILITY]: 0,
      [PluginCategory.INTEGRATION]: 0,
      [PluginCategory.EXTENSION]: 0,
    };

    plugins.forEach(entry => {
      categories[entry.manifest.category as PluginCategory]++;
    });

    return {
      totalPlugins: plugins.length,
      enabledPlugins: plugins.filter(p => p.enabled).length,
      disabledPlugins: plugins.filter(p => !p.enabled).length,
      loadedPlugins: plugins.filter(p => p.loaded).length,
      failedPlugins: plugins.filter(p => p.error).length,
      categories,
      lastUpdateTime: new Date(),
    };
  }

  getPlugins(): PluginRegistryEntry[] {
    return Array.from(this.plugins.values());
  }

  getPluginInfo(): PluginRegistryEntry[] {
    return this.getPlugins();
  }

  getEnabledPlugins(): PluginRegistryEntry[] {
    return Array.from(this.plugins.values()).filter(entry => entry.enabled);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     UI 组件获取
     ───────────────────────────────────────────────────────────────────────── */

  getRegisteredButtons(): CustomButton[] {
    return Array.from(this.uiRegistries.buttons.values());
  }

  getRegisteredComponents(): UIComponent[] {
    return Array.from(this.uiRegistries.components.values());
  }

  getRegisteredSettingsTabs(): SettingsTab[] {
    return Array.from(this.uiRegistries.settingsTabs.values());
  }

  /* ─────────────────────────────────────────────────────────────────────────
     事件系统
     ───────────────────────────────────────────────────────────────────────── */

  on(event: PluginEvent | string, callback: (data?: PluginEventData) => void): void {
    this.eventEmitter.on(event, callback as (data: unknown) => void);
  }

  emit(event: PluginEvent | string, data?: PluginEventData): void {
    this.eventEmitter.emit(event, data);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     工具执行（向后兼容）
     ───────────────────────────────────────────────────────────────────────── */

  async executeTool(toolName: string, params: Record<string, unknown>): Promise<unknown> {
    try {
      const tool = ToolRegistry.getTool(toolName);
      if (!tool) {
        return { success: false, error: `Tool ${toolName} not found` };
      }

      const mockContext = this.createMockExecutionContext();
      return await tool.execute(mockContext, params);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     私有方法
     ───────────────────────────────────────────────────────────────────────── */

  private createAPIContext(): PluginAPIContext {
    return {
      uiRegistries: this.uiRegistries,
      wsHooks: this.wsHooks,
      messageModifiers: this.messageModifiers,
      eventEmitter: this.eventEmitter,
    };
  }

  private savePluginStates(): void {
    const config: Record<string, unknown> = {};
    for (const [pluginId, entry] of this.plugins) {
      config[pluginId] = {
        enabled: entry.enabled,
        settings: entry.context?.config || {},
      };
    }
    pluginConfigStorage.set(config);
  }

  private createMockExecutionContext() {
    const emptyCharacter = { name: "", description: "", personality: "", scenario: "", first_mes: "", mes_example: "", creator_notes: "" };
    return {
      session_id: "plugin-test",
      generation_output: { character_data: emptyCharacter, status_data: undefined, user_setting_data: undefined, world_view_data: undefined, supplement_data: [] },
      research_state: { id: "test-research", session_id: "plugin-test", main_objective: "Plugin tool testing", task_queue: [], completed_tasks: [], knowledge_base: [] },
      message_history: [],
    };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出单例
   ═══════════════════════════════════════════════════════════════════════════ */

export const pluginRegistry = PluginRegistry.getInstance();
