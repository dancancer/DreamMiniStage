/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   Slash Handlers Integration Tests                        ║
 * ║                                                                           ║
 * ║  测试 triggerSlash 与 Slash Command 系统的完整集成                          ║
 * ║  **Validates: Requirements 8.1, 8.2**                                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { slashHandlers } from "../slash-handlers";
import type { ApiCallContext } from "../types";

// ============================================================================
//                              测试辅助函数
// ============================================================================

/**
 * 创建模拟的 ApiCallContext
 */
function createMockContext(overrides: Partial<{
  characterId: string;
  globalVars: Record<string, unknown>;
  characterVars: Record<string, Record<string, unknown>>;
}>= {}): ApiCallContext {
  const globalVars: Record<string, unknown> = overrides.globalVars ?? {};
  const characterVars: Record<string, Record<string, unknown>> = overrides.characterVars ?? {};
  const characterId = overrides.characterId;

  return {
    characterId,
    messages: [],
    setScriptVariable: vi.fn((key, value, scope, id) => {
      if (scope === "global") {
        globalVars[key] = value;
      } else if (id) {
        characterVars[id] = characterVars[id] ?? {};
        characterVars[id][key] = value;
      }
    }),
    deleteScriptVariable: vi.fn((key, scope, id) => {
      if (scope === "global") {
        delete globalVars[key];
      } else if (id && characterVars[id]) {
        delete characterVars[id][key];
      }
    }),
    getVariablesSnapshot: () => ({
      global: { ...globalVars },
      character: { ...characterVars },
    }),
  };
}

// ============================================================================
//                              集成测试
// ============================================================================

describe("triggerSlash Integration Tests", () => {
  describe("/send text|/trigger flow (Requirements 8.1, 8.2)", () => {
    /**
     * 测试基本的 /send text|/trigger 流程
     * Requirements: 8.1
     */
    it("should execute /send followed by /trigger in sequence", async () => {
      const onSend = vi.fn().mockResolvedValue(undefined);
      const onTrigger = vi.fn().mockResolvedValue(undefined);
      const ctx = createMockContext();

      const result = await slashHandlers.triggerSlash(
        ["/send Hello World|/trigger", { onSend, onTrigger }],
        ctx
      );

      expect(result.isError).toBe(false);
      expect(onSend).toHaveBeenCalledTimes(1);
      expect(onSend).toHaveBeenCalledWith(
        "Hello World",
        expect.objectContaining({ at: undefined, name: undefined }),
      );
      expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    it("should allow /send even with empty or ellipsis text", async () => {
      const onSend = vi.fn().mockResolvedValue(undefined);
      const onTrigger = vi.fn().mockResolvedValue(undefined);
      const ctx = createMockContext();

      const result = await slashHandlers.triggerSlash(
        ["/send|/trigger", { onSend, onTrigger }],
        ctx
      );

      expect(result.isError).toBe(false);
      expect(onSend).toHaveBeenCalledWith(
        "",
        expect.objectContaining({ at: undefined, name: undefined }),
      );
      expect(onTrigger).toHaveBeenCalledTimes(1);

      const resultEllipsis = await slashHandlers.triggerSlash(
        ["/send ...|/trigger", { onSend, onTrigger }],
        ctx
      );

      expect(resultEllipsis.isError).toBe(false);
      expect(onSend).toHaveBeenCalledWith(
        "...",
        expect.objectContaining({ at: undefined, name: undefined }),
      );
    });

    /**
     * 测试 /trigger 单独执行
     * Requirements: 8.3
     */
    it("should execute /trigger alone", async () => {
      const onTrigger = vi.fn().mockResolvedValue(undefined);
      const ctx = createMockContext();

      const result = await slashHandlers.triggerSlash(
        ["/trigger", { onTrigger }],
        ctx
      );

      expect(result.isError).toBe(false);
      expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    /**
     * 测试 pipe 值传递
     * Requirements: 8.1
     */
    it("should pass pipe value through command chain", async () => {
      const onSend = vi.fn().mockResolvedValue(undefined);
      const ctx = createMockContext();

      const result = await slashHandlers.triggerSlash(
        ["/echo TestValue|/send", { onSend }],
        ctx
      );

      expect(result.isError).toBe(false);
      expect(onSend).toHaveBeenCalledWith(
        "TestValue",
        expect.objectContaining({ at: undefined, name: undefined }),
      );
    });
  });

  describe("triggerSlashWithResult alias", () => {
    /**
     * 测试 triggerSlashWithResult 是 triggerSlash 的别名
     */
    it("should behave identically to triggerSlash", async () => {
      const onSend = vi.fn().mockResolvedValue(undefined);
      const onTrigger = vi.fn().mockResolvedValue(undefined);
      const ctx = createMockContext();

      const result = await slashHandlers.triggerSlashWithResult(
        ["/send Hello|/trigger", { onSend, onTrigger }],
        ctx
      );

      expect(result.isError).toBe(false);
      expect(onSend).toHaveBeenCalledWith(
        "Hello",
        expect.objectContaining({ at: undefined, name: undefined }),
      );
      expect(onTrigger).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error handling", () => {
    /**
     * 测试无效命令返回错误
     */
    it("should return error for invalid command syntax", async () => {
      const ctx = createMockContext();

      const result = await slashHandlers.triggerSlash(
        ["not a command", {}],
        ctx
      );

      expect(result.isError).toBe(true);
      expect(result.errorMessage).toBeDefined();
      expect(result.errorMessage!.length).toBeGreaterThan(0);
    });

    /**
     * 测试未知命令返回错误
     */
    it("should return error for unknown command", async () => {
      const ctx = createMockContext();

      const result = await slashHandlers.triggerSlash(
        ["/unknowncommand123", {}],
        ctx
      );

      expect(result.isError).toBe(true);
      expect(result.errorMessage).toContain("unknowncommand123");
    });

    /**
     * 测试命令执行失败时返回错误
     */
    it("should return error when command execution fails", async () => {
      const onSend = vi.fn().mockRejectedValue(new Error("Network error"));
      const ctx = createMockContext();

      const result = await slashHandlers.triggerSlash(
        ["/send Hello", { onSend }],
        ctx
      );

      expect(result.isError).toBe(true);
      expect(result.errorMessage).toContain("Network error");
    });
  });

  describe("Variable integration", () => {
    /**
     * 测试变量设置和获取
     */
    it("should set and get variables through slash commands", async () => {
      const ctx = createMockContext();

      const result = await slashHandlers.triggerSlash(
        ["/setvar mykey=myvalue|/getvar mykey", {}],
        ctx
      );

      expect(result.isError).toBe(false);
      expect(result.pipe).toBe("myvalue");
      expect(ctx.setScriptVariable).toHaveBeenCalled();
    });

    /**
     * 测试变量删除
     */
    it("should delete variables through slash commands", async () => {
      const ctx = createMockContext({ globalVars: { existingKey: "value" } });

      const result = await slashHandlers.triggerSlash(
        ["/delvar existingKey", {}],
        ctx
      );

      expect(result.isError).toBe(false);
      expect(ctx.deleteScriptVariable).toHaveBeenCalled();
    });
  });

  describe("Complex command chains", () => {
    /**
     * 测试复杂的命令链
     */
    it("should handle multi-step command chains", async () => {
      const onSend = vi.fn().mockResolvedValue(undefined);
      const onTrigger = vi.fn().mockResolvedValue(undefined);
      const ctx = createMockContext();

      // /setvar name=World|/echo Hello|/pass|/send|/trigger
      const result = await slashHandlers.triggerSlash(
        ["/echo Hello|/pass|/send|/trigger", { onSend, onTrigger }],
        ctx
      );

      expect(result.isError).toBe(false);
      expect(onSend).toHaveBeenCalledWith(
        "Hello",
        expect.objectContaining({ at: undefined, name: undefined }),
      );
      expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    /**
     * 测试命令链中间失败时停止执行
     */
    it("should stop execution on first error in chain", async () => {
      const onSend = vi.fn().mockResolvedValue(undefined);
      const onTrigger = vi.fn().mockResolvedValue(undefined);
      const ctx = createMockContext();

      // /echo Hello|/unknowncmd|/trigger - 中间命令失败
      const result = await slashHandlers.triggerSlash(
        ["/echo Hello|/unknowncmd|/trigger", { onSend, onTrigger }],
        ctx
      );

      expect(result.isError).toBe(true);
      expect(onTrigger).not.toHaveBeenCalled();
    });
  });

  describe("Role/system callbacks wiring", () => {
    it("routes /sys to onSendSystem", async () => {
      const sys: string[] = [];
      const ctx = createMockContext();

      const result = await slashHandlers.triggerSlash(
        ["/sys alert from system", { onSendSystem: (text) => { sys.push(text); } }],
        ctx,
      );

      expect(result.isError).toBe(false);
      expect(sys).toEqual(["alert from system"]);
    });

    it("routes /sendas to onSendAs with role + text", async () => {
      const sent: Array<{ role: string; text: string }> = [];
      const ctx = createMockContext();

      const result = await slashHandlers.triggerSlash(
        ["/sendas narrator hello world", { onSendAs: (role, text) => { sent.push({ role, text }); } }],
        ctx,
      );

      expect(result.isError).toBe(false);
      expect(sent).toEqual([{ role: "narrator", text: "hello world" }]);
    });

    it("routes /impersonate to onImpersonate", async () => {
      const imp: string[] = [];
      const ctx = createMockContext();

      const result = await slashHandlers.triggerSlash(
        ["/impersonate mimic this", { onImpersonate: (text) => { imp.push(text); } }],
        ctx,
      );

      expect(result.isError).toBe(false);
      expect(imp).toEqual(["mimic this"]);
    });

    it("routes /swipe to onSwipe", async () => {
      const swipes: string[] = [];
      const ctx = createMockContext();

      const result = await slashHandlers.triggerSlash(
        ["/swipe 2", { onSwipe: (target) => { if (target) swipes.push(target); } }],
        ctx,
      );

      expect(result.isError).toBe(false);
      expect(swipes).toEqual(["2"]);
    });
  });
});
