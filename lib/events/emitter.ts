/**
 * 事件发射器
 *
 * 实现 SillyTavern 兼容的事件发布/订阅系统
 */

import type {
  EventType,
  EventData,
  EventHandler,
  EventHandlerConfig,
  Unsubscribe,
} from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   EventEmitter 类
   ═══════════════════════════════════════════════════════════════════════════ */

export class EventEmitter {
  private handlers: Map<string, EventHandlerConfig[]> = new Map();
  private wildcardHandlers: EventHandlerConfig[] = [];

  /* ─────────────────────────────────────────────────────────────────────────
     订阅方法
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * 订阅事件
   */
  on<T extends EventData = EventData>(
    eventType: EventType | string,
    handler: EventHandler<T>,
    options: { priority?: number } = {},
  ): Unsubscribe {
    const config: EventHandlerConfig = {
      handler: handler as EventHandler,
      once: false,
      priority: options.priority ?? 0,
    };

    this.addHandler(eventType, config);

    return () => this.off(eventType, handler as EventHandler);
  }

  /**
   * 订阅事件（只执行一次）
   */
  once<T extends EventData = EventData>(
    eventType: EventType | string,
    handler: EventHandler<T>,
    options: { priority?: number } = {},
  ): Unsubscribe {
    const config: EventHandlerConfig = {
      handler: handler as EventHandler,
      once: true,
      priority: options.priority ?? 0,
    };

    this.addHandler(eventType, config);

    return () => this.off(eventType, handler as EventHandler);
  }

  /**
   * 订阅所有事件（通配符）
   */
  onAny(
    handler: EventHandler,
    options: { priority?: number } = {},
  ): Unsubscribe {
    const config: EventHandlerConfig = {
      handler,
      once: false,
      priority: options.priority ?? 0,
    };

    this.wildcardHandlers.push(config);
    this.sortByPriority(this.wildcardHandlers);

    return () => {
      const index = this.wildcardHandlers.findIndex((h) => h.handler === handler);
      if (index !== -1) {
        this.wildcardHandlers.splice(index, 1);
      }
    };
  }

  /**
   * 取消订阅
   */
  off(eventType: EventType | string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (!handlers) return;

    const index = handlers.findIndex((h) => h.handler === handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }

    if (handlers.length === 0) {
      this.handlers.delete(eventType);
    }
  }

  /**
   * 取消所有订阅
   */
  offAll(eventType?: EventType | string): void {
    if (eventType) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
      this.wildcardHandlers = [];
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     发布方法
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * 发布事件（同步）
   */
  emit<T extends EventData>(eventType: EventType | string, data: T): void {
    const handlers = this.handlers.get(eventType) || [];
    const allHandlers = [...handlers, ...this.wildcardHandlers];

    const toRemove: EventHandlerConfig[] = [];

    for (const config of allHandlers) {
      try {
        config.handler(data);
        if (config.once) {
          toRemove.push(config);
        }
      } catch (error) {
        console.error(`[EventEmitter] Error in handler for ${eventType}:`, error);
      }
    }

    for (const config of toRemove) {
      this.removeHandler(eventType, config);
    }
  }

  /**
   * 发布事件（异步）
   */
  async emitAsync<T extends EventData>(
    eventType: EventType | string,
    data: T,
  ): Promise<void> {
    const handlers = this.handlers.get(eventType) || [];
    const allHandlers = [...handlers, ...this.wildcardHandlers];

    const toRemove: EventHandlerConfig[] = [];

    for (const config of allHandlers) {
      try {
        await config.handler(data);
        if (config.once) {
          toRemove.push(config);
        }
      } catch (error) {
        console.error(`[EventEmitter] Error in async handler for ${eventType}:`, error);
      }
    }

    for (const config of toRemove) {
      this.removeHandler(eventType, config);
    }
  }

  /**
   * 发布事件（并行异步）
   */
  async emitParallel<T extends EventData>(
    eventType: EventType | string,
    data: T,
  ): Promise<void> {
    const handlers = this.handlers.get(eventType) || [];
    const allHandlers = [...handlers, ...this.wildcardHandlers];

    const toRemove: EventHandlerConfig[] = [];

    const promises = allHandlers.map(async (config) => {
      try {
        await config.handler(data);
        if (config.once) {
          toRemove.push(config);
        }
      } catch (error) {
        console.error(`[EventEmitter] Error in parallel handler for ${eventType}:`, error);
      }
    });

    await Promise.all(promises);

    for (const config of toRemove) {
      this.removeHandler(eventType, config);
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     查询方法
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * 检查是否有订阅者
   */
  hasListeners(eventType: EventType | string): boolean {
    const handlers = this.handlers.get(eventType);
    return (handlers && handlers.length > 0) || this.wildcardHandlers.length > 0;
  }

  /**
   * 获取订阅者数量
   */
  listenerCount(eventType: EventType | string): number {
    const handlers = this.handlers.get(eventType);
    return (handlers?.length ?? 0) + this.wildcardHandlers.length;
  }

  /**
   * 获取所有已注册的事件类型
   */
  eventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /* ─────────────────────────────────────────────────────────────────────────
     内部方法
     ───────────────────────────────────────────────────────────────────────── */

  private addHandler(eventType: string, config: EventHandlerConfig): void {
    let handlers = this.handlers.get(eventType);
    if (!handlers) {
      handlers = [];
      this.handlers.set(eventType, handlers);
    }
    handlers.push(config);
    this.sortByPriority(handlers);
  }

  private removeHandler(eventType: string, config: EventHandlerConfig): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(config);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }

    const wildcardIndex = this.wildcardHandlers.indexOf(config);
    if (wildcardIndex !== -1) {
      this.wildcardHandlers.splice(wildcardIndex, 1);
    }
  }

  private sortByPriority(handlers: EventHandlerConfig[]): void {
    handlers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   全局事件总线
   ═══════════════════════════════════════════════════════════════════════════ */

let globalEventBus: EventEmitter | null = null;

/**
 * 获取全局事件总线
 */
export function getEventBus(): EventEmitter {
  if (!globalEventBus) {
    globalEventBus = new EventEmitter();
  }
  return globalEventBus;
}

/**
 * 创建新的事件发射器
 */
export function createEventEmitter(): EventEmitter {
  return new EventEmitter();
}

/* ═══════════════════════════════════════════════════════════════════════════
   便捷函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 订阅全局事件
 */
export function on<T extends EventData = EventData>(
  eventType: EventType | string,
  handler: EventHandler<T>,
): Unsubscribe {
  return getEventBus().on(eventType, handler);
}

/**
 * 订阅全局事件（只执行一次）
 */
export function once<T extends EventData = EventData>(
  eventType: EventType | string,
  handler: EventHandler<T>,
): Unsubscribe {
  return getEventBus().once(eventType, handler);
}

/**
 * 发布全局事件
 */
export function emit<T extends EventData>(
  eventType: EventType | string,
  data: T,
): void {
  getEventBus().emit(eventType, data);
}

/**
 * 发布全局事件（异步）
 */
export async function emitAsync<T extends EventData>(
  eventType: EventType | string,
  data: T,
): Promise<void> {
  await getEventBus().emitAsync(eventType, data);
}

/**
 * 取消订阅全局事件
 */
export function off(
  eventType: EventType | string,
  handler: EventHandler,
): void {
  getEventBus().off(eventType, handler);
}
