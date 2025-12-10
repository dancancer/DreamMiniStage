/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     提示词查看器常量和默认值                                ║
 * ║                                                                            ║
 * ║  统一的常量定义和默认状态，消除魔法数字和特殊情况                            ║
 * ║  设计原则：单一数据源，类型安全，可预测的默认行为                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  ViewerUIState,
  PromptViewerState,
  SearchState,
  SearchResult,
} from "@/types/prompt-viewer";

/* ═══════════════════════════════════════════════════════════════════════════
   默认状态定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 默认 UI 状态
 * 所有布尔值默认为 false，字符串默认为空，集合默认为空集合
 * 遵循"零值有意义"原则
 */
export const DEFAULT_UI_STATE: ViewerUIState = {
  isOpen: false,
  searchInput: "",
  matchedOnly: false,
  expandedRegions: new Set<string>(),
  imageGalleryExpanded: false,
  isLoading: false,
  error: null,
} as const;

/**
 * 默认搜索状态
 * 空查询，无正则表达式，显示全部内容
 */
export const DEFAULT_SEARCH_STATE: SearchState = {
  query: "",
  regex: null,
  matchedOnly: false,
  isValid: true,
} as const;

/**
 * 空搜索结果
 * 用于初始状态和搜索失败时的降级
 */
export const EMPTY_SEARCH_RESULT: SearchResult = {
  matches: [],
  highlightedContent: "",
  collapsibleRegions: [],
  hasMatches: false,
} as const;

/**
 * 默认全局状态
 * 空的记录对象，按需创建子状态
 */
export const DEFAULT_PROMPT_VIEWER_STATE: PromptViewerState = {
  prompts: {},
  intercepting: {},
  uiStates: {},
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   配置常量
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 搜索配置
 */
export const SEARCH_CONFIG = {
  /** 搜索结果上下文行数 */
  CONTEXT_LINES: 2,
  /** 内容最大长度限制 */
  MAX_CONTENT_LENGTH: 50000,
  /** 搜索输入防抖延迟 */
  DEBOUNCE_MS: 300,
  /** 最小搜索查询长度 */
  MIN_QUERY_LENGTH: 1,
  /** 正则表达式标志 */
  REGEX_FLAGS: "gi" as const,
} as const;

/**
 * UI 配置
 */
export const UI_CONFIG = {
  /** 图片最大高度 */
  MAX_IMAGE_HEIGHT: 240,
  /** 弹窗 z-index */
  MODAL_Z_INDEX: 1000,
  /** 动画持续时间 */
  ANIMATION_DURATION_MS: 200,
  /** 折叠按钮显示的最小行数 */
  MIN_COLLAPSIBLE_LINES: 3,
} as const;

/**
 * 存储配置
 */
export const STORAGE_CONFIG = {
  /** 本地存储键前缀 */
  KEY_PREFIX: "prompt-viewer:",
  /** 最大存储的提示词数量 */
  MAX_STORED_PROMPTS: 10,
  /** 数据过期时间（毫秒） */
  EXPIRY_MS: 24 * 60 * 60 * 1000, // 24小时
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   CSS 类名常量
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * CSS 类名映射
 * 统一管理所有样式类名，避免字符串散落在代码中
 */
export const CSS_CLASSES = {
  // 基础组件类名
  VIEWER_BUTTON: "prompt-viewer-button",
  VIEWER_MODAL: "prompt-viewer-modal",
  VIEWER_CONTENT: "prompt-viewer-content",
  SEARCH_TOOLBAR: "prompt-viewer-search-toolbar",
  IMAGE_GALLERY: "prompt-viewer-image-gallery",

  // 搜索高亮类名
  HIGHLIGHT_CONTAINER: "prompt-viewer-highlight-container",
  HIGHLIGHT_MATCH: "prompt-viewer-highlight-match",
  HIGHLIGHT_CONTEXT: "prompt-viewer-highlight-context",

  // 折叠相关类名
  COLLAPSIBLE_REGION: "prompt-viewer-collapsible-region",
  COLLAPSIBLE_BUTTON: "prompt-viewer-collapsible-button",
  COLLAPSIBLE_CONTENT: "prompt-viewer-collapsible-content",
  COLLAPSIBLE_EXPANDED: "prompt-viewer-collapsible-expanded",

  // 图片相关类名
  IMAGE_THUMBNAIL: "prompt-viewer-image-thumbnail",
  IMAGE_CONTAINER: "prompt-viewer-image-container",
  IMAGE_GALLERY_TOGGLE: "prompt-viewer-image-gallery-toggle",

  // 状态类名
  LOADING: "prompt-viewer-loading",
  ERROR: "prompt-viewer-error",
  EMPTY: "prompt-viewer-empty",
  DISABLED: "prompt-viewer-disabled",
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   错误消息常量
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 错误消息映射
 * 统一的错误提示文本，支持国际化
 */
export const ERROR_MESSAGES = {
  INTERCEPTION_FAILED: "无法拦截提示词，请检查对话状态",
  SEARCH_INVALID: "搜索表达式无效，请检查语法",
  CONTENT_TOO_LARGE: "内容过大，已截断显示",
  IMAGE_LOAD_FAILED: "图片加载失败",
  UNKNOWN: "发生未知错误",
  NETWORK_ERROR: "网络连接错误，请重试",
  PERMISSION_DENIED: "权限不足，无法访问提示词",
} as const;

/**
 * 成功消息映射
 */
export const SUCCESS_MESSAGES = {
  PROMPT_LOADED: "提示词加载成功",
  SEARCH_COMPLETED: "搜索完成",
  INTERCEPTION_STARTED: "开始拦截提示词",
  INTERCEPTION_STOPPED: "停止拦截提示词",
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   工具函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 创建默认 UI 状态
 * 确保每次都返回新的对象实例，避免状态共享
 */
export function createDefaultUIState(): ViewerUIState {
  return {
    ...DEFAULT_UI_STATE,
    expandedRegions: new Set<string>(),
  };
}

/**
 * 创建默认搜索状态
 */
export function createDefaultSearchState(): SearchState {
  return { ...DEFAULT_SEARCH_STATE };
}

/**
 * 创建空搜索结果
 */
export function createEmptySearchResult(): SearchResult {
  return {
    ...EMPTY_SEARCH_RESULT,
    matches: [],
    collapsibleRegions: [],
  };
}

/**
 * 生成唯一 ID
 * 用于折叠区域和其他需要唯一标识的元素
 */
export function generateId(prefix: string = "pv"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 检查内容是否过大
 */
export function isContentTooLarge(content: string): boolean {
  return content.length > SEARCH_CONFIG.MAX_CONTENT_LENGTH;
}

/**
 * 截断过大的内容
 */
export function truncateContent(content: string): string {
  if (!isContentTooLarge(content)) {
    return content;
  }
  
  const truncated = content.substring(0, SEARCH_CONFIG.MAX_CONTENT_LENGTH);
  const lastNewline = truncated.lastIndexOf("\n");
  
  // 在最后一个完整行处截断，避免截断到单词中间
  return lastNewline > 0 
    ? truncated.substring(0, lastNewline) + "\n\n[内容已截断...]"
    : truncated + "\n\n[内容已截断...]";
}

/**
 * 验证搜索查询
 */
export function validateSearchQuery(query: string): { isValid: boolean; error?: string } {
  if (!query.trim()) {
    return { isValid: true }; // 空查询是有效的
  }

  if (query.length < SEARCH_CONFIG.MIN_QUERY_LENGTH) {
    return { isValid: false, error: "搜索查询过短" };
  }

  try {
    new RegExp(query, SEARCH_CONFIG.REGEX_FLAGS);
    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: "正则表达式语法错误" };
  }
}

/**
 * 创建存储键
 */
export function createStorageKey(dialogueKey: string, suffix: string = ""): string {
  const key = `${STORAGE_CONFIG.KEY_PREFIX}${dialogueKey}`;
  return suffix ? `${key}:${suffix}` : key;
}
