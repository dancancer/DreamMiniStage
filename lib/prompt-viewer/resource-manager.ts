/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     提示词查看器资源管理器                                  ║
 * ║                                                                            ║
 * ║  统一管理所有资源的生命周期：定时器、事件监听器、缓存清理                    ║
 * ║  设计原则：消除特殊情况、统一清理逻辑、防止内存泄漏                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

/* ═══════════════════════════════════════════════════════════════════════════
   资源管理器接口
   ═══════════════════════════════════════════════════════════════════════════ */

interface ResourceCleanupFunction {
  (): void | Promise<void>;
}

interface ResourceManager {
  /**
   * 注册清理函数
   */
  registerCleanup(key: string, cleanup: ResourceCleanupFunction): void;

  /**
   * 取消注册清理函数
   */
  unregisterCleanup(key: string): void;

  /**
   * 执行指定资源的清理
   */
  cleanup(key: string): Promise<void>;

  /**
   * 执行所有资源的清理
   */
  cleanupAll(): Promise<void>;

  /**
   * 销毁资源管理器
   */
  destroy(): Promise<void>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   资源管理器实现
   ═══════════════════════════════════════════════════════════════════════════ */

class PromptViewerResourceManager implements ResourceManager {
  private cleanupFunctions = new Map<string, ResourceCleanupFunction>();
  private isDestroyed = false;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startPeriodicCleanup();
    this.registerGlobalCleanupHandlers();
  }

  /**
   * 注册清理函数
   */
  registerCleanup(key: string, cleanup: ResourceCleanupFunction): void {
    if (this.isDestroyed) {
      console.warn(`[ResourceManager] 尝试在已销毁的管理器中注册清理函数: ${key}`);
      return;
    }

    this.cleanupFunctions.set(key, cleanup);
    console.log(`[ResourceManager] 注册清理函数: ${key}`);
  }

  /**
   * 取消注册清理函数
   */
  unregisterCleanup(key: string): void {
    const removed = this.cleanupFunctions.delete(key);
    if (removed) {
      console.log(`[ResourceManager] 取消注册清理函数: ${key}`);
    }
  }

  /**
   * 执行指定资源的清理
   */
  async cleanup(key: string): Promise<void> {
    const cleanupFn = this.cleanupFunctions.get(key);
    if (!cleanupFn) {
      return;
    }

    try {
      console.log(`[ResourceManager] 执行清理: ${key}`);
      await cleanupFn();
      this.cleanupFunctions.delete(key);
    } catch (error) {
      console.error(`[ResourceManager] 清理失败: ${key}`, error);
    }
  }

  /**
   * 执行所有资源的清理
   */
  async cleanupAll(): Promise<void> {
    if (this.cleanupFunctions.size === 0) {
      return;
    }

    console.log(`[ResourceManager] 开始清理所有资源: ${this.cleanupFunctions.size} 个`);

    const cleanupPromises = Array.from(this.cleanupFunctions.entries()).map(
      async ([key, cleanupFn]) => {
        try {
          await cleanupFn();
          console.log(`[ResourceManager] 清理完成: ${key}`);
        } catch (error) {
          console.error(`[ResourceManager] 清理失败: ${key}`, error);
        }
      },
    );

    await Promise.allSettled(cleanupPromises);
    this.cleanupFunctions.clear();

    console.log("[ResourceManager] 所有资源清理完成");
  }

  /**
   * 销毁资源管理器
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    console.log("[ResourceManager] 开始销毁资源管理器");
    this.isDestroyed = true;

    // 停止定期清理
    this.stopPeriodicCleanup();

    // 清理所有资源
    await this.cleanupAll();

    // 移除全局事件监听器
    this.removeGlobalCleanupHandlers();

    console.log("[ResourceManager] 资源管理器销毁完成");
  }

  /**
   * 检查是否已销毁
   */
  isManagerDestroyed(): boolean {
    return this.isDestroyed;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     私有方法
     ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * 启动定期清理
   */
  private startPeriodicCleanup(): void {
    if (typeof window === "undefined" || this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      if (this.isDestroyed) {
        this.stopPeriodicCleanup();
        return;
      }

      // 执行定期清理逻辑
      this.performPeriodicCleanup();
    }, 10 * 60 * 1000); // 每10分钟执行一次

    console.log("[ResourceManager] 启动定期清理");
  }

  /**
   * 停止定期清理
   */
  private stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log("[ResourceManager] 停止定期清理");
    }
  }

  /**
   * 执行定期清理
   */
  private async performPeriodicCleanup(): Promise<void> {
    try {
      // 触发 Store 的过期数据清理
      const { usePromptViewerStore } = await import("@/lib/store/prompt-viewer-store");
      const store = usePromptViewerStore.getState();
      store.cleanupExpired();

      console.log("[ResourceManager] 定期清理完成");
    } catch (error) {
      console.error("[ResourceManager] 定期清理失败:", error);
    }
  }

  /**
   * 注册全局清理处理器
   */
  private registerGlobalCleanupHandlers(): void {
    if (typeof window === "undefined") {
      return;
    }

    // 页面卸载时清理
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    window.addEventListener("beforeunload", this.handleBeforeUnload);

    // 页面隐藏时轻量清理
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    // 内存压力时清理
    if ("memory" in performance) {
      this.handleMemoryPressure = this.handleMemoryPressure.bind(this);
      // @ts-ignore - 实验性 API
      if (performance.memory && "addEventListener" in performance) {
        // @ts-ignore
        performance.addEventListener("memorypressure", this.handleMemoryPressure);
      }
    }

    console.log("[ResourceManager] 注册全局清理处理器");
  }

  /**
   * 移除全局清理处理器
   */
  private removeGlobalCleanupHandlers(): void {
    if (typeof window === "undefined") {
      return;
    }

    window.removeEventListener("beforeunload", this.handleBeforeUnload);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);

    if ("memory" in performance && this.handleMemoryPressure) {
      // @ts-ignore
      if (performance.memory && "removeEventListener" in performance) {
        // @ts-ignore
        performance.removeEventListener("memorypressure", this.handleMemoryPressure);
      }
    }

    console.log("[ResourceManager] 移除全局清理处理器");
  }

  /**
   * 处理页面卸载事件
   */
  private handleBeforeUnload = (): void => {
    console.log("[ResourceManager] 页面卸载，执行清理");
    // 同步清理，因为页面即将卸载
    this.cleanupAll().catch((error) => {
      console.error("[ResourceManager] 页面卸载清理失败:", error);
    });
  };

  /**
   * 处理页面可见性变化
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      console.log("[ResourceManager] 页面隐藏，执行轻量清理");
      this.performPeriodicCleanup();
    }
  };

  /**
   * 处理内存压力事件
   */
  private handleMemoryPressure = (): void => {
    console.log("[ResourceManager] 内存压力，执行清理");
    this.performPeriodicCleanup();
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   单例实例和工具函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 全局资源管理器实例
 */
export const resourceManager = new PromptViewerResourceManager();

/**
 * 注册组件清理函数的便捷方法
 */
export function registerComponentCleanup(
  componentName: string,
  dialogueKey: string,
  cleanup: ResourceCleanupFunction,
): void {
  const key = `${componentName}-${dialogueKey}`;
  resourceManager.registerCleanup(key, cleanup);
}

/**
 * 取消注册组件清理函数的便捷方法
 */
export function unregisterComponentCleanup(
  componentName: string,
  dialogueKey: string,
): void {
  const key = `${componentName}-${dialogueKey}`;
  resourceManager.unregisterCleanup(key);
}

/**
 * React Hook：自动管理组件资源清理
 */
export function useResourceCleanup(
  componentName: string,
  dialogueKey: string,
  cleanup: ResourceCleanupFunction,
): void {
  // 这个 Hook 需要在 React 组件中使用
  const { useEffect } = require("react");
  
  useEffect(() => {
    registerComponentCleanup(componentName, dialogueKey, cleanup);
    
    return () => {
      unregisterComponentCleanup(componentName, dialogueKey);
    };
  }, [componentName, dialogueKey, cleanup]);
}

/**
 * 获取资源管理器状态
 */
export function getResourceManagerStatus(): {
  isDestroyed: boolean;
  registeredCount: number;
  } {
  return {
    isDestroyed: resourceManager.isManagerDestroyed(),
    registeredCount: resourceManager["cleanupFunctions"].size,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出类型
   ═══════════════════════════════════════════════════════════════════════════ */

export type { ResourceManager, ResourceCleanupFunction };
