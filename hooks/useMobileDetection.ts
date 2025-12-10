/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         useMobileDetection Hook                            ║
 * ║                                                                            ║
 * ║  移动端检测：响应式断点监听                                                  ║
 * ║  从 character/page.tsx 提取的共用逻辑                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useEffect } from "react";

// ============================================================================
//                              类型定义
// ============================================================================

interface UseMobileDetectionOptions {
  breakpoint?: number; // 断点像素值，默认 768
}

interface UseMobileDetectionReturn {
  isMobile: boolean;
}

// ============================================================================
//                              主 Hook
// ============================================================================

export function useMobileDetection(
  options?: UseMobileDetectionOptions
): UseMobileDetectionReturn {
  const { breakpoint = 768 } = options ?? {};
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [breakpoint]);

  return { isMobile };
}
