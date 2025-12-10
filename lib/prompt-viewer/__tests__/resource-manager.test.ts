/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     资源管理器测试                                          ║
 * ║                                                                            ║
 * ║  测试资源清理和生命周期管理功能                                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resourceManager,
  registerComponentCleanup,
  unregisterComponentCleanup,
  getResourceManagerStatus,
} from "../resource-manager";

describe("ResourceManager", () => {
  beforeEach(() => {
    // 清理之前的状态
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 测试后清理
    resourceManager.cleanupAll();
  });

  describe("基本功能", () => {
    it("应该能够注册清理函数", () => {
      const cleanup = vi.fn();
      resourceManager.registerCleanup("test-key", cleanup);

      const status = getResourceManagerStatus();
      expect(status.registeredCount).toBe(1);
    });

    it("应该能够取消注册清理函数", () => {
      const cleanup = vi.fn();
      resourceManager.registerCleanup("test-key", cleanup);
      resourceManager.unregisterCleanup("test-key");

      const status = getResourceManagerStatus();
      expect(status.registeredCount).toBe(0);
    });

    it("应该能够执行指定的清理函数", async () => {
      const cleanup = vi.fn();
      resourceManager.registerCleanup("test-key", cleanup);

      await resourceManager.cleanup("test-key");

      expect(cleanup).toHaveBeenCalledOnce();
    });

    it("应该能够执行所有清理函数", async () => {
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();
      
      resourceManager.registerCleanup("test-key-1", cleanup1);
      resourceManager.registerCleanup("test-key-2", cleanup2);

      await resourceManager.cleanupAll();

      expect(cleanup1).toHaveBeenCalledOnce();
      expect(cleanup2).toHaveBeenCalledOnce();
    });
  });

  describe("错误处理", () => {
    it("应该处理清理函数中的错误", async () => {
      const errorCleanup = vi.fn().mockRejectedValue(new Error("清理失败"));
      const normalCleanup = vi.fn();

      resourceManager.registerCleanup("error-key", errorCleanup);
      resourceManager.registerCleanup("normal-key", normalCleanup);

      // 不应该抛出错误
      await expect(resourceManager.cleanupAll()).resolves.toBeUndefined();

      expect(errorCleanup).toHaveBeenCalledOnce();
      expect(normalCleanup).toHaveBeenCalledOnce();
    });

    it("应该处理不存在的清理键", async () => {
      // 不应该抛出错误
      await expect(resourceManager.cleanup("non-existent")).resolves.toBeUndefined();
    });
  });

  describe("组件清理便捷方法", () => {
    it("应该能够注册组件清理", () => {
      const cleanup = vi.fn();
      registerComponentCleanup("TestComponent", "dialogue-123", cleanup);

      const status = getResourceManagerStatus();
      expect(status.registeredCount).toBeGreaterThan(0);
    });

    it("应该能够取消注册组件清理", () => {
      const cleanup = vi.fn();
      registerComponentCleanup("TestComponent", "dialogue-123", cleanup);
      unregisterComponentCleanup("TestComponent", "dialogue-123");

      // 注意：由于可能有其他测试注册的清理函数，我们只检查函数不会被调用
      resourceManager.cleanup("TestComponent-dialogue-123");
      expect(cleanup).not.toHaveBeenCalled();
    });
  });

  describe("状态查询", () => {
    it("应该返回正确的状态信息", () => {
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();
      
      resourceManager.registerCleanup("test-1", cleanup1);
      resourceManager.registerCleanup("test-2", cleanup2);

      const status = getResourceManagerStatus();
      expect(status.isDestroyed).toBe(false);
      expect(status.registeredCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("异步清理", () => {
    it("应该能够处理异步清理函数", async () => {
      const asyncCleanup = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      resourceManager.registerCleanup("async-key", asyncCleanup);

      await resourceManager.cleanup("async-key");

      expect(asyncCleanup).toHaveBeenCalledOnce();
    });

    it("应该能够并行执行多个异步清理", async () => {
      const asyncCleanup1 = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const asyncCleanup2 = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 15));
      });

      resourceManager.registerCleanup("async-1", asyncCleanup1);
      resourceManager.registerCleanup("async-2", asyncCleanup2);

      const startTime = Date.now();
      await resourceManager.cleanupAll();
      const endTime = Date.now();

      // 并行执行应该比串行执行快
      expect(endTime - startTime).toBeLessThan(30); // 应该小于两个延迟的总和
      expect(asyncCleanup1).toHaveBeenCalledOnce();
      expect(asyncCleanup2).toHaveBeenCalledOnce();
    });
  });
});
