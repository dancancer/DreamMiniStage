/**
 * Global Event Bridge Module
 *
 * 桥接全局事件系统 (lib/events) 与脚本沙箱事件系统。
 * 允许脚本监听全局事件，并触发自定义事件。
 */

import { on, off, emit, once } from "@/lib/events";
import { EVENT_TYPES, type EventType } from "@/lib/events/types";
import type { ScriptEventEmitter } from "./event-emitter";

/**
 * 允许脚本监听的全局事件白名单
 */
const ALLOWED_GLOBAL_EVENTS: EventType[] = [
  EVENT_TYPES.GENERATION_STARTED,
  EVENT_TYPES.GENERATION_ENDED,
  EVENT_TYPES.MESSAGE_SENT,
  EVENT_TYPES.MESSAGE_RECEIVED,
  EVENT_TYPES.MESSAGE_DELETED,
  EVENT_TYPES.MESSAGE_EDITED,
  EVENT_TYPES.CHAT_CHANGED,
  EVENT_TYPES.CHARACTER_LOADED,
  EVENT_TYPES.WORLDINFO_ENTRIES_LOADED,
];

/**
 * 自定义事件前缀（脚本触发的事件必须使用此前缀）
 */
const CUSTOM_EVENT_PREFIX = "custom:";

/**
 * 事件桥接器
 */
export class GlobalEventBridge {
  private sandboxEmitter: ScriptEventEmitter;
  private globalListeners: Map<string, (data: unknown) => void> = new Map();
  private destroyed = false;

  constructor(sandboxEmitter: ScriptEventEmitter) {
    this.sandboxEmitter = sandboxEmitter;
    this.setupGlobalToSandbox();
    this.setupSandboxToGlobal();
  }

  /**
   * 设置全局事件 → 沙箱转发
   */
  private setupGlobalToSandbox(): void {
    for (const eventType of ALLOWED_GLOBAL_EVENTS) {
      const handler = (data: unknown) => {
        if (this.destroyed) return;
        this.sandboxEmitter.emit(eventType, data);
      };
      this.globalListeners.set(eventType, handler);
      on(eventType, handler as (data: import("@/lib/events/types").EventData) => void);
    }
  }

  /**
   * 设置沙箱事件 → 全局转发（仅限自定义事件）
   */
  private setupSandboxToGlobal(): void {
    // 监听沙箱中的自定义事件并转发到全局
    this.sandboxEmitter.on(CUSTOM_EVENT_PREFIX + "*", (data: unknown) => {
      if (this.destroyed) return;
      // 从 data 中提取事件名
      const payload = data as Record<string, unknown> | null | undefined;
      const eventName = payload?.eventName ?? payload?.type;
      if (typeof eventName === "string" && eventName.startsWith(CUSTOM_EVENT_PREFIX)) {
        emit(eventName, data as import("@/lib/events/types").EventData);
      }
    });
  }

  /**
   * 销毁桥接器，清理所有监听器
   */
  destroy(): void {
    this.destroyed = true;

    for (const [eventType, handler] of this.globalListeners) {
      off(eventType as EventType, handler);
    }
    this.globalListeners.clear();
  }
}

/**
 * 创建事件桥接器
 */
export function createGlobalEventBridge(
  sandboxEmitter: ScriptEventEmitter,
): GlobalEventBridge {
  return new GlobalEventBridge(sandboxEmitter);
}

/**
 * 脚本可用的事件 API 类型
 */
export interface ScriptEventAPI {
  /**
   * 监听全局事件
   * @param eventName 事件名称（必须在白名单中）
   * @param handler 事件处理函数
   */
  on: (eventName: string, handler: (data: unknown) => void) => () => void;

  /**
   * 监听一次性事件
   */
  once: (eventName: string, handler: (data: unknown) => void) => () => void;

  /**
   * 取消监听
   */
  off: (eventName: string, handler?: (data: unknown) => void) => void;

  /**
   * 触发自定义事件（必须以 "custom:" 开头）
   */
  emit: (eventName: string, data?: unknown) => void;

  /**
   * 获取可监听的事件列表
   */
  getAvailableEvents: () => string[];
}

/**
 * 创建脚本可用的事件 API
 */
export function createScriptEventAPI(
  sandboxEmitter: ScriptEventEmitter,
): ScriptEventAPI {
  return {
    on: (eventName: string, handler: (data: unknown) => void) => {
      if (!isEventAllowed(eventName)) {
        console.warn(`[ScriptEventAPI] Event "${eventName}" is not allowed`);
        return () => {};
      }
      return sandboxEmitter.on(eventName, handler);
    },

    once: (eventName: string, handler: (data: unknown) => void) => {
      if (!isEventAllowed(eventName)) {
        console.warn(`[ScriptEventAPI] Event "${eventName}" is not allowed`);
        return () => {};
      }
      return sandboxEmitter.once(eventName, handler);
    },

    off: (eventName: string, handler?: (data: unknown) => void) => {
      sandboxEmitter.off(eventName, handler);
    },

    emit: (eventName: string, data?: unknown) => {
      if (!eventName.startsWith(CUSTOM_EVENT_PREFIX)) {
        console.warn(
          `[ScriptEventAPI] Custom events must start with "${CUSTOM_EVENT_PREFIX}"`,
        );
        return;
      }
      sandboxEmitter.emit(eventName, data);
    },

    getAvailableEvents: () => [...ALLOWED_GLOBAL_EVENTS],
  };
}

/**
 * 检查事件是否允许监听
 */
function isEventAllowed(eventName: string): boolean {
  return (
    ALLOWED_GLOBAL_EVENTS.includes(eventName as EventType) ||
    eventName.startsWith(CUSTOM_EVENT_PREFIX)
  );
}

/**
 * 导出事件类型常量供脚本使用
 */
export const SCRIPT_EVENT_TYPES = {
  // 生成相关
  GENERATION_STARTED: EVENT_TYPES.GENERATION_STARTED,
  GENERATION_ENDED: EVENT_TYPES.GENERATION_ENDED,

  // 消息相关
  MESSAGE_SENT: EVENT_TYPES.MESSAGE_SENT,
  MESSAGE_RECEIVED: EVENT_TYPES.MESSAGE_RECEIVED,
  MESSAGE_DELETED: EVENT_TYPES.MESSAGE_DELETED,
  MESSAGE_EDITED: EVENT_TYPES.MESSAGE_EDITED,

  // 聊天相关
  CHAT_CHANGED: EVENT_TYPES.CHAT_CHANGED,
  CHARACTER_LOADED: EVENT_TYPES.CHARACTER_LOADED,

  // World Info 相关
  WORLDINFO_ENTRIES_LOADED: EVENT_TYPES.WORLDINFO_ENTRIES_LOADED,
} as const;
