/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     提示词查看器模块导出                                    ║
 * ║                                                                            ║
 * ║  统一导出所有类型定义、服务实现和工具函数                                    ║
 * ║  提供清晰的模块边界和简洁的导入接口                                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义导出
   ═══════════════════════════════════════════════════════════════════════════ */

export type {
  // 核心数据模型
  PromptImage,
  PromptData,
  
  // 搜索和折叠
  CollapsibleRegion,
  SearchResult,
  SearchState,
  
  // UI 状态
  ViewerUIState,
  PromptViewerState,
  
  // 组件属性
  PromptViewerButtonProps,
  PromptViewerModalProps,
  PromptContentProps,
  SearchToolbarProps,
  ImageGalleryProps,
  
  // 服务接口
  PromptInterceptor,
  SearchProcessor,
  PromptViewerActions,
  
  // 错误处理
  PromptViewerError,
} from "@/types/prompt-viewer";

export {
  PromptViewerErrorType,
  PROMPT_VIEWER_CONSTANTS,
  PROMPT_VIEWER_CLASSES,
} from "@/types/prompt-viewer";

/* ═══════════════════════════════════════════════════════════════════════════
   常量和默认值导出
   ═══════════════════════════════════════════════════════════════════════════ */

export {
  // 默认状态
  DEFAULT_UI_STATE,
  DEFAULT_SEARCH_STATE,
  EMPTY_SEARCH_RESULT,
  DEFAULT_PROMPT_VIEWER_STATE,
  
  // 配置常量
  SEARCH_CONFIG,
  UI_CONFIG,
  STORAGE_CONFIG,
  CSS_CLASSES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  
  // 工具函数
  createDefaultUIState,
  createDefaultSearchState,
  createEmptySearchResult,
  generateId,
  isContentTooLarge,
  truncateContent,
  validateSearchQuery,
  createStorageKey,
} from "@/lib/prompt-viewer/constants";

/* ═══════════════════════════════════════════════════════════════════════════
   服务实现导出
   ═══════════════════════════════════════════════════════════════════════════ */

export {
  // 搜索处理器
  SearchProcessorImpl,
  searchProcessor,
  renderCollapsibleRegion,
  applySearchResult,
} from "@/lib/prompt-viewer/search-processor";

export {
  // 提示词拦截器
  PromptInterceptorImpl,
  promptInterceptor,
  createPromptDataBuilder,
} from "@/lib/prompt-viewer/prompt-interceptor";

export {
  // 资源管理器
  resourceManager,
  registerComponentCleanup,
  unregisterComponentCleanup,
  useResourceCleanup,
  getResourceManagerStatus,
} from "@/lib/prompt-viewer/resource-manager";

export {
  // 清理功能
  cleanupDialogue,
  cleanupAll,
  cleanupExpired,
  getCleanupStatus,
  useDialogueCleanup,
  useGlobalCleanup,
  enableCleanupMonitoring,
} from "@/lib/prompt-viewer/cleanup";

export {
  // 性能优化
  PERFORMANCE_CONFIG,
  LRUCache,
  useDebounce,
  useThrottle,
  useContentChunking,
  useBatchRender,
  useCache,
  useIdleCallback,
  usePerformanceMonitor,
  performanceUtils,
} from "@/lib/prompt-viewer/performance";

/* ═══════════════════════════════════════════════════════════════════════════
   状态管理导出
   ═══════════════════════════════════════════════════════════════════════════ */

export {
  // 主要 store
  usePromptViewerStore,
  
  // 选择器 hooks
  usePromptData,
  useViewerUIState,
  useInterceptionState,
  
  // 操作 hooks
  useModalActions,
  useSearchActions,
  useUIActions,
  useInterceptionActions,
  useCleanupActions,
} from "@/lib/store/prompt-viewer-store";

/* ═══════════════════════════════════════════════════════════════════════════
   工具函数
   ═══════════════════════════════════════════════════════════════════════════ */

// 工具函数将在组件中直接导入相应的服务

/**
 * 初始化提示词查看器
 * 执行必要的初始化逻辑
 */
export function initializePromptViewer() {
  console.log("[PromptViewer] 初始化提示词查看器模块");
  
  // 这里可以添加初始化逻辑
  // 例如：注册全局事件监听器、清理过期数据等
  
  return {
    initialized: true,
    timestamp: Date.now(),
  };
}

/**
 * 清理提示词查看器资源
 * 在应用卸载时调用
 */
export async function cleanupPromptViewer() {
  console.log("[PromptViewer] 清理提示词查看器资源");
  
  try {
    // 使用统一的清理接口
    const { cleanupAll } = await import("@/lib/prompt-viewer/cleanup");
    await cleanupAll();
  } catch (error) {
    console.error("[PromptViewer] 清理资源失败:", error);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   版本信息
   ═══════════════════════════════════════════════════════════════════════════ */

export const PROMPT_VIEWER_VERSION = "1.0.0" as const;
export const PROMPT_VIEWER_BUILD_DATE = new Date().toISOString();
