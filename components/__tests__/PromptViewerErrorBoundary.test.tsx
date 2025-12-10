/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  提示词查看器错误边界组件测试                                ║
 * ║                                                                           ║
 * ║  测试错误处理工具函数和错误分类等核心功能                                    ║
 * ║  确保错误边界能够有效隔离错误，不影响主应用功能                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  createErrorHandler,
  safeExecute,
  safeExecuteAsync,
} from "../prompt-viewer/PromptViewerErrorBoundary";
import type { PromptViewerError } from "@/types/prompt-viewer";

/* ═══════════════════════════════════════════════════════════════════════════
   测试套件
   ═══════════════════════════════════════════════════════════════════════════ */

describe("PromptViewerErrorBoundary 工具函数", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleGroupSpy: ReturnType<typeof vi.spyOn>;
  let consoleGroupEndSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // 模拟 console 方法
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleGroupSpy = vi.spyOn(console, "group").mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, "groupEnd").mockImplementation(() => {});
  });

  afterEach(() => {
    // 恢复 console 方法
    consoleErrorSpy.mockRestore();
    consoleGroupSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
  });

  describe("createErrorHandler", () => {
    it("应该创建错误处理器", () => {
      const errorHandler = createErrorHandler("TestContext");
      const testError: PromptViewerError = {
        type: "UNKNOWN" as const,
        message: "测试错误",
        timestamp: Date.now(),
      };

      errorHandler(testError);

      expect(consoleGroupSpy).toHaveBeenCalledWith(
        expect.stringContaining("[TestContext] 提示词查看器错误"),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith("错误类型:", "UNKNOWN");
      expect(consoleErrorSpy).toHaveBeenCalledWith("错误消息:", "测试错误");
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });

    it("应该处理不同类型的错误", () => {
      const errorHandler = createErrorHandler("TestContext");
      
      const interceptError: PromptViewerError = {
        type: "INTERCEPTION_FAILED" as const,
        message: "拦截失败",
        timestamp: Date.now(),
      };

      const searchError: PromptViewerError = {
        type: "SEARCH_INVALID" as const,
        message: "搜索无效",
        timestamp: Date.now(),
      };

      errorHandler(interceptError);
      errorHandler(searchError);

      expect(consoleErrorSpy).toHaveBeenCalledWith("错误类型:", "INTERCEPTION_FAILED");
      expect(consoleErrorSpy).toHaveBeenCalledWith("错误类型:", "SEARCH_INVALID");
    });
  });

  describe("safeExecute", () => {
    it("应该正常执行函数", () => {
      const result = safeExecute(() => "成功", "失败", "测试上下文");
      expect(result).toBe("成功");
    });

    it("应该捕获错误并返回降级值", () => {
      const result = safeExecute(
        () => {
          throw new Error("测试错误");
        },
        "降级值",
        "测试上下文",
      );

      expect(result).toBe("降级值");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[测试上下文] 安全执行失败:",
        expect.any(Error),
      );
    });

    it("应该处理复杂的返回值", () => {
      const complexObject = { data: "test", count: 42 };
      const result = safeExecute(() => complexObject, null, "测试上下文");
      expect(result).toEqual(complexObject);
    });

    it("应该处理空的降级值", () => {
      const result = safeExecute(
        () => {
          throw new Error("测试错误");
        },
        null,
        "测试上下文",
      );

      expect(result).toBeNull();
    });
  });

  describe("safeExecuteAsync", () => {
    it("应该正常执行异步函数", async () => {
      const result = await safeExecuteAsync(
        async () => "异步成功",
        "异步失败",
        "异步测试上下文",
      );
      expect(result).toBe("异步成功");
    });

    it("应该捕获异步错误并返回降级值", async () => {
      const result = await safeExecuteAsync(
        async () => {
          throw new Error("异步测试错误");
        },
        "异步降级值",
        "异步测试上下文",
      );

      expect(result).toBe("异步降级值");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[异步测试上下文] 异步安全执行失败:",
        expect.any(Error),
      );
    });

    it("应该处理Promise拒绝", async () => {
      const result = await safeExecuteAsync(
        async () => Promise.reject(new Error("Promise拒绝")),
        "Promise降级值",
        "Promise测试上下文",
      );

      expect(result).toBe("Promise降级值");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Promise测试上下文] 异步安全执行失败:",
        expect.any(Error),
      );
    });

    it("应该处理异步复杂对象", async () => {
      const complexAsyncResult = { async: true, data: [1, 2, 3] };
      const result = await safeExecuteAsync(
        async () => Promise.resolve(complexAsyncResult),
        null,
        "异步对象测试",
      );

      expect(result).toEqual(complexAsyncResult);
    });
  });

  describe("错误处理集成", () => {
    it("应该在错误处理器中使用安全执行", () => {
      const errorHandler = createErrorHandler("集成测试");
      
      // 使用安全执行来调用错误处理器
      const result = safeExecute(
        () => {
          const testError: PromptViewerError = {
            type: "COMPONENT_ERROR" as const,
            message: "组件错误",
            timestamp: Date.now(),
          };
          errorHandler(testError);
          return "处理成功";
        },
        "处理失败",
        "错误处理器集成测试",
      );

      expect(result).toBe("处理成功");
      expect(consoleGroupSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith("错误类型:", "COMPONENT_ERROR");
    });

    it("应该处理错误处理器本身的错误", () => {
      // 创建一个会抛出错误的错误处理器
      const faultyErrorHandler = () => {
        throw new Error("错误处理器本身出错");
      };

      const result = safeExecute(
        () => {
          faultyErrorHandler();
          return "不应该到达这里";
        },
        "错误处理器降级",
        "错误处理器错误测试",
      );

      expect(result).toBe("错误处理器降级");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[错误处理器错误测试] 安全执行失败:",
        expect.any(Error),
      );
    });
  });
});
