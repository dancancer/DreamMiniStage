/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         事件系统 Handlers                                  ║
 * ║                                                                            ║
 * ║  实现 iframe 作用域的事件监听器注册表                                       ║
 * ║  好品味：用 Map 嵌套结构管理 iframe → eventType → handlers                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiHandlerMap } from "./types";

// ============================================================================
//                              类型定义
// ============================================================================

interface HandlerEntry {
  handlerId: string;
  once: boolean;
}

// ============================================================================
//                              iframe 事件监听器注册表
//
//  结构: iframeId → eventType → Set<HandlerEntry>
//  设计原则：iframe 销毁时可一次性清理所有监听器
// ============================================================================

const iframeListeners: Map<string, Map<string, Set<HandlerEntry>>> = new Map();

// ============================================================================
//                              内部工具函数
// ============================================================================

function getOrCreateIframeMap(iframeId: string): Map<string, Set<HandlerEntry>> {
  let eventMap = iframeListeners.get(iframeId);
  if (!eventMap) {
    eventMap = new Map();
    iframeListeners.set(iframeId, eventMap);
  }
  return eventMap;
}

function getOrCreateHandlerSet(
  eventMap: Map<string, Set<HandlerEntry>>,
  eventType: string
): Set<HandlerEntry> {
  let handlers = eventMap.get(eventType);
  if (!handlers) {
    handlers = new Set();
    eventMap.set(eventType, handlers);
  }
  return handlers;
}

// ============================================================================
//                              核心操作函数
// ============================================================================

/**
 * 注册事件监听器
 */
export function registerListener(
  iframeId: string,
  eventType: string,
  handlerId: string,
  once: boolean = false
): void {
  const eventMap = getOrCreateIframeMap(iframeId);
  const handlers = getOrCreateHandlerSet(eventMap, eventType);
  handlers.add({ handlerId, once });
}

/**
 * 移除特定监听器
 */
export function removeListener(
  iframeId: string,
  eventType: string,
  handlerId: string
): boolean {
  const eventMap = iframeListeners.get(iframeId);
  if (!eventMap) return false;

  const handlers = eventMap.get(eventType);
  if (!handlers) return false;

  for (const entry of handlers) {
    if (entry.handlerId === handlerId) {
      handlers.delete(entry);
      return true;
    }
  }
  return false;
}

/**
 * 清理指定 iframe 的所有监听器
 */
export function clearIframeListeners(iframeId: string): number {
  const eventMap = iframeListeners.get(iframeId);
  if (!eventMap) return 0;

  let count = 0;
  for (const handlers of eventMap.values()) {
    count += handlers.size;
  }

  iframeListeners.delete(iframeId);
  return count;
}

/**
 * 发射事件到所有注册的监听器
 * 返回被触发的 handler 数量
 */
export function emitEvent(eventType: string, data: unknown): string[] {
  const triggeredHandlers: string[] = [];
  const toRemove: Array<{ iframeId: string; handlerId: string }> = [];

  for (const [iframeId, eventMap] of iframeListeners) {
    const handlers = eventMap.get(eventType);
    if (!handlers) continue;

    for (const entry of handlers) {
      triggeredHandlers.push(entry.handlerId);

      // 标记 once 监听器待移除
      if (entry.once) {
        toRemove.push({ iframeId, handlerId: entry.handlerId });
      }
    }
  }

  // 移除 once 监听器
  for (const { iframeId, handlerId } of toRemove) {
    removeListener(iframeId, eventType, handlerId);
  }

  return triggeredHandlers;
}

/**
 * 获取指定 iframe 的监听器统计
 */
export function getListenerStats(iframeId: string): Record<string, number> {
  const eventMap = iframeListeners.get(iframeId);
  if (!eventMap) return {};

  const stats: Record<string, number> = {};
  for (const [eventType, handlers] of eventMap) {
    stats[eventType] = handlers.size;
  }
  return stats;
}

/**
 * 获取所有 iframe 的监听器总数
 */
export function getTotalListenerCount(): number {
  let total = 0;
  for (const eventMap of iframeListeners.values()) {
    for (const handlers of eventMap.values()) {
      total += handlers.size;
    }
  }
  return total;
}

// ============================================================================
//                              API Handlers
// ============================================================================

export const eventHandlers: ApiHandlerMap = {
  /**
   * 注册持久监听器
   * args: [eventType: string, handlerId: string, iframeId?: string]
   */
  "eventOn": (args) => {
    const [eventType, handlerId, iframeId = "default"] = args as [string, string, string?];
    registerListener(iframeId, eventType, handlerId, false);
    return { success: true, eventType, handlerId };
  },

  /**
   * 注册一次性监听器
   * args: [eventType: string, handlerId: string, iframeId?: string]
   */
  "eventOnce": (args) => {
    const [eventType, handlerId, iframeId = "default"] = args as [string, string, string?];
    registerListener(iframeId, eventType, handlerId, true);
    return { success: true, eventType, handlerId, once: true };
  },

  /**
   * 发射事件
   * args: [eventType: string, ...data: unknown[]]
   */
  "eventEmit": (args) => {
    const [eventType, ...data] = args as [string, ...unknown[]];
    const triggered = emitEvent(eventType, data.length === 1 ? data[0] : data);
    return { eventType, triggeredCount: triggered.length, handlers: triggered };
  },

  /**
   * 移除监听器
   * args: [eventType: string, handlerId: string, iframeId?: string]
   */
  "eventRemoveListener": (args) => {
    const [eventType, handlerId, iframeId = "default"] = args as [string, string, string?];
    const removed = removeListener(iframeId, eventType, handlerId);
    return { success: removed, eventType, handlerId };
  },

  /**
   * 清理 iframe 所有监听器
   * args: [iframeId: string]
   */
  "eventClearAll": (args) => {
    const [iframeId = "default"] = args as [string?];
    const count = clearIframeListeners(iframeId);
    return { success: true, clearedCount: count };
  },

  /**
   * 获取监听器统计
   * args: [iframeId?: string]
   */
  "eventGetStats": (args) => {
    const [iframeId] = args as [string?];
    if (iframeId) {
      return getListenerStats(iframeId);
    }
    return { totalListeners: getTotalListenerCount() };
  },
};
