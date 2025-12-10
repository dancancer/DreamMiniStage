/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     提示词查看器全局清理入口                                ║
 * ║                                                                            ║
 * ║  提供统一的清理接口，确保所有资源都能被正确释放                              ║
 * ║  设计原则：简单直接、无特殊情况、可靠清理                                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { resourceManager } from "./resource-manager";

/* ═══════════════════════════════════════════════════════════════════════════
   清理接口
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 清理指定对话的所有资源
 */
export async function cleanupDialogue(dialogueKey: string): Promise<void> {
  if (!dialogueKey) {
    console.warn("[PromptViewerCleanup] 对话键为空，跳过清理");
    return;
  }

  console.log(`[PromptViewerCleanup] 开始清理对话资源: ${dialogueKey}`);

  try {
    // 1. 清理拦截器
    const { promptInterceptor } = await import("./prompt-interceptor");
    if (!promptInterceptor.isInstanceDestroyed()) {
      promptInterceptor.stopInterception(dialogueKey);
    }

    // 2. 清理 Store 状态
    const { usePromptViewerStore } = await import("@/lib/store/prompt-viewer-store");
    const store = usePromptViewerStore.getState();
    store.cleanup(dialogueKey);

    // 3. 清理资源管理器中的相关资源
    await resourceManager.cleanup(`PromptViewerModal-${dialogueKey}`);
    await resourceManager.cleanup(`PromptViewerButton-${dialogueKey}`);

    console.log(`[PromptViewerCleanup] 对话资源清理完成: ${dialogueKey}`);
  } catch (error) {
    console.error(`[PromptViewerCleanup] 清理对话资源失败: ${dialogueKey}`, error);
  }
}

/**
 * 清理所有提示词查看器资源
 */
export async function cleanupAll(): Promise<void> {
  console.log("[PromptViewerCleanup] 开始清理所有资源");

  try {
    // 1. 销毁拦截器
    const { promptInterceptor } = await import("./prompt-interceptor");
    if (!promptInterceptor.isInstanceDestroyed()) {
      promptInterceptor.destroy();
    }

    // 2. 销毁 Store
    const { usePromptViewerStore } = await import("@/lib/store/prompt-viewer-store");
    const store = usePromptViewerStore.getState();
    await store.destroy();

    // 3. 销毁资源管理器
    await resourceManager.destroy();

    // 4. 清理全局清理函数
    if (typeof window !== "undefined" && (window as any).__promptInterceptorCleanup) {
      (window as any).__promptInterceptorCleanup();
      delete (window as any).__promptInterceptorCleanup;
    }

    console.log("[PromptViewerCleanup] 所有资源清理完成");
  } catch (error) {
    console.error("[PromptViewerCleanup] 清理所有资源失败:", error);
  }
}

/**
 * 清理过期资源
 */
export async function cleanupExpired(): Promise<void> {
  console.log("[PromptViewerCleanup] 开始清理过期资源");

  try {
    // 清理 Store 中的过期数据
    const { usePromptViewerStore } = await import("@/lib/store/prompt-viewer-store");
    const store = usePromptViewerStore.getState();
    store.cleanupExpired();

    console.log("[PromptViewerCleanup] 过期资源清理完成");
  } catch (error) {
    console.error("[PromptViewerCleanup] 清理过期资源失败:", error);
  }
}

/**
 * 获取清理状态信息
 */
export function getCleanupStatus(): {
  resourceManagerDestroyed: boolean;
  registeredResourceCount: number;
  interceptorDestroyed: boolean;
  } {
  try {
    const { getResourceManagerStatus } = require("./resource-manager");
    const resourceStatus = getResourceManagerStatus();

    // 检查拦截器状态（异步导入可能失败）
    let interceptorDestroyed = true;
    try {
      const { promptInterceptor } = require("./prompt-interceptor");
      interceptorDestroyed = promptInterceptor.isInstanceDestroyed();
    } catch {
      // 如果导入失败，认为已销毁
    }

    return {
      resourceManagerDestroyed: resourceStatus.isDestroyed,
      registeredResourceCount: resourceStatus.registeredCount,
      interceptorDestroyed,
    };
  } catch (error) {
    console.error("[PromptViewerCleanup] 获取清理状态失败:", error);
    return {
      resourceManagerDestroyed: true,
      registeredResourceCount: 0,
      interceptorDestroyed: true,
    };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   React Hook 集成
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * React Hook：在组件卸载时自动清理对话资源
 */
export function useDialogueCleanup(dialogueKey: string): void {
  // 动态导入 React，避免在非 React 环境中出错
  const { useEffect } = require("react");
  
  useEffect(() => {
    return () => {
      // 异步清理，避免阻塞组件卸载
      setTimeout(() => {
        cleanupDialogue(dialogueKey);
      }, 0);
    };
  }, [dialogueKey]);
}

/**
 * React Hook：在应用卸载时自动清理所有资源
 */
export function useGlobalCleanup(): void {
  // 动态导入 React，避免在非 React 环境中出错
  const { useEffect } = require("react");
  
  useEffect(() => {
    return () => {
      // 异步清理，避免阻塞应用卸载
      setTimeout(() => {
        cleanupAll();
      }, 0);
    };
  }, []);
}

/* ═══════════════════════════════════════════════════════════════════════════
   开发工具
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 开发环境下的清理状态监控
 */
export function enableCleanupMonitoring(): void {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "development") {
    return;
  }

  // 添加全局清理函数到 window 对象，便于调试
  (window as any).__promptViewerCleanup = {
    cleanupDialogue,
    cleanupAll,
    cleanupExpired,
    getStatus: getCleanupStatus,
  };

  // 定期输出清理状态
  const monitorInterval = setInterval(() => {
    const status = getCleanupStatus();
    console.log("[PromptViewerCleanup] 状态监控:", status);
  }, 60000); // 每分钟输出一次

  // 页面卸载时清理监控
  window.addEventListener("beforeunload", () => {
    clearInterval(monitorInterval);
  });

  console.log("[PromptViewerCleanup] 清理状态监控已启用");
}

// 在开发环境下自动启用监控
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  enableCleanupMonitoring();
}
