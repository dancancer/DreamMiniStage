/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    提示词查看器样式配置                                    ║
 * ║                                                                           ║
 * ║  统一管理响应式设计、主题样式、动画效果                                     ║
 * ║  设计原则：消除重复样式、统一视觉语言、优化性能                             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   响应式断点配置
   ═══════════════════════════════════════════════════════════════════════════ */

export const BREAKPOINTS = {
  mobile: "max-width: 767px",
  tablet: "min-width: 768px and max-width: 1023px", 
  desktop: "min-width: 1024px",
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   主题颜色配置
   ═══════════════════════════════════════════════════════════════════════════ */

export const THEME_COLORS = {
  // 基础颜色
  background: "bg-background",
  foreground: "text-foreground",
  muted: "text-muted-foreground",
  
  // 边框和分割线
  border: "border-border",
  divider: "border-border/50",
  
  // 交互状态
  hover: "hover:bg-muted-surface/50",
  focus: "focus:border-primary-soft focus:outline-none",
  active: "bg-primary text-overlay border-primary",
  
  // 状态颜色
  success: "text-success border-success",
  info: "text-info border-info", 
  warning: "text-warning border-warning",
  error: "text-destructive border-destructive",
  
  // 表面颜色
  surface: "bg-overlay",
  elevated: "bg-card",
  deep: "bg-deep",
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   组件样式配置
   ═══════════════════════════════════════════════════════════════════════════ */

export const COMPONENT_STYLES = {
  // 按钮样式
  button: {
    base: cn(
      "h-auto px-1.5 sm:px-2 md:px-4 py-1.5",
      "text-xs whitespace-nowrap min-w-fit",
      "transition-all duration-200",
      "border rounded-md",
      THEME_COLORS.focus,
    ),
    primary: cn(
      THEME_COLORS.surface,
      "text-info border-border hover:border-info",
    ),
    active: cn(
      THEME_COLORS.active,
      "shadow-[0_0_8px_rgba(209,163,92,0.3)]",
    ),
    error: cn(
      "bg-destructive/10 text-destructive",
      "border-destructive/30 hover:border-destructive",
    ),
    loading: "opacity-75 cursor-not-allowed",
  },

  // 模态框样式
  modal: {
    overlay: "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm",
    content: cn(
      "fixed left-[50%] top-[50%] z-50",
      "translate-x-[-50%] translate-y-[-50%]",
      "w-[90vw] max-w-4xl max-h-[85vh]",
      "sm:max-w-3xl md:max-w-4xl lg:max-w-5xl",
      "p-0 gap-0 rounded-lg",
      THEME_COLORS.background,
      THEME_COLORS.border,
      "border shadow-lg",
    ),
    header: cn(
      "px-6 py-4 border-b",
      THEME_COLORS.divider,
    ),
    body: "flex flex-col h-full min-h-0",
  },

  // 搜索工具栏样式
  toolbar: {
    container: cn(
      "flex items-center gap-3 p-4 border-b",
      THEME_COLORS.divider,
      "bg-background/50",
    ),
    searchInput: cn(
      "w-full pl-10 pr-10 py-2 text-sm",
      "bg-overlay border border-border rounded-md",
      "text-cream placeholder:text-muted-foreground",
      "focus:outline-none focus:border-primary-soft",
      "transition-all duration-300",
    ),
    searchIcon: "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none",
    clearButton: "absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground",
  },

  // 内容显示样式
  content: {
    container: cn(
      "h-full overflow-y-auto",
      "fantasy-scrollbar", // 自定义滚动条
    ),
    textArea: cn(
      "bg-overlay border border-border rounded-md p-4",
      "font-mono text-sm leading-relaxed",
      "max-h-[60vh] overflow-y-auto",
      "text-cream whitespace-pre-wrap break-words",
    ),
    highlight: cn(
      "bg-primary-900/30 text-primary-300",
      "px-1 rounded",
    ),
    collapsible: {
      button: cn(
        "w-full justify-start gap-2 p-4",
        "text-muted-foreground hover:text-foreground",
        "hover:bg-muted-surface/50 transition-colors duration-200",
        "border-0 rounded-none",
      ),
      content: "p-4 pt-0",
      expanded: "animate-in slide-in-from-top-2 duration-300",
    },
  },

  // 图片画廊样式
  gallery: {
    container: cn(
      "border-t",
      THEME_COLORS.divider,
      "bg-background/50",
    ),
    header: cn(
      "flex items-center justify-between p-4",
      "text-sm text-muted-foreground",
    ),
    grid: cn(
      "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4",
      "animate-in fade-in slide-in-from-top-2 duration-500",
    ),
    image: cn(
      "w-full max-h-60 object-cover rounded-md",
      "border border-border",
      "transition-transform duration-200",
      "hover:scale-105",
    ),
  },
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   响应式工具函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 根据屏幕尺寸返回不同的样式类
 */
export function getResponsiveClasses(config: {
  mobile?: string;
  tablet?: string;
  desktop?: string;
  base?: string;
}): string {
  const { mobile = "", tablet = "", desktop = "", base = "" } = config;
  
  return cn(
    base,
    mobile && `sm:${mobile}`,
    tablet && `md:${tablet}`,
    desktop && `lg:${desktop}`,
  );
}

/**
 * 获取按钮的响应式样式
 */
export function getButtonResponsiveStyles(): string {
  return getResponsiveClasses({
    base: "px-1.5 py-1.5 text-2xs",
    mobile: "px-2 text-xs",
    desktop: "px-4 text-xs",
  });
}

/**
 * 获取模态框的响应式样式
 */
export function getModalResponsiveStyles(): string {
  return getResponsiveClasses({
    base: "w-[90vw] max-w-lg",
    mobile: "max-w-3xl",
    tablet: "max-w-4xl", 
    desktop: "max-w-5xl",
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   动画配置
   ═══════════════════════════════════════════════════════════════════════════ */

export const ANIMATIONS = {
  // 淡入动画
  fadeIn: "animate-in fade-in duration-300",
  
  // 滑入动画
  slideInFromBottom: "animate-in slide-in-from-bottom-2 duration-500",
  slideInFromTop: "animate-in slide-in-from-top-2 duration-300",
  
  // 悬停效果
  hoverLift: "hover:-translate-y-0.5 duration-200",
  hoverScale: "hover:scale-105 duration-150",
  
  // 颜色过渡
  colorTransition: "transition-colors duration-200",
  
  // 全面过渡
  allTransition: "transition-all duration-300",
  
  // 旋转动画
  spin: "animate-spin",
  pulse: "animate-pulse",
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   状态样式工具函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 根据状态获取按钮样式
 */
export function getButtonStateStyles(state: {
  isActive?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  disabled?: boolean;
}): string {
  const { isActive, isLoading, hasError, disabled } = state;
  
  if (disabled || isLoading) {
    return cn(COMPONENT_STYLES.button.base, COMPONENT_STYLES.button.loading);
  }
  
  if (hasError) {
    return cn(COMPONENT_STYLES.button.base, COMPONENT_STYLES.button.error);
  }
  
  if (isActive) {
    return cn(COMPONENT_STYLES.button.base, COMPONENT_STYLES.button.active);
  }
  
  return cn(COMPONENT_STYLES.button.base, COMPONENT_STYLES.button.primary);
}

/**
 * 获取文本内容的样式
 */
export function getContentTextStyles(hasHighlight: boolean = false): string {
  const baseStyles = cn(
    "font-mono text-sm leading-relaxed",
    "text-cream whitespace-pre-wrap break-words",
  );
  
  if (hasHighlight) {
    return cn(
      baseStyles,
      `[&_.highlight-match]:${COMPONENT_STYLES.content.highlight}`,
    );
  }
  
  return baseStyles;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主题检测工具
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 检测当前是否为暗色主题
 */
export function isDarkTheme(): boolean {
  if (typeof window === "undefined") return false;
  
  return (
    document.documentElement.classList.contains("dark") ||
    document.documentElement.getAttribute("data-theme") === "dark"
  );
}

/**
 * 根据主题返回不同的样式
 */
export function getThemeAwareStyles(lightStyles: string, darkStyles: string): string {
  return isDarkTheme() ? darkStyles : lightStyles;
}

/* ═══════════════════════════════════════════════════════════════════════════
   性能优化样式
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 获取优化的滚动条样式
 */
export function getOptimizedScrollbarStyles(): string {
  return cn(
    "scrollbar-thin scrollbar-track-transparent",
    "scrollbar-thumb-border scrollbar-thumb-rounded-full",
    // 使用 CSS 变量确保主题一致性
    "[scrollbar-color:var(--border)_transparent]",
  );
}

/**
 * 获取硬件加速的动画样式
 */
export function getHardwareAcceleratedStyles(): string {
  return cn(
    "transform-gpu", // 启用 GPU 加速
    "will-change-transform", // 提示浏览器优化
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出默认样式配置
   ═══════════════════════════════════════════════════════════════════════════ */

export const DEFAULT_STYLES = {
  button: COMPONENT_STYLES.button.base,
  modal: COMPONENT_STYLES.modal.content,
  toolbar: COMPONENT_STYLES.toolbar.container,
  content: COMPONENT_STYLES.content.textArea,
  animation: ANIMATIONS.allTransition,
} as const;
