/**
 * @input  React, UI 基础组件
 * @output useScriptScroll
 * @pos    正则脚本编辑器组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Script Scroll Management Hook                         ║
 * ║                                                                           ║
 * ║  滚动管理逻辑 - 好品味：复杂逻辑提取到 Hook，保持组件简洁                      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { useRef, useCallback } from "react";
import type { RegexScript } from "@/lib/models/regex-script-model";

/**
 * 脚本与 Key 的元组类型
 * [scriptId, scriptData]
 */
type ScriptTuple = [string, RegexScript];

export function useScriptScroll(sortedScripts: ScriptTuple[]) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scriptRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 滚动到指定脚本
  const scrollToScript = useCallback(
    (scriptId: string) => {
      const container = scrollContainerRef.current;
      const element = scriptRefs.current.get(scriptId);
      if (!container || !element) return;

      requestAnimationFrame(() => {
        const containerRect = container.getBoundingClientRect();
        const scriptRect = element.getBoundingClientRect();
        const buffer = 30;

        // 已经在可视区域内，无需滚动
        if (
          scriptRect.top >= containerRect.top + buffer &&
          scriptRect.bottom <= containerRect.bottom - buffer
        ) {
          return;
        }

        const sortedIds = sortedScripts.map(([id]) => id);
        const isLast = sortedIds.indexOf(scriptId) === sortedIds.length - 1;
        const scriptHeight = scriptRect.height;
        const containerHeight = containerRect.height;

        let targetTop: number;

        // 好品味：边界情况自然融入常规逻辑
        if (isLast) {
          targetTop =
            scriptHeight > containerHeight - 120
              ? element.offsetTop - 40
              : element.offsetTop + scriptHeight - containerHeight + 120;
        } else if (scriptHeight > containerHeight - 80) {
          targetTop = element.offsetTop - 40;
        } else if (scriptRect.bottom > containerRect.bottom) {
          targetTop = element.offsetTop + scriptHeight - containerHeight + 80;
        } else if (scriptRect.top < containerRect.top) {
          targetTop = element.offsetTop - 40;
        } else {
          return;
        }

        const maxTop = container.scrollHeight - containerHeight;
        container.scrollTo({
          top: Math.min(Math.max(0, targetTop), maxTop),
          behavior: "smooth",
        });
      });
    },
    [sortedScripts],
  );

  // 延迟滚动（用于展开动画后）
  const scheduleScroll = useCallback(
    (scriptId: string) => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

      setTimeout(() => scrollToScript(scriptId), 150);

      scrollTimeoutRef.current = setTimeout(() => {
        scrollToScript(scriptId);
        scrollTimeoutRef.current = null;
      }, 350);
    },
    [scrollToScript],
  );

  // 清理函数
  const cleanup = useCallback(() => {
    const timeoutId = scrollTimeoutRef.current;
    if (timeoutId) clearTimeout(timeoutId);
    scriptRefs.current.clear();
  }, []);

  return {
    scrollContainerRef,
    scriptRefs,
    scrollToScript,
    scheduleScroll,
    cleanup,
  };
}
