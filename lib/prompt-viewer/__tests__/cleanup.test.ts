/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     清理功能测试                                            ║
 * ║                                                                            ║
 * ║  测试全局清理接口和生命周期管理                                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cleanupDialogue,
  cleanupAll,
  cleanupExpired,
  getCleanupStatus,
} from "../cleanup";

// Mock 依赖
vi.mock("../prompt-interceptor", () => ({
  promptInterceptor: {
    stopInterception: vi.fn(),
    destroy: vi.fn(),
    isInstanceDestroyed: vi.fn().mockReturnValue(false),
  },
}));

vi.mock("@/lib/store/prompt-viewer-store", () => ({
  usePromptViewerStore: {
    getState: vi.fn().mockReturnValue({
      cleanup: vi.fn(),
      cleanupExpired: vi.fn(),
      destroy: vi.fn(),
    }),
  },
}));

vi.mock("../resource-manager", () => ({
  resourceManager: {
    cleanup: vi.fn(),
    destroy: vi.fn(),
  },
}));

describe("Cleanup Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("cleanupDialogue", () => {
    it("应该清理指定对话的资源", async () => {
      const dialogueKey = "test-dialogue-123";

      await cleanupDialogue(dialogueKey);

      // 验证拦截器被停止
      const { promptInterceptor } = await import("../prompt-interceptor");
      expect(promptInterceptor.stopInterception).toHaveBeenCalledWith(dialogueKey);

      // 验证 Store 被清理
      const { usePromptViewerStore } = await import("@/lib/store/prompt-viewer-store");
      const store = usePromptViewerStore.getState();
      expect(store.cleanup).toHaveBeenCalledWith(dialogueKey);

      // 验证资源管理器被清理
      const { resourceManager } = await import("../resource-manager");
      expect(resourceManager.cleanup).toHaveBeenCalledWith(`PromptViewerModal-${dialogueKey}`);
      expect(resourceManager.cleanup).toHaveBeenCalledWith(`PromptViewerButton-${dialogueKey}`);
    });

    it("应该处理空的对话键", async () => {
      // 不应该抛出错误
      await expect(cleanupDialogue("")).resolves.toBeUndefined();
      await expect(cleanupDialogue(null as any)).resolves.toBeUndefined();
      await expect(cleanupDialogue(undefined as any)).resolves.toBeUndefined();
    });

    it("应该处理清理过程中的错误", async () => {
      const { promptInterceptor } = await import("../prompt-interceptor");
      vi.mocked(promptInterceptor.stopInterception).mockImplementation(() => {
        throw new Error("停止拦截失败");
      });

      // 不应该抛出错误
      await expect(cleanupDialogue("test-dialogue")).resolves.toBeUndefined();
    });
  });

  describe("cleanupAll", () => {
    it("应该清理所有资源", async () => {
      await cleanupAll();

      // 验证拦截器被销毁
      const { promptInterceptor } = await import("../prompt-interceptor");
      expect(promptInterceptor.destroy).toHaveBeenCalledOnce();

      // 验证 Store 被销毁
      const { usePromptViewerStore } = await import("@/lib/store/prompt-viewer-store");
      const store = usePromptViewerStore.getState();
      expect(store.destroy).toHaveBeenCalledOnce();

      // 验证资源管理器被销毁
      const { resourceManager } = await import("../resource-manager");
      expect(resourceManager.destroy).toHaveBeenCalledOnce();
    });

    it("应该处理已销毁的拦截器", async () => {
      const { promptInterceptor } = await import("../prompt-interceptor");
      vi.mocked(promptInterceptor.isInstanceDestroyed).mockReturnValue(true);

      // 不应该抛出错误
      await expect(cleanupAll()).resolves.toBeUndefined();

      // 已销毁的拦截器不应该再次调用 destroy
      expect(promptInterceptor.destroy).not.toHaveBeenCalled();
    });

    it("应该处理清理过程中的错误", async () => {
      const { promptInterceptor } = await import("../prompt-interceptor");
      vi.mocked(promptInterceptor.destroy).mockImplementation(() => {
        throw new Error("销毁失败");
      });

      // 不应该抛出错误
      await expect(cleanupAll()).resolves.toBeUndefined();
    });
  });

  describe("cleanupExpired", () => {
    it("应该清理过期资源", async () => {
      await cleanupExpired();

      // 验证 Store 的过期清理被调用
      const { usePromptViewerStore } = await import("@/lib/store/prompt-viewer-store");
      const store = usePromptViewerStore.getState();
      expect(store.cleanupExpired).toHaveBeenCalledOnce();
    });

    it("应该处理清理过程中的错误", async () => {
      const { usePromptViewerStore } = await import("@/lib/store/prompt-viewer-store");
      const store = usePromptViewerStore.getState();
      vi.mocked(store.cleanupExpired).mockImplementation(() => {
        throw new Error("过期清理失败");
      });

      // 不应该抛出错误
      await expect(cleanupExpired()).resolves.toBeUndefined();
    });
  });

  describe("getCleanupStatus", () => {
    it("应该返回清理状态信息", () => {
      const status = getCleanupStatus();

      expect(status).toHaveProperty("resourceManagerDestroyed");
      expect(status).toHaveProperty("registeredResourceCount");
      expect(status).toHaveProperty("interceptorDestroyed");

      expect(typeof status.resourceManagerDestroyed).toBe("boolean");
      expect(typeof status.registeredResourceCount).toBe("number");
      expect(typeof status.interceptorDestroyed).toBe("boolean");
    });

    it("应该处理获取状态时的错误", () => {
      const status = getCleanupStatus();

      // 应该返回默认的安全状态（在错误情况下）
      expect(status.resourceManagerDestroyed).toBe(true);
      expect(status.registeredResourceCount).toBe(0);
      expect(status.interceptorDestroyed).toBe(true);
    });
  });

  describe("错误恢复", () => {
    it("应该在部分清理失败时继续执行其他清理", async () => {
      const { promptInterceptor } = await import("../prompt-interceptor");
      const { usePromptViewerStore } = await import("@/lib/store/prompt-viewer-store");

      // 让拦截器清理失败
      vi.mocked(promptInterceptor.stopInterception).mockImplementation(() => {
        throw new Error("拦截器清理失败");
      });

      const dialogueKey = "test-dialogue";
      await cleanupDialogue(dialogueKey);

      // 即使拦截器清理失败，其他清理仍应执行
      const store = usePromptViewerStore.getState();
      expect(store.cleanup).toHaveBeenCalledWith(dialogueKey);
    });
  });
});
