/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    提示词查看器移动端适配                                  ║
 * ║                                                                           ║
 * ║  触摸交互、屏幕适配、性能优化、用户体验                                     ║
 * ║  设计原则：移动优先、触摸友好、性能至上                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   移动端检测
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 检测是否为移动设备
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

/**
 * 检测是否为触摸设备
 */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * 移动端检测 Hook
 */
export function useMobileDetection() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [screenSize, setScreenSize] = useState({
    width: 0,
    height: 0,
    orientation: "portrait" as "portrait" | "landscape",
  });

  useEffect(() => {
    const updateDeviceInfo = () => {
      setIsMobile(isMobileDevice());
      setIsTouch(isTouchDevice());
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
        orientation: window.innerWidth > window.innerHeight ? "landscape" : "portrait",
      });
    };

    updateDeviceInfo();

    const handleResize = () => {
      updateDeviceInfo();
    };

    const handleOrientationChange = () => {
      // 延迟更新，等待屏幕旋转完成
      setTimeout(updateDeviceInfo, 100);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientationChange);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, []);

  return {
    isMobile,
    isTouch,
    screenSize,
    isPortrait: screenSize.orientation === "portrait",
    isLandscape: screenSize.orientation === "landscape",
    isSmallScreen: screenSize.width < 768,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端样式配置
   ═══════════════════════════════════════════════════════════════════════════ */

export const MOBILE_STYLES = {
  // 按钮样式
  button: {
    mobile: cn(
      "px-2 py-2 text-xs",
      "min-h-[44px]", // iOS 推荐的最小触摸目标
      "touch-manipulation", // 优化触摸响应
    ),
    tablet: cn(
      "px-3 py-2 text-sm",
      "min-h-[40px]",
    ),
    desktop: cn(
      "px-4 py-2 text-sm",
      "min-h-[36px]",
    ),
  },

  // 模态框样式
  modal: {
    mobile: cn(
      "w-[95vw] h-[90vh]",
      "max-w-none max-h-none",
      "m-2 rounded-lg",
      "fixed inset-2",
    ),
    tablet: cn(
      "w-[85vw] h-[80vh]",
      "max-w-4xl max-h-[80vh]",
      "rounded-xl",
    ),
    desktop: cn(
      "w-[90vw] max-w-5xl",
      "max-h-[85vh]",
      "rounded-xl",
    ),
  },

  // 搜索工具栏样式
  toolbar: {
    mobile: cn(
      "flex-col gap-2 p-3",
      "border-b border-border",
    ),
    tablet: cn(
      "flex-row gap-3 p-4",
      "border-b border-border",
    ),
    desktop: cn(
      "flex-row gap-4 p-4",
      "border-b border-border",
    ),
  },

  // 内容区域样式
  content: {
    mobile: cn(
      "p-3 text-xs leading-relaxed",
      "max-h-[50vh] overflow-y-auto",
      "touch-pan-y", // 允许垂直滚动
    ),
    tablet: cn(
      "p-4 text-sm leading-relaxed",
      "max-h-[60vh] overflow-y-auto",
    ),
    desktop: cn(
      "p-4 text-sm leading-relaxed",
      "max-h-[60vh] overflow-y-auto",
    ),
  },
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   响应式样式工具
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 根据设备类型获取样式
 */
export function getResponsiveStyles(
  component: keyof typeof MOBILE_STYLES,
  deviceInfo: ReturnType<typeof useMobileDetection>,
): string {
  const styles = MOBILE_STYLES[component];
  
  if (deviceInfo.isSmallScreen) {
    return styles.mobile;
  }
  
  if (deviceInfo.screenSize.width < 1024) {
    return styles.tablet;
  }
  
  return styles.desktop;
}

/**
 * 移动端优化的样式 Hook
 */
export function useMobileStyles(component: keyof typeof MOBILE_STYLES) {
  const deviceInfo = useMobileDetection();
  
  return getResponsiveStyles(component, deviceInfo);
}

/* ═══════════════════════════════════════════════════════════════════════════
   触摸交互优化
   ═══════════════════════════════════════════════════════════════════════════ */

interface TouchGestureConfig {
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

/**
 * 触摸手势处理 Hook
 */
export function useTouchGestures(config: TouchGestureConfig) {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout>(null);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    // 长按检测
    if (config.onLongPress) {
      longPressTimeoutRef.current = setTimeout(() => {
        config.onLongPress?.();
      }, 500);
    }
  }, [config]);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    // 清除长按定时器
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // 判断是否为点击（移动距离小且时间短）
    if (distance < 10 && deltaTime < 300) {
      tapCountRef.current++;

      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }

      tapTimeoutRef.current = setTimeout(() => {
        if (tapCountRef.current === 1) {
          config.onTap?.();
        } else if (tapCountRef.current === 2) {
          config.onDoubleTap?.();
        }
        tapCountRef.current = 0;
      }, 300);
    }
    // 判断滑动手势
    else if (distance > 50 && deltaTime < 500) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > absY) {
        // 水平滑动
        if (deltaX > 0) {
          config.onSwipeRight?.();
        } else {
          config.onSwipeLeft?.();
        }
      } else {
        // 垂直滑动
        if (deltaY > 0) {
          config.onSwipeDown?.();
        } else {
          config.onSwipeUp?.();
        }
      }
    }

    touchStartRef.current = null;
  }, [config]);

  const handleTouchMove = useCallback(() => {
    // 移动时取消长按
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchMove: handleTouchMove,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   虚拟键盘处理
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 虚拟键盘处理 Hook
 */
export function useVirtualKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initialViewportHeight = window.visualViewport?.height || window.innerHeight;

    const handleViewportChange = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightDiff = initialViewportHeight - currentHeight;
      
      if (heightDiff > 150) {
        // 键盘可能已显示
        setKeyboardHeight(heightDiff);
        setIsKeyboardVisible(true);
      } else {
        // 键盘可能已隐藏
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportChange);
      return () => {
        window.visualViewport?.removeEventListener("resize", handleViewportChange);
      };
    } else {
      // 降级处理
      window.addEventListener("resize", handleViewportChange);
      return () => {
        window.removeEventListener("resize", handleViewportChange);
      };
    }
  }, []);

  return {
    keyboardHeight,
    isKeyboardVisible,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   安全区域处理
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 安全区域处理 Hook
 */
export function useSafeArea() {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateSafeArea = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      
      setSafeArea({
        top: parseInt(computedStyle.getPropertyValue("env(safe-area-inset-top)") || "0"),
        right: parseInt(computedStyle.getPropertyValue("env(safe-area-inset-right)") || "0"),
        bottom: parseInt(computedStyle.getPropertyValue("env(safe-area-inset-bottom)") || "0"),
        left: parseInt(computedStyle.getPropertyValue("env(safe-area-inset-left)") || "0"),
      });
    };

    updateSafeArea();

    const handleOrientationChange = () => {
      setTimeout(updateSafeArea, 100);
    };

    window.addEventListener("orientationchange", handleOrientationChange);
    return () => {
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, []);

  return safeArea;
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端性能优化
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 移动端性能优化配置
 */
export const MOBILE_PERFORMANCE = {
  // 减少动画复杂度
  REDUCED_MOTION: {
    duration: 200, // 更短的动画时间
    easing: "ease-out", // 简单的缓动函数
  },
  
  // 触摸优化
  TOUCH_OPTIMIZATION: {
    touchAction: "manipulation", // 禁用双击缩放
    userSelect: "none", // 禁用文本选择
    webkitTouchCallout: "none", // 禁用长按菜单
  },
  
  // 滚动优化
  SCROLL_OPTIMIZATION: {
    webkitOverflowScrolling: "touch", // iOS 平滑滚动
    overscrollBehavior: "contain", // 防止过度滚动
  },
} as const;

/**
 * 移动端优化样式生成器
 */
export function getMobileOptimizedStyles(isTouch: boolean): string {
  if (!isTouch) return "";
  
  return cn(
    // 触摸优化
    "touch-manipulation",
    "select-none",
    "[&::-webkit-touch-callout]:none",
    
    // 滚动优化
    "[&::-webkit-overflow-scrolling]:touch",
    "overscroll-contain",
    
    // 性能优化
    "transform-gpu",
    "will-change-transform",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出工具
   ═══════════════════════════════════════════════════════════════════════════ */

export const mobileUtils = {
  isMobileDevice,
  isTouchDevice,
  getResponsiveStyles,
  getMobileOptimizedStyles,
  MOBILE_STYLES,
  MOBILE_PERFORMANCE,
} as const;
