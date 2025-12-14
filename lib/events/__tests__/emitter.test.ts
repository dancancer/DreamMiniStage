/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        EventEmitter 单元测试                               ║
 * ║                                                                            ║
 * ║  测试 SillyTavern 兼容的事件发布/订阅系统                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "../emitter";
import { EVENT_TYPES } from "../types";

// 创建测试用事件数据
const createEvent = (type: string, data: Record<string, unknown> = {}) => ({
  type,
  timestamp: Date.now(),
  ...data,
});

describe("EventEmitter", () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe("基础订阅/发布", () => {
    it("应该能订阅和接收事件", () => {
      const handler = vi.fn();
      emitter.on("test", handler);
      emitter.emit("test", createEvent("test", { value: 1 }));

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("应该支持多个处理器", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on("test", handler1);
      emitter.on("test", handler2);
      emitter.emit("test", createEvent("test"));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("应该支持多种事件类型", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on("event1", handler1);
      emitter.on("event2", handler2);

      emitter.emit("event1", createEvent("event1"));
      emitter.emit("event2", createEvent("event2"));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe("once 订阅", () => {
    it("once 处理器只执行一次", () => {
      const handler = vi.fn();
      emitter.once("test", handler);

      emitter.emit("test", createEvent("test"));
      emitter.emit("test", createEvent("test"));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("取消订阅", () => {
    it("off 应该移除处理器", () => {
      const handler = vi.fn();
      emitter.on("test", handler);
      emitter.off("test", handler);
      emitter.emit("test", createEvent("test"));

      expect(handler).not.toHaveBeenCalled();
    });

    it("返回的 unsubscribe 函数应该能取消订阅", () => {
      const handler = vi.fn();
      const unsubscribe = emitter.on("test", handler);

      unsubscribe();
      emitter.emit("test", createEvent("test"));

      expect(handler).not.toHaveBeenCalled();
    });

    it("offAll 应该移除指定事件的所有处理器", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on("test", handler1);
      emitter.on("test", handler2);
      emitter.offAll("test");
      emitter.emit("test", createEvent("test"));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it("offAll 无参数应该移除所有处理器", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on("event1", handler1);
      emitter.on("event2", handler2);
      emitter.offAll();

      emitter.emit("event1", createEvent("event1"));
      emitter.emit("event2", createEvent("event2"));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe("通配符订阅", () => {
    it("onAny 应该接收所有事件", () => {
      const handler = vi.fn();
      emitter.onAny(handler);

      emitter.emit("event1", createEvent("event1"));
      emitter.emit("event2", createEvent("event2"));

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe("优先级", () => {
    it("高优先级处理器应该先执行", () => {
      const order: number[] = [];

      emitter.on("test", () => { order.push(1); }, { priority: 1 });
      emitter.on("test", () => { order.push(2); }, { priority: 2 });
      emitter.on("test", () => { order.push(0); }, { priority: 0 });

      emitter.emit("test", createEvent("test"));

      // 高优先级先执行
      expect(order[0]).toBe(2);
      expect(order[1]).toBe(1);
      expect(order[2]).toBe(0);
    });
  });

  describe("异步发布", () => {
    it("emitAsync 应该等待所有处理器完成", async () => {
      const results: number[] = [];

      emitter.on("test", async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push(1);
      });

      emitter.on("test", async () => {
        await new Promise((r) => setTimeout(r, 5));
        results.push(2);
      });

      await emitter.emitAsync("test", createEvent("test"));

      expect(results).toHaveLength(2);
    });
  });

  describe("错误处理", () => {
    it("处理器抛出错误不应影响其他处理器", () => {
      const handler1 = vi.fn(() => {
        throw new Error("test error");
      });
      const handler2 = vi.fn();

      emitter.on("test", handler1);
      emitter.on("test", handler2);

      // 不应该抛出错误
      expect(() => emitter.emit("test", createEvent("test"))).not.toThrow();

      // handler2 仍然应该被调用
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe("SillyTavern 事件类型", () => {
    it("应该支持 GENERATION_STARTED 事件", () => {
      const handler = vi.fn();
      emitter.on(EVENT_TYPES.GENERATION_STARTED, handler);
      emitter.emit(EVENT_TYPES.GENERATION_STARTED, createEvent(EVENT_TYPES.GENERATION_STARTED, {
        generationType: "normal",
      }));

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("应该支持 MESSAGE_RECEIVED 事件", () => {
      const handler = vi.fn();
      emitter.on(EVENT_TYPES.MESSAGE_RECEIVED, handler);
      emitter.emit(EVENT_TYPES.MESSAGE_RECEIVED, createEvent(EVENT_TYPES.MESSAGE_RECEIVED, {
        messageId: 1,
        content: "Hello",
      }));

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("应该支持 CHAT_CHANGED 事件", () => {
      const handler = vi.fn();
      emitter.on(EVENT_TYPES.CHAT_CHANGED, handler);
      emitter.emit(EVENT_TYPES.CHAT_CHANGED, createEvent(EVENT_TYPES.CHAT_CHANGED, {
        chatId: "chat-123",
      }));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
