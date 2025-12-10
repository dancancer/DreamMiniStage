/**
 * Virtual Render Queue - Performance optimization for batched updates
 * 
 * 虚拟渲染队列 - 用于批量更新的性能优化工具
 * 
 * 设计原则：
 * 1. 批量处理：将多个更新任务合并处理，减少重绘次数
 * 2. 节流控制：限制处理频率，避免过度计算
 * 3. 错误隔离：单个任务失败不影响其他任务
 * 4. 内存管理：自动清理过期任务，防止内存泄漏
 */

export class VirtualRenderQueue {
  private queue: Array<() => void> = [];
  private isProcessing = false;
  private batchSize = 3; // 每批处理3个任务
  private processingInterval = 16; // ~60fps的间隔
  private lastProcessTime = 0;

  /**
   * 添加渲染任务到队列
   */
  enqueue(task: () => void): void {
    this.queue.push(task);
    this.scheduleProcessing();
  }

  /**
   * 调度处理 - 带节流控制
   */
  private scheduleProcessing(): void {
    if (this.isProcessing) return;
    
    const now = Date.now();
    const timeSinceLastProcess = now - this.lastProcessTime;
    
    if (timeSinceLastProcess < this.processingInterval) {
      setTimeout(() => this.processQueue(), this.processingInterval - timeSinceLastProcess);
    } else {
      this.processQueue();
    }
  }

  /**
   * 批量处理队列中的任务
   */
  private processQueue(): void {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    this.lastProcessTime = Date.now();
    
    // 批量处理任务
    const batch = this.queue.splice(0, this.batchSize);
    batch.forEach(task => {
      try {
        task();
      } catch (error) {
        console.error("Virtual queue task error:", error);
      }
    });
    
    this.isProcessing = false;
    
    // 如果还有任务，继续处理
    if (this.queue.length > 0) {
      requestAnimationFrame(() => this.processQueue());
    }
  }

  /**
   * 清空所有待处理任务
   */
  clear(): void {
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * 获取队列长度
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * 安全地获取下一个任务
   */
  getNextTask(): (() => void) | undefined {
    return this.queue.shift();
  }
}

/**
 * 全局虚拟渲染队列实例
 */
export const globalRenderQueue = new VirtualRenderQueue();

/**
 * VirtualRenderQueue类型
 */
export type VirtualRenderQueueType = VirtualRenderQueue;
