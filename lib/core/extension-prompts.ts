/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Extension Prompts 系统                             ║
 * ║                                                                            ║
 * ║  实现 SillyTavern 扩展提示词注入机制                                         ║
 * ║  支持 memory, floating_prompt, vectors 等扩展注入点                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ChatMessage, MacroEnv } from "./st-preset-types";

// ============================================================================
//                              扩展注入点定义
// ============================================================================

/** 标准扩展注入点 ID */
export const EXTENSION_PROMPT_IDS = {
  /** 记忆/摘要注入点 */
  MEMORY: "1_memory",
  /** 浮动提示词 (Author's Note) */
  FLOATING_PROMPT: "2_floating_prompt",
  /** 向量记忆检索 */
  VECTORS: "3_vectors",
  /** 角色笔记 */
  CHARACTER_NOTE: "4_character_note",
  /** 世界信息前置 */
  WORLD_INFO_BEFORE: "5_world_info_before",
  /** 世界信息后置 */
  WORLD_INFO_AFTER: "6_world_info_after",
  /** 自定义扩展 */
  CUSTOM: "7_custom",
  /** Persona 描述注入点 */
  PERSONA_DESCRIPTION: "8_persona_description",
} as const;

export type ExtensionPromptId = typeof EXTENSION_PROMPT_IDS[keyof typeof EXTENSION_PROMPT_IDS];

/** 注入位置 */
export type InjectionPosition = "in_chat" | "before_chat" | "after_chat";

/** 消息角色 */
export type MessageRole = "system" | "user" | "assistant";

// ============================================================================
//                              类型定义
// ============================================================================

/** 扩展提示词配置 */
export interface ExtensionPrompt {
  /** 扩展 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 提示词内容 */
  content: string;
  /** 是否启用 */
  enabled: boolean;
  /** 注入位置 */
  position: InjectionPosition;
  /** 深度 (从聊天历史底部计算) */
  depth: number;
  /** 消息角色 */
  role: MessageRole;
  /** 是否扫描 World Info */
  shouldScan: boolean;
  /** 排序权重 (同深度时使用) */
  order: number;
}

/** 扩展提示词注入结果 */
export interface InjectionResult {
  message: ChatMessage;
  depth: number;
  order: number;
  extensionId: string;
}

/** 扩展提示词管理器配置 */
export interface ExtensionPromptManagerConfig {
  /** 是否启用扩展系统 */
  enabled: boolean;
  /** 默认深度 */
  defaultDepth: number;
  /** 默认角色 */
  defaultRole: MessageRole;
}

// ============================================================================
//                              默认配置
// ============================================================================

export const DEFAULT_EXTENSION_CONFIG: ExtensionPromptManagerConfig = {
  enabled: true,
  defaultDepth: 4,
  defaultRole: "system",
};

/** 创建默认扩展提示词 */
export function createDefaultExtensionPrompt(
  id: string,
  name: string,
  overrides: Partial<ExtensionPrompt> = {},
): ExtensionPrompt {
  return {
    id,
    name,
    content: "",
    enabled: false,
    position: "in_chat",
    depth: DEFAULT_EXTENSION_CONFIG.defaultDepth,
    role: DEFAULT_EXTENSION_CONFIG.defaultRole,
    shouldScan: false,
    order: 0,
    ...overrides,
  };
}

// ============================================================================
//                              扩展提示词管理器
// ============================================================================

/** 扩展提示词管理器 */
export class ExtensionPromptManager {
  private extensions: Map<string, ExtensionPrompt> = new Map();
  private config: ExtensionPromptManagerConfig;
  private macroEvaluator?: (content: string, env: MacroEnv) => string;

  constructor(config: Partial<ExtensionPromptManagerConfig> = {}) {
    this.config = { ...DEFAULT_EXTENSION_CONFIG, ...config };
    this.initializeDefaultExtensions();
  }

  /** 初始化默认扩展 */
  private initializeDefaultExtensions(): void {
    this.registerExtension(createDefaultExtensionPrompt(
      EXTENSION_PROMPT_IDS.MEMORY,
      "Memory / Summary",
      { depth: 2, order: 100 },
    ));

    this.registerExtension(createDefaultExtensionPrompt(
      EXTENSION_PROMPT_IDS.FLOATING_PROMPT,
      "Author's Note",
      { depth: 4, order: 200 },
    ));

    this.registerExtension(createDefaultExtensionPrompt(
      EXTENSION_PROMPT_IDS.VECTORS,
      "Vector Memory",
      { depth: 2, order: 150 },
    ));

    this.registerExtension(createDefaultExtensionPrompt(
      EXTENSION_PROMPT_IDS.CHARACTER_NOTE,
      "Character Note",
      { depth: 0, order: 50, position: "before_chat" },
    ));

    this.registerExtension(createDefaultExtensionPrompt(
      EXTENSION_PROMPT_IDS.PERSONA_DESCRIPTION,
      "Persona Description",
      { depth: 4, order: 180, role: "system" },
    ));
  }

  /** 设置宏求值器 */
  setMacroEvaluator(evaluator: (content: string, env: MacroEnv) => string): void {
    this.macroEvaluator = evaluator;
  }

  /** 注册扩展 */
  registerExtension(extension: ExtensionPrompt): void {
    this.extensions.set(extension.id, extension);
  }

  /** 获取扩展 */
  getExtension(id: string): ExtensionPrompt | undefined {
    return this.extensions.get(id);
  }

  /** 更新扩展 */
  updateExtension(id: string, updates: Partial<ExtensionPrompt>): boolean {
    const ext = this.extensions.get(id);
    if (!ext) return false;
    this.extensions.set(id, { ...ext, ...updates });
    return true;
  }

  /** 启用扩展 */
  enableExtension(id: string): boolean {
    return this.updateExtension(id, { enabled: true });
  }

  /** 禁用扩展 */
  disableExtension(id: string): boolean {
    return this.updateExtension(id, { enabled: false });
  }

  /** 设置扩展内容 */
  setExtensionContent(id: string, content: string): boolean {
    return this.updateExtension(id, { content, enabled: content.trim().length > 0 });
  }

  /** 获取所有启用的扩展 */
  getEnabledExtensions(): ExtensionPrompt[] {
    return Array.from(this.extensions.values())
      .filter((ext) => ext.enabled && ext.content.trim());
  }

  /** 获取所有扩展 */
  getAllExtensions(): ExtensionPrompt[] {
    return Array.from(this.extensions.values());
  }

  /**
   * 构建扩展注入列表
   */
  buildInjections(env: MacroEnv): InjectionResult[] {
    if (!this.config.enabled) return [];

    const injections: InjectionResult[] = [];

    for (const ext of this.getEnabledExtensions()) {
      let content = ext.content;

      if (this.macroEvaluator) {
        content = this.macroEvaluator(content, env);
      }

      if (!content.trim()) continue;

      injections.push({
        message: { role: ext.role, content },
        depth: ext.depth,
        order: ext.order,
        extensionId: ext.id,
      });
    }

    return injections.sort((a, b) => {
      if (a.depth !== b.depth) return b.depth - a.depth;
      return a.order - b.order;
    });
  }

  /**
   * 将扩展注入到消息数组
   */
  injectIntoMessages(messages: ChatMessage[], env: MacroEnv): ChatMessage[] {
    const injections = this.buildInjections(env);
    if (injections.length === 0) return messages;

    const result = [...messages];

    for (const injection of injections) {
      const insertIndex = Math.max(0, result.length - injection.depth);
      result.splice(insertIndex, 0, injection.message);
    }

    return result;
  }

  /** 导出配置 */
  exportConfig(): { config: ExtensionPromptManagerConfig; extensions: ExtensionPrompt[] } {
    return {
      config: { ...this.config },
      extensions: this.getAllExtensions(),
    };
  }

  /** 导入配置 */
  importConfig(data: {
    config?: Partial<ExtensionPromptManagerConfig>;
    extensions?: ExtensionPrompt[];
  }): void {
    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }
    if (data.extensions) {
      for (const ext of data.extensions) {
        this.registerExtension(ext);
      }
    }
  }
}

// ============================================================================
//                              Author's Note 专用
// ============================================================================

/** Author's Note 配置 */
export interface AuthorsNoteConfig {
  content: string;
  depth: number;
  role: MessageRole;
  position: InjectionPosition;
}

/** 默认 Author's Note 配置 */
export const DEFAULT_AUTHORS_NOTE: AuthorsNoteConfig = {
  content: "",
  depth: 4,
  role: "system",
  position: "in_chat",
};

/** Author's Note 管理器 */
export class AuthorsNoteManager {
  private config: AuthorsNoteConfig;
  private extensionManager: ExtensionPromptManager;

  constructor(extensionManager: ExtensionPromptManager, config?: Partial<AuthorsNoteConfig>) {
    this.extensionManager = extensionManager;
    this.config = { ...DEFAULT_AUTHORS_NOTE, ...config };
    this.syncToExtension();
  }

  /** 同步到扩展管理器 */
  private syncToExtension(): void {
    this.extensionManager.updateExtension(EXTENSION_PROMPT_IDS.FLOATING_PROMPT, {
      content: this.config.content,
      depth: this.config.depth,
      role: this.config.role,
      position: this.config.position,
      enabled: this.config.content.trim().length > 0,
    });
  }

  /** 获取内容 */
  getContent(): string {
    return this.config.content;
  }

  /** 设置内容 */
  setContent(content: string): void {
    this.config.content = content;
    this.syncToExtension();
  }

  /** 获取深度 */
  getDepth(): number {
    return this.config.depth;
  }

  /** 设置深度 */
  setDepth(depth: number): void {
    this.config.depth = depth;
    this.syncToExtension();
  }

  /** 获取配置 */
  getConfig(): AuthorsNoteConfig {
    return { ...this.config };
  }

  /** 更新配置 */
  updateConfig(updates: Partial<AuthorsNoteConfig>): void {
    this.config = { ...this.config, ...updates };
    this.syncToExtension();
  }

  /** 清空 */
  clear(): void {
    this.config.content = "";
    this.syncToExtension();
  }
}

// ============================================================================
//                              Memory / Summary 专用
// ============================================================================

/** Memory 配置 */
export interface MemoryConfig {
  content: string;
  depth: number;
  role: MessageRole;
  maxLength: number;
}

/** 默认 Memory 配置 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  content: "",
  depth: 2,
  role: "system",
  maxLength: 2000,
};

/** Memory 管理器 */
export class MemoryManager {
  private config: MemoryConfig;
  private extensionManager: ExtensionPromptManager;

  constructor(extensionManager: ExtensionPromptManager, config?: Partial<MemoryConfig>) {
    this.extensionManager = extensionManager;
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.syncToExtension();
  }

  private syncToExtension(): void {
    const truncatedContent = this.config.content.length > this.config.maxLength
      ? this.config.content.slice(0, this.config.maxLength) + "..."
      : this.config.content;

    this.extensionManager.updateExtension(EXTENSION_PROMPT_IDS.MEMORY, {
      content: truncatedContent,
      depth: this.config.depth,
      role: this.config.role,
      enabled: truncatedContent.trim().length > 0,
    });
  }

  getContent(): string {
    return this.config.content;
  }

  setContent(content: string): void {
    this.config.content = content;
    this.syncToExtension();
  }

  appendContent(content: string): void {
    this.config.content += "\n" + content;
    this.syncToExtension();
  }

  getConfig(): MemoryConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<MemoryConfig>): void {
    this.config = { ...this.config, ...updates };
    this.syncToExtension();
  }

  clear(): void {
    this.config.content = "";
    this.syncToExtension();
  }
}

// ============================================================================
//                              便捷函数
// ============================================================================

/** 创建扩展提示词管理器 */
export function createExtensionPromptManager(
  config?: Partial<ExtensionPromptManagerConfig>,
): ExtensionPromptManager {
  return new ExtensionPromptManager(config);
}

/** 创建 Author's Note 管理器 */
export function createAuthorsNoteManager(
  extensionManager: ExtensionPromptManager,
  config?: Partial<AuthorsNoteConfig>,
): AuthorsNoteManager {
  return new AuthorsNoteManager(extensionManager, config);
}

/** 创建 Memory 管理器 */
export function createMemoryManager(
  extensionManager: ExtensionPromptManager,
  config?: Partial<MemoryConfig>,
): MemoryManager {
  return new MemoryManager(extensionManager, config);
}
