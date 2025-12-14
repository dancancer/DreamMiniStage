/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     提示词拦截器测试                                        ║
 * ║                                                                            ║
 * ║  测试提示词拦截器的核心功能：拦截控制、数据构建、缓存管理                      ║
 * ║  验证拦截器的正确性和可靠性                                                ║
 * ║                                                                            ║
 * ║  整改后：使用 HistoryPreNodeTools 替代 ContextNodeTools                    ║
 * ║  Requirements: 5.1                                                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PromptInterceptorImpl } from "../prompt-interceptor";

/* ═══════════════════════════════════════════════════════════════════════════
   Mock 依赖：模拟工作流节点工具
   ═══════════════════════════════════════════════════════════════════════════ */

vi.mock("@/lib/store/dialogue-store", () => ({
  useDialogueStore: {
    getState: () => ({
      getDialogue: vi.fn(() => ({
        messages: [
          { role: "user", content: "测试消息", id: "1" },
          { role: "assistant", content: "测试回复", id: "2" },
        ],
      })),
    }),
  },
}));

vi.mock("@/lib/nodeflow/PresetNode/PresetNodeTools", () => ({
  PresetNodeTools: {
    // 整改后：buildPromptFramework 接收 chatHistoryMessages 参数
    // STPromptManager 内部展开 chatHistory marker，返回已展开的 messages
    buildPromptFramework: vi.fn(() => Promise.resolve({
      systemMessage: "测试系统消息（含世界书）",
      userMessage: "测试用户消息",
      // messages 已由 STPromptManager 展开 chatHistory marker
      messages: [
        { role: "system", content: "测试系统消息" },
        { role: "user", content: "历史用户消息" },
        { role: "assistant", content: "历史助手消息" },
        { role: "user", content: "测试消息" },  // 当前用户输入
      ],
      presetId: "mock-preset",
    })),
  },
}));

/* ═══════════════════════════════════════════════════════════════════════════
   整改后：使用 HistoryPreNodeTools 替代 ContextNodeTools
   Requirements: 5.1 - ContextNode 不再负责获取聊天历史
   ═══════════════════════════════════════════════════════════════════════════ */

vi.mock("@/lib/nodeflow/HistoryPreNode/HistoryPreNodeTools", () => ({
  HistoryPreNodeTools: {
    getChatHistoryMessages: vi.fn(() => Promise.resolve([
      { role: "user", content: "历史用户消息" },
      { role: "assistant", content: "历史助手消息" },
    ])),
    getChatHistoryText: vi.fn(() => Promise.resolve("历史文本摘要")),
  },
}));

vi.mock("@/lib/nodeflow/WorldBookNode/WorldBookNodeTools", () => ({
  WorldBookNodeTools: {
    assemblePromptWithWorldBook: vi.fn(() => Promise.resolve({
      systemMessage: "测试系统消息（含世界书）",
      userMessage: "测试用户消息（含世界书）",
    })),
  },
}));

describe("PromptInterceptorImpl", () => {
  let interceptor: PromptInterceptorImpl;
  const testDialogueKey = "test-dialogue";
  const testCharacterId = "test-character";

  beforeEach(() => {
    interceptor = new PromptInterceptorImpl();
  });

  describe("拦截控制", () => {
    it("应该能够开始拦截", () => {
      interceptor.startInterception(testDialogueKey);
      expect(interceptor.isIntercepting(testDialogueKey)).toBe(true);
    });

    it("应该能够停止拦截", () => {
      interceptor.startInterception(testDialogueKey);
      interceptor.stopInterception(testDialogueKey);
      expect(interceptor.isIntercepting(testDialogueKey)).toBe(false);
    });

    it("应该处理无效的对话键", () => {
      expect(interceptor.isIntercepting("")).toBe(false);
      expect(interceptor.getLatestPrompt("")).toBe(null);
    });
  });

  describe("提示词数据管理", () => {
    it("应该返回空的最新提示词（初始状态）", () => {
      const prompt = interceptor.getLatestPrompt(testDialogueKey);
      expect(prompt).toBe(null);
    });

    it("应该能够手动触发拦截", async () => {
      interceptor.startInterception(testDialogueKey);
      
      const promptData = await interceptor.triggerInterception(testDialogueKey, testCharacterId);
      
      expect(promptData).toBeDefined();
      expect(promptData.id).toBeDefined();
      expect(promptData.timestamp).toBeGreaterThan(0);
      expect(promptData.metadata.dialogueKey).toBe(testDialogueKey);
      expect(promptData.metadata.characterId).toBe(testCharacterId);
      // messages 应该与工作流一致：展开 chatHistory，但不合并相邻同角色
      // messages 已由 STPromptManager 展开 chatHistory marker
      // 包含：system + 历史消息 + 当前用户输入
      expect(promptData.messages.map((m: { role: string }) => m.role)).toEqual([
        "system",
        "user",
        "assistant",
        "user",
      ]);
    });

    it("应该缓存最新的提示词", async () => {
      interceptor.startInterception(testDialogueKey);
      
      const promptData = await interceptor.triggerInterception(testDialogueKey, testCharacterId);
      const cachedPrompt = interceptor.getLatestPrompt(testDialogueKey);
      
      expect(cachedPrompt).toEqual(promptData);
    });
  });

  describe("错误处理", () => {
    it("应该处理缺少参数的情况", async () => {
      await expect(interceptor.triggerInterception("", testCharacterId))
        .rejects.toThrow("缺少必要参数");
      
      await expect(interceptor.triggerInterception(testDialogueKey, ""))
        .rejects.toThrow("缺少必要参数");
    });
  });

  describe("回调管理", () => {
    it("应该能够添加和移除回调", async () => {
      const callback = vi.fn();
      
      interceptor.startInterception(testDialogueKey);
      interceptor.addInterceptionCallback(testDialogueKey, callback);
      
      await interceptor.triggerInterception(testDialogueKey, testCharacterId);
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        metadata: expect.objectContaining({
          dialogueKey: testDialogueKey,
          characterId: testCharacterId,
        }),
      }));
      
      interceptor.removeInterceptionCallback(testDialogueKey, callback);
      
      await interceptor.triggerInterception(testDialogueKey, testCharacterId);
      
      // 回调不应该再被调用
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
