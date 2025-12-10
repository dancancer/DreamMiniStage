/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                     提示词查看器组件导出                                   ║
 * ║                                                                           ║
 * ║  统一导出所有提示词查看器相关组件                                           ║
 * ║  保持简洁的导入路径和清晰的组件组织                                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

// ========== 主要组件 ==========
export { PromptViewerModal, default as PromptViewerModalDefault } from "./PromptViewerModal";
export { PromptViewerButton, default as PromptViewerButtonDefault } from "./PromptViewerButton";

// ========== 工具栏组件 ==========
export { SearchToolbar, default as SearchToolbarDefault } from "./SearchToolbar";
export { SearchToolbarExample, default as SearchToolbarExampleDefault } from "./SearchToolbarExample";

// ========== 内容显示组件 ==========
export { PromptContent, default as PromptContentDefault } from "./PromptContent";
export { ImageGallery, default as ImageGalleryDefault } from "./ImageGallery";

// ========== 错误处理组件 ==========
export { 
  PromptViewerErrorBoundary, 
  default as PromptViewerErrorBoundaryDefault,
  withPromptViewerErrorBoundary,
  createErrorHandler,
  safeExecute,
  safeExecuteAsync,
} from "./PromptViewerErrorBoundary";

// ========== 类型导出 ==========
export type { 
  PromptViewerModalProps,
  PromptViewerButtonProps,
  SearchToolbarProps,
  PromptContentProps,
  ImageGalleryProps,
  PromptViewerErrorBoundaryProps,
  PromptViewerError,
  PromptViewerErrorType,
} from "@/types/prompt-viewer";
