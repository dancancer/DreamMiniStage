/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     提示词查看器类型定义                                    ║
 * ║                                                                            ║
 * ║  核心数据结构：提示词数据、搜索状态、UI 状态、服务接口                        ║
 * ║  设计原则：消除特殊情况，统一处理逻辑，保持简洁实用                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

/* ═══════════════════════════════════════════════════════════════════════════
   核心数据模型
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 提示词图片数据
 * 统一处理 base64 和 URL 两种图片类型
 */
export interface PromptImage {
  readonly id: string;
  readonly url: string;
  readonly type: "base64" | "url";
  readonly mimeType?: string;
}

/**
 * 单条消息数据（用于消息卡片展示）
 * 与 LLM API 格式对应
 */
export interface PromptMessage {
  readonly id: string;
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

/**
 * 提示词完整数据
 * 包含所有必要信息，无特殊情况处理
 */
export interface PromptData {
  readonly id: string;
  readonly timestamp: number;
  readonly systemMessage: string;
  readonly userMessage: string;
  readonly fullPrompt: string;
  readonly images: readonly PromptImage[];
  readonly metadata: {
    readonly characterId: string;
    readonly dialogueKey: string;
    readonly modelName: string;
    readonly temperature?: number;
  };
  /** 消息列表（用于卡片展示，与 LLM API 格式对应） */
  readonly messages: readonly PromptMessage[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   搜索和折叠相关数据结构
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 可折叠区域定义
 * 统一表示所有可折叠的文本段落
 */
export interface CollapsibleRegion {
  readonly id: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly lineCount: number;
  readonly content: string;
  readonly isExpanded: boolean;
}

/**
 * 搜索结果数据
 * 包含匹配信息和渲染所需的所有数据
 */
export interface SearchResult {
  readonly matches: readonly RegExpMatchArray[];
  readonly highlightedContent: string;
  readonly collapsibleRegions: readonly CollapsibleRegion[];
  readonly hasMatches: boolean;
}

/**
 * 搜索状态
 * 简化的搜索配置，无复杂分支
 */
export interface SearchState {
  readonly query: string;
  readonly regex: RegExp | null;
  readonly matchedOnly: boolean;
  readonly isValid: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   UI 状态管理
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 单个查看器的 UI 状态
 * 按对话键组织，避免状态混乱
 */
export interface ViewerUIState {
  readonly isOpen: boolean;
  readonly searchInput: string;
  readonly matchedOnly: boolean;
  readonly expandedRegions: ReadonlySet<string>;
  readonly imageGalleryExpanded: boolean;
  readonly isLoading: boolean;
  readonly error: string | null;
}

/**
 * 全局查看器状态
 * 使用 Record 统一管理多个对话的状态
 */
export interface PromptViewerState {
  readonly prompts: Record<string, PromptData>;
  readonly intercepting: Record<string, boolean>;
  readonly uiStates: Record<string, ViewerUIState>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   组件属性接口
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 触发按钮组件属性
 */
export interface PromptViewerButtonProps {
  readonly dialogueKey: string;
  readonly characterId: string;
  readonly className?: string;
  readonly disabled?: boolean;
}

/**
 * 主弹窗组件属性
 */
export interface PromptViewerModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly dialogueKey: string;
  readonly characterId: string;
}

/**
 * 内容显示组件属性
 */
export interface PromptContentProps {
  /** 消息列表（用于卡片展示，新版UI） */
  readonly messages?: readonly PromptMessage[];
  /** 完整内容（用于搜索和兼容旧版显示） */
  readonly content: string;
  readonly searchResult: SearchResult | null;
  readonly expandedRegions: ReadonlySet<string>;
  readonly onToggleRegion: (regionId: string) => void;
  /** 消息折叠状态（key: message id, value: is expanded） */
  readonly expandedMessages?: ReadonlySet<string>;
  readonly onToggleMessage?: (messageId: string) => void;
  readonly images?: readonly PromptImage[];
  readonly imageGalleryExpanded?: boolean;
  readonly onToggleImageGallery?: () => void;
}

/**
 * 搜索工具栏组件属性
 */
export interface SearchToolbarProps {
  readonly searchInput: string;
  readonly onSearchChange: (value: string) => void;
  readonly matchedOnly: boolean;
  readonly onMatchedOnlyChange: (value: boolean) => void;
  readonly onRefresh: () => void;
  readonly isLoading: boolean;
}

/**
 * 图片画廊组件属性
 */
export interface ImageGalleryProps {
  readonly images: readonly PromptImage[];
  readonly isExpanded: boolean;
  readonly onToggleExpanded: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   服务接口定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 提示词拦截器接口
 * 统一的拦截和获取逻辑，无特殊情况
 */
export interface PromptInterceptor {
  /**
   * 开始拦截指定对话的生成请求
   */
  startInterception(dialogueKey: string): void;

  /**
   * 停止拦截指定对话的生成请求
   */
  stopInterception(dialogueKey: string): void;

  /**
   * 手动触发拦截（用于刷新功能）
   */
  triggerInterception(dialogueKey: string, characterId: string): Promise<PromptData>;

  /**
   * 获取最新的提示词数据
   */
  getLatestPrompt(dialogueKey: string): PromptData | null;

  /**
   * 检查是否正在拦截
   */
  isIntercepting(dialogueKey: string): boolean;
}

/**
 * 搜索处理器接口
 * 纯函数式设计，无副作用
 */
export interface SearchProcessor {
  /**
   * 处理搜索查询，返回完整结果
   */
  processSearch(content: string, searchState: SearchState): SearchResult;

  /**
   * 创建搜索状态
   */
  createSearchState(query: string, matchedOnly: boolean): SearchState;

  /**
   * 高亮匹配文本
   */
  highlightMatches(content: string, regex: RegExp): string;

  /**
   * 计算折叠区域
   */
  calculateCollapsibleRegions(
    content: string,
    matches: readonly RegExpMatchArray[],
    contextLines: number
  ): readonly CollapsibleRegion[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   状态管理操作接口
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 状态管理操作
 * 简洁的操作接口，避免复杂的状态变更逻辑
 */
export interface PromptViewerActions {
  // ========== 弹窗控制 ==========
  openModal: (dialogueKey: string) => void;
  closeModal: (dialogueKey: string) => void;

  // ========== 提示词管理 ==========
  updatePrompt: (dialogueKey: string, prompt: PromptData) => void;
  refreshPrompt: (dialogueKey: string, characterId: string) => Promise<void>;

  // ========== 搜索控制 ==========
  setSearchInput: (dialogueKey: string, input: string) => void;
  toggleMatchedOnly: (dialogueKey: string) => void;

  // ========== UI 状态控制 ==========
  toggleRegionExpansion: (dialogueKey: string, regionId: string) => void;
  toggleImageGallery: (dialogueKey: string) => void;
  setLoading: (dialogueKey: string, loading: boolean) => void;
  setError: (dialogueKey: string, error: string | null) => void;

  // ========== 拦截控制 ==========
  startInterception: (dialogueKey: string) => Promise<void>;
  stopInterception: (dialogueKey: string) => Promise<void>;

  // ========== 查询方法 ==========
  getPrompt: (dialogueKey: string) => PromptData | null;
  getUIState: (dialogueKey: string) => ViewerUIState;
  isIntercepting: (dialogueKey: string) => boolean;

  // ========== 资源清理 ==========
  cleanup: (dialogueKey?: string) => void;
  cleanupExpired: () => void;
  destroy: () => Promise<void>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   错误处理类型
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 错误类型枚举
 * 统一的错误分类，便于处理
 */
export const enum PromptViewerErrorType {
  INTERCEPTION_FAILED = "INTERCEPTION_FAILED",
  SEARCH_INVALID = "SEARCH_INVALID",
  CONTENT_TOO_LARGE = "CONTENT_TOO_LARGE",
  IMAGE_LOAD_FAILED = "IMAGE_LOAD_FAILED",
  NETWORK_ERROR = "NETWORK_ERROR",
  COMPONENT_ERROR = "COMPONENT_ERROR",
  UNKNOWN = "UNKNOWN",
}

/**
 * 错误信息结构
 */
export interface PromptViewerError {
  readonly type: PromptViewerErrorType;
  readonly message: string;
  readonly details?: unknown;
  readonly timestamp: number;
}

/**
 * 错误边界组件属性
 */
export interface PromptViewerErrorBoundaryProps {
  readonly children: React.ReactNode;
  readonly fallback?: React.ReactNode;
  readonly onError?: (error: PromptViewerError) => void;
  readonly maxRetries?: number;
  readonly className?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   常量定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 默认配置常量
 * 避免魔法数字，统一配置管理
 */
export const PROMPT_VIEWER_CONSTANTS = {
  // 搜索相关
  CONTEXT_LINES: 2,
  MAX_CONTENT_LENGTH: 50000,
  SEARCH_DEBOUNCE_MS: 300,

  // UI 相关
  MAX_IMAGE_HEIGHT: 240,
  MODAL_Z_INDEX: 1000,
  ANIMATION_DURATION_MS: 200,

  // 存储相关
  STORAGE_KEY_PREFIX: "prompt-viewer:",
  MAX_STORED_PROMPTS: 10,
} as const;

/**
 * CSS 类名常量
 * 统一样式类名管理
 */
export const PROMPT_VIEWER_CLASSES = {
  // 高亮样式
  HIGHLIGHT: "prompt-viewer-highlight",
  HIGHLIGHT_MATCH: "prompt-viewer-highlight-match",

  // 折叠样式
  COLLAPSIBLE: "prompt-viewer-collapsible",
  COLLAPSIBLE_EXPANDED: "prompt-viewer-collapsible-expanded",
  COLLAPSIBLE_BUTTON: "prompt-viewer-collapsible-button",

  // 图片样式
  IMAGE_GALLERY: "prompt-viewer-image-gallery",
  IMAGE_THUMBNAIL: "prompt-viewer-image-thumbnail",

  // 状态样式
  LOADING: "prompt-viewer-loading",
  ERROR: "prompt-viewer-error",
} as const;