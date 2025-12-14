/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         优雅中断控制器                                     ║
 * ║                                                                            ║
 * ║  实现用户主动停止生成的机制                                                  ║
 * ║  支持流式响应中断和清理                                                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              类型定义
// ============================================================================

/** 中断原因 */
export type AbortReason = "user" | "timeout" | "error" | "system";

/** 中断事件 */
export interface AbortEvent {
  reason: AbortReason;
  message?: string;
  timestamp: number;
}

/** 中断监听器 */
export type AbortListener = (event: AbortEvent) => void;

/** 生成状态 */
export type GenerationStatus = "idle" | "running" | "aborting" | "aborted" | "completed";

// ============================================================================
//                              生成中断控制器
// ============================================================================

/** 生成中断控制器 */
export class GenerationAbortController {
  private controller: AbortController | null = null;
  private status: GenerationStatus = "idle";
  private listeners: Set<AbortListener> = new Set();
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private startTime: number = 0;

  /** 开始新的生成 */
  start(timeoutMs?: number): AbortSignal {
    this.cleanup();

    this.controller = new AbortController();
    this.status = "running";
    this.startTime = Date.now();

    if (timeoutMs && timeoutMs > 0) {
      this.timeoutId = setTimeout(() => {
        this.abort("timeout", `Generation timed out after ${timeoutMs}ms`);
      }, timeoutMs);
    }

    return this.controller.signal;
  }

  /** 中断生成 */
  abort(reason: AbortReason = "user", message?: string): boolean {
    if (this.status !== "running") return false;

    this.status = "aborting";

    const event: AbortEvent = {
      reason,
      message,
      timestamp: Date.now(),
    };

    this.notifyListeners(event);

    if (this.controller) {
      this.controller.abort(message || reason);
    }

    this.status = "aborted";
    this.clearTimeout();

    return true;
  }

  /** 标记完成 */
  complete(): void {
    if (this.status === "running") {
      this.status = "completed";
      this.clearTimeout();
    }
  }

  /** 重置状态 */
  reset(): void {
    this.cleanup();
    this.status = "idle";
  }

  /** 获取当前状态 */
  getStatus(): GenerationStatus {
    return this.status;
  }

  /** 检查是否正在运行 */
  isRunning(): boolean {
    return this.status === "running";
  }

  /** 检查是否已中断 */
  isAborted(): boolean {
    return this.status === "aborted" || this.status === "aborting";
  }

  /** 获取 AbortSignal */
  getSignal(): AbortSignal | null {
    return this.controller?.signal ?? null;
  }

  /** 获取运行时间 */
  getElapsedTime(): number {
    if (this.startTime === 0) return 0;
    return Date.now() - this.startTime;
  }

  /** 添加中断监听器 */
  onAbort(listener: AbortListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 移除中断监听器 */
  offAbort(listener: AbortListener): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(event: AbortEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // 忽略监听器错误
      }
    }
  }

  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private cleanup(): void {
    this.clearTimeout();
    this.controller = null;
    this.startTime = 0;
  }
}

// ============================================================================
//                              全局中断管理器
// ============================================================================

/** 全局中断管理器 */
export class GlobalAbortManager {
  private controllers: Map<string, GenerationAbortController> = new Map();
  private defaultController: GenerationAbortController;

  constructor() {
    this.defaultController = new GenerationAbortController();
  }

  /** 获取或创建控制器 */
  getController(id?: string): GenerationAbortController {
    if (!id) return this.defaultController;

    let controller = this.controllers.get(id);
    if (!controller) {
      controller = new GenerationAbortController();
      this.controllers.set(id, controller);
    }
    return controller;
  }

  /** 开始生成 */
  start(id?: string, timeoutMs?: number): AbortSignal {
    return this.getController(id).start(timeoutMs);
  }

  /** 中断生成 */
  abort(id?: string, reason: AbortReason = "user", message?: string): boolean {
    return this.getController(id).abort(reason, message);
  }

  /** 中断所有生成 */
  abortAll(reason: AbortReason = "user", message?: string): number {
    let count = 0;

    if (this.defaultController.abort(reason, message)) count++;

    for (const controller of this.controllers.values()) {
      if (controller.abort(reason, message)) count++;
    }

    return count;
  }

  /** 标记完成 */
  complete(id?: string): void {
    this.getController(id).complete();
  }

  /** 获取状态 */
  getStatus(id?: string): GenerationStatus {
    return this.getController(id).getStatus();
  }

  /** 检查是否有正在运行的生成 */
  hasRunning(): boolean {
    if (this.defaultController.isRunning()) return true;
    for (const controller of this.controllers.values()) {
      if (controller.isRunning()) return true;
    }
    return false;
  }

  /** 清理已完成的控制器 */
  cleanup(): void {
    for (const [id, controller] of this.controllers.entries()) {
      const status = controller.getStatus();
      if (status === "completed" || status === "aborted" || status === "idle") {
        controller.reset();
        this.controllers.delete(id);
      }
    }
  }

  /** 重置所有 */
  resetAll(): void {
    this.defaultController.reset();
    for (const controller of this.controllers.values()) {
      controller.reset();
    }
    this.controllers.clear();
  }
}

// ============================================================================
//                              便捷函数
// ============================================================================

/** 创建中断控制器 */
export function createAbortController(): GenerationAbortController {
  return new GenerationAbortController();
}

/** 创建全局中断管理器 */
export function createGlobalAbortManager(): GlobalAbortManager {
  return new GlobalAbortManager();
}

/** 全局单例 */
let globalAbortManager: GlobalAbortManager | null = null;

/** 获取全局中断管理器单例 */
export function getGlobalAbortManager(): GlobalAbortManager {
  if (!globalAbortManager) {
    globalAbortManager = new GlobalAbortManager();
  }
  return globalAbortManager;
}

/** 包装 fetch 请求以支持中断 */
export async function fetchWithAbort(
  url: string,
  options: RequestInit,
  controller: GenerationAbortController,
  timeoutMs?: number,
): Promise<Response> {
  const signal = controller.start(timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AbortError(controller.isAborted() ? "Generation aborted" : "Request aborted");
    }
    throw error;
  }
}

/** 中断错误 */
export class AbortError extends Error {
  constructor(message = "Operation aborted") {
    super(message);
    this.name = "AbortError";
  }
}

/** 检查错误是否为中断错误 */
export function isAbortError(error: unknown): error is AbortError {
  if (error instanceof AbortError) return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
}
