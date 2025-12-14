/**
 * Plugin System Types - Enhanced with SillyTavern-like features
 *
 * Comprehensive type definitions for the plugin system with:
 * - Lifecycle hooks (onLoad, onEnable, onDisable, onMessage)
 * - UI injection capabilities
 * - Dynamic plugin discovery
 * - Hot-reloading support
 */

// ========================================
// 基础类型定义
// ========================================

/**
 * 插件配置值类型
 */
export type PluginConfigValue = string | number | boolean | null | undefined | PluginConfigValue[] | { [key: string]: PluginConfigValue };

/**
 * 插件配置对象
 */
export type PluginConfig = Record<string, PluginConfigValue>;

/**
 * JSON 可序列化的值类型
 */
export type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

/**
 * 插件工具基础接口
 */
export interface PluginTool {
  id: string;
  name: string;
  description: string;
  category?: string;
  execute: (params: PluginConfig) => unknown | Promise<unknown>;
}

export enum PluginCategory {
  TOOL = "tool",
  UI = "ui", 
  WORKFLOW = "workflow",
  UTILITY = "utility",
  INTEGRATION = "integration",
  EXTENSION = "extension"
}

export enum PluginPermission {
  READ_MESSAGES = "read_messages",
  WRITE_MESSAGES = "write_messages",
  MODIFY_UI = "modify_ui",
  NETWORK_ACCESS = "network_access",
  LOCAL_STORAGE = "local_storage",
  SYSTEM_NOTIFICATIONS = "system_notifications",
  TOOL_REGISTRATION = "tool_registration",
  WEBSOCKET_HOOK = "websocket_hook"
}

export enum PluginEvent {
  LOAD = "load",
  ENABLE = "enable", 
  DISABLE = "disable",
  MESSAGE_SENT = "message_sent",
  MESSAGE_RECEIVED = "message_received",
  TOOL_EXECUTED = "tool_executed",
  UI_RENDERED = "ui_rendered",
  SETTINGS_CHANGED = "settings_changed"
}

/**
 * Plugin manifest structure (similar to SillyTavern)
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string; // Entry point file (e.g., "main.js")
  icon?: string;
  category: PluginCategory;
  permissions: PluginPermission[];
  dependencies?: string[];
  minVersion?: string;
  maxVersion?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  license?: string;
  enabled?: boolean;
  integrity?: string; // Optional SHA-256 integrity value (e.g., sha256-<base64|hex>)
}

/**
 * Plugin context passed to lifecycle hooks
 */
export interface PluginContext {
  pluginId: string;
  pluginPath: string;
  manifest: PluginManifest;
  api: PluginAPI;
  config: PluginConfig;
  enabled: boolean;
}

/**
 * Message object passed to onMessage hook
 */
export interface MessageContext {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  characterId?: string;
  metadata?: Record<string, JSONValue>;
}

/**
 * UI injection types
 */

/**
 * UI 组件通用 props
 */
export interface UIComponentProps {
  pluginId: string;
  context?: PluginContext;
  [key: string]: unknown;
}

export interface UIComponent {
  id: string;
  type: "button" | "panel" | "modal" | "toolbar" | "sidebar";
  position: "header" | "footer" | "sidebar" | "chat" | "settings";
  component: React.ComponentType<UIComponentProps>;
  props?: Record<string, JSONValue>;
  order?: number;
  visible?: boolean;
}

/**
 * 按钮点击上下文
 */
export interface ButtonClickContext {
  pluginId: string;
  characterId?: string;
  conversationId?: string;
  messageId?: string;
  timestamp: Date;
}

export interface CustomButton {
  id: string;
  text: string;
  icon?: string;
  onClick: (context: ButtonClickContext) => void;
  position: "toolbar" | "message" | "input" | "settings";
  tooltip?: string;
  disabled?: boolean;
  order?: number;
}

export interface SettingsTab {
  id: string;
  title: string;
  icon?: string;
  component: React.ComponentType<UIComponentProps>;
  order?: number;
}

/**
 * WebSocket hook types
 */
export interface WSHookContext {
  type: "send" | "receive";
  data: JSONValue;
  timestamp: Date;
  characterId?: string;
}

export type WSHook = (context: WSHookContext) => WSHookContext | Promise<WSHookContext>;

/**
 * Plugin lifecycle hooks (similar to SillyTavern)
 */
export interface PluginLifecycleHooks {
  /**
   * Called when plugin is first loaded
   */
  onLoad?: (context: PluginContext) => void | Promise<void>;

  /**
   * Called when plugin is enabled
   */
  onEnable?: (context: PluginContext) => void | Promise<void>;

  /**
   * Called when plugin is disabled
   */
  onDisable?: (context: PluginContext) => void | Promise<void>;

  /**
   * Called when user sends a message
   */
  onMessage?: (message: MessageContext, context: PluginContext) => MessageContext | Promise<MessageContext>;

  /**
   * Called when AI assistant responds
   */
  onResponse?: (message: MessageContext, context: PluginContext) => MessageContext | Promise<MessageContext>;

  /**
   * Called when plugin settings are changed
   */
  onSettingsChange?: (settings: PluginConfig, context: PluginContext) => void | Promise<void>;

  /**
   * Called when plugin is unloaded
   */
  onUnload?: (context: PluginContext) => void | Promise<void>;
}

/**
 * Plugin API for interaction with the system
 */
export interface PluginAPI {
  // ========================================
  // Tool registration
  // ========================================
  registerTool: (toolId: string, tool: PluginTool) => void;
  unregisterTool: (toolId: string) => void;

  // ========================================
  // UI injection
  // ========================================
  registerButton: (button: CustomButton) => void;
  unregisterButton: (buttonId: string) => void;
  registerUIComponent: (component: UIComponent) => void;
  unregisterUIComponent: (componentId: string) => void;
  registerSettingsTab: (tab: SettingsTab) => void;
  unregisterSettingsTab: (tabId: string) => void;

  // ========================================
  // WebSocket hooks
  // ========================================
  addWSHookBeforeSend: (hook: WSHook) => void;
  addWSHookAfterReceive: (hook: WSHook) => void;
  removeWSHook: (hookId: string) => void;

  // ========================================
  // Message modification
  // ========================================
  addChatMessageModifier: (modifier: (message: MessageContext) => MessageContext) => void;
  removeChatMessageModifier: (modifierId: string) => void;

  // ========================================
  // Configuration
  // ========================================
  getConfig: () => PluginConfig;
  setConfig: (config: PluginConfig) => void;
  updateConfig: (updates: PluginConfig) => void;

  // ========================================
  // Notifications
  // ========================================
  showNotification: (message: string, type?: "info" | "success" | "warning" | "error") => void;

  // ========================================
  // Logging
  // ========================================
  log: (message: string, level?: "debug" | "info" | "warn" | "error") => void;

  // ========================================
  // Storage (使用 unknown 强制类型检查)
  // ========================================
  getStorage: (key: string) => unknown;
  setStorage: (key: string, value: JSONValue) => void;
  removeStorage: (key: string) => void;

  // ========================================
  // System integration
  // ========================================
  getSystemInfo: () => Record<string, JSONValue>;
  getCurrentCharacter: () => unknown;
  getCurrentConversation: () => unknown;

  // ========================================
  // Event system
  // ========================================
  emit: (event: string, data?: unknown) => void;
  on: (event: string, callback: (data?: unknown) => void) => void;
  off: (event: string, callback: (data?: unknown) => void) => void;
}

/**
 * Plugin interface combining hooks and metadata
 */
export interface Plugin extends PluginLifecycleHooks {
  manifest: PluginManifest;
  context?: PluginContext;
  tools?: PluginTool[];
  components?: UIComponent[];
  buttons?: CustomButton[];
  settingsTabs?: SettingsTab[];
  wsHooks?: WSHook[];
}

/**
 * Plugin event data
 */
export interface PluginEventData {
  pluginId?: string;
  event?: PluginEvent;
  data?: unknown;
  timestamp?: string;
}

/**
 * Plugin registry entry
 */
export interface PluginRegistryEntry {
  plugin: Plugin;
  manifest: PluginManifest;
  enabled: boolean;
  initialized: boolean;
  loaded: boolean;
  context?: PluginContext;
  error?: string;
  loadTime?: Date;
}

/**
 * Plugin loading result
 */
export interface PluginLoadResult {
  success: boolean;
  plugin?: Plugin;
  error?: string;
  manifest?: PluginManifest;
}

/**
 * Plugin discovery result
 */
export interface PluginDiscoveryResult {
  found: PluginManifest[];
  errors: Array<{
    path: string;
    error: string;
  }>;
}

/**
 * Plugin operation result
 */
export interface PluginOperationResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: JSONValue;
}

/**
 * Plugin configuration schema
 */
export interface PluginConfigSchema {
  [key: string]: {
    type: "string" | "number" | "boolean" | "array" | "object";
    default?: PluginConfigValue;
    description?: string;
    required?: boolean;
    enum?: PluginConfigValue[];
    min?: number;
    max?: number;
    pattern?: string;
  };
}

/**
 * Plugin statistics
 */
export interface PluginStats {
  totalPlugins: number;
  enabledPlugins: number;
  disabledPlugins: number;
  loadedPlugins: number;
  failedPlugins: number;
  categories: Record<PluginCategory, number>;
  lastUpdateTime: Date;
} 
 
