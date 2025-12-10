/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     提示词查看器状态管理测试                                ║
 * ║                                                                            ║
 * ║  测试 Zustand 状态管理的核心功能                                            ║
 * ║  验证状态更新、UI 控制、拦截器集成等关键逻辑                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { usePromptViewerStore } from "@/lib/store/prompt-viewer-store";
import type { PromptData } from "@/types/prompt-viewer";
import { generateId } from "@/lib/prompt-viewer/constants";

// 模拟拦截器模块
vi.mock("@/lib/prompt-viewer/prompt-interceptor", () => ({
  promptInterceptor: {
    startInterception: vi.fn(),
    stopInterception: vi.fn(),
    addInterceptionCallback: vi.fn(),
    removeInterceptionCallback: vi.fn(),
    triggerInterception: vi.fn().mockImplementation((dialogueKey: string, characterId: string) => 
      Promise.resolve({
        id: "test-prompt",
        timestamp: Date.now(),
        systemMessage: "测试系统消息",
        userMessage: "测试用户消息",
        fullPrompt: "完整测试提示词",
        images: [],
        metadata: {
          characterId,
          dialogueKey,
          modelName: "test-model",
        },
      }),
    ),
  },
}));

describe("PromptViewerStore", () => {
  const testDialogueKey = "test-dialogue-123";
  const testCharacterId = "test-character-456";

  beforeEach(() => {
    // 重置 store 状态
    usePromptViewerStore.setState({
      prompts: {},
      intercepting: {},
      uiStates: {},
    });
  });

  describe("弹窗控制", () => {
    it("应该能够打开弹窗", () => {
      const { openModal, getUIState } = usePromptViewerStore.getState();

      openModal(testDialogueKey);

      const uiState = getUIState(testDialogueKey);
      expect(uiState.isOpen).toBe(true);
      expect(uiState.error).toBe(null);
    });

    it("应该能够关闭弹窗", () => {
      const { openModal, closeModal, getUIState } = usePromptViewerStore.getState();

      // 先打开
      openModal(testDialogueKey);
      expect(getUIState(testDialogueKey).isOpen).toBe(true);

      // 再关闭
      closeModal(testDialogueKey);
      expect(getUIState(testDialogueKey).isOpen).toBe(false);
    });

    it("应该忽略空的 dialogueKey", () => {
      const { openModal, uiStates } = usePromptViewerStore.getState();

      openModal("");
      openModal(null as any);
      openModal(undefined as any);

      expect(Object.keys(uiStates)).toHaveLength(0);
    });
  });

  describe("提示词管理", () => {
    it("应该能够更新提示词数据", () => {
      const { updatePrompt, getPrompt } = usePromptViewerStore.getState();

      const testPrompt: PromptData = {
        id: generateId("test"),
        timestamp: Date.now(),
        systemMessage: "系统消息",
        userMessage: "用户消息",
        fullPrompt: "完整提示词",
        images: [],
        metadata: {
          characterId: testCharacterId,
          dialogueKey: testDialogueKey,
          modelName: "gpt-3.5-turbo",
        },
      };

      updatePrompt(testDialogueKey, testPrompt);

      const storedPrompt = getPrompt(testDialogueKey);
      expect(storedPrompt).toEqual(testPrompt);
    });

    it("应该在更新提示词时清除错误状态", () => {
      const { setError, updatePrompt, getUIState } = usePromptViewerStore.getState();

      // 先设置错误
      setError(testDialogueKey, "测试错误");
      expect(getUIState(testDialogueKey).error).toBe("测试错误");

      // 更新提示词应该清除错误
      const testPrompt: PromptData = {
        id: generateId("test"),
        timestamp: Date.now(),
        systemMessage: "",
        userMessage: "",
        fullPrompt: "",
        images: [],
        metadata: {
          characterId: testCharacterId,
          dialogueKey: testDialogueKey,
          modelName: "test",
        },
      };

      updatePrompt(testDialogueKey, testPrompt);

      const uiState = getUIState(testDialogueKey);
      expect(uiState.error).toBe(null);
      expect(uiState.isLoading).toBe(false);
    });
  });

  describe("搜索控制", () => {
    it("应该能够设置搜索输入", () => {
      const { setSearchInput, getUIState } = usePromptViewerStore.getState();

      setSearchInput(testDialogueKey, "测试搜索");

      const uiState = getUIState(testDialogueKey);
      expect(uiState.searchInput).toBe("测试搜索");
    });

    it("应该能够切换仅显示匹配模式", () => {
      const { toggleMatchedOnly, getUIState } = usePromptViewerStore.getState();

      // 初始状态应该是 false
      expect(getUIState(testDialogueKey).matchedOnly).toBe(false);

      // 切换到 true
      toggleMatchedOnly(testDialogueKey);
      expect(getUIState(testDialogueKey).matchedOnly).toBe(true);

      // 再切换回 false
      toggleMatchedOnly(testDialogueKey);
      expect(getUIState(testDialogueKey).matchedOnly).toBe(false);
    });
  });

  describe("UI 状态控制", () => {
    it("应该能够切换区域展开状态", () => {
      const { toggleRegionExpansion, getUIState } = usePromptViewerStore.getState();

      const regionId = "test-region-1";

      // 初始状态应该是空集合
      expect(getUIState(testDialogueKey).expandedRegions.has(regionId)).toBe(false);

      // 展开区域
      toggleRegionExpansion(testDialogueKey, regionId);
      expect(getUIState(testDialogueKey).expandedRegions.has(regionId)).toBe(true);

      // 收起区域
      toggleRegionExpansion(testDialogueKey, regionId);
      expect(getUIState(testDialogueKey).expandedRegions.has(regionId)).toBe(false);
    });

    it("应该能够切换图片画廊展开状态", () => {
      const { toggleImageGallery, getUIState } = usePromptViewerStore.getState();

      // 初始状态应该是 false
      expect(getUIState(testDialogueKey).imageGalleryExpanded).toBe(false);

      // 展开图片画廊
      toggleImageGallery(testDialogueKey);
      expect(getUIState(testDialogueKey).imageGalleryExpanded).toBe(true);

      // 收起图片画廊
      toggleImageGallery(testDialogueKey);
      expect(getUIState(testDialogueKey).imageGalleryExpanded).toBe(false);
    });

    it("应该能够设置加载状态", () => {
      const { setLoading, getUIState } = usePromptViewerStore.getState();

      setLoading(testDialogueKey, true);
      expect(getUIState(testDialogueKey).isLoading).toBe(true);

      setLoading(testDialogueKey, false);
      expect(getUIState(testDialogueKey).isLoading).toBe(false);
    });

    it("应该能够设置错误状态", () => {
      const { setError, getUIState } = usePromptViewerStore.getState();

      setError(testDialogueKey, "测试错误消息");
      const uiState = getUIState(testDialogueKey);
      expect(uiState.error).toBe("测试错误消息");
      expect(uiState.isLoading).toBe(false); // 设置错误时应该停止加载

      // 清除错误
      setError(testDialogueKey, null);
      expect(getUIState(testDialogueKey).error).toBe(null);
    });
  });

  describe("拦截控制", () => {
    it("应该能够启动拦截", async () => {
      const { startInterception, isIntercepting } = usePromptViewerStore.getState();

      await startInterception(testDialogueKey);

      expect(isIntercepting(testDialogueKey)).toBe(true);
    });

    it("应该能够停止拦截", async () => {
      const { startInterception, stopInterception, isIntercepting } = usePromptViewerStore.getState();

      // 先启动拦截
      await startInterception(testDialogueKey);
      expect(isIntercepting(testDialogueKey)).toBe(true);

      // 再停止拦截
      await stopInterception(testDialogueKey);
      expect(isIntercepting(testDialogueKey)).toBe(false);
    });

    it("应该能够刷新提示词", async () => {
      const { refreshPrompt, getPrompt, getUIState } = usePromptViewerStore.getState();

      await refreshPrompt(testDialogueKey, testCharacterId);

      // 应该有提示词数据
      const prompt = getPrompt(testDialogueKey);
      expect(prompt).toBeTruthy();
      expect(prompt?.metadata.dialogueKey).toBe(testDialogueKey);
      expect(prompt?.metadata.characterId).toBe(testCharacterId);

      // 应该清除加载状态
      const uiState = getUIState(testDialogueKey);
      expect(uiState.isLoading).toBe(false);
      expect(uiState.error).toBe(null);
    });
  });

  describe("查询方法", () => {
    it("应该返回正确的默认状态", () => {
      const { getUIState, getPrompt, isIntercepting } = usePromptViewerStore.getState();

      // 不存在的对话应该返回默认状态
      const uiState = getUIState("non-existent");
      expect(uiState.isOpen).toBe(false);
      expect(uiState.searchInput).toBe("");
      expect(uiState.matchedOnly).toBe(false);
      expect(uiState.expandedRegions.size).toBe(0);
      expect(uiState.imageGalleryExpanded).toBe(false);
      expect(uiState.isLoading).toBe(false);
      expect(uiState.error).toBe(null);

      // 不存在的提示词应该返回 null
      expect(getPrompt("non-existent")).toBe(null);

      // 不存在的拦截状态应该返回 false
      expect(isIntercepting("non-existent")).toBe(false);
    });

    it("应该处理空参数", () => {
      const { getUIState, getPrompt, isIntercepting } = usePromptViewerStore.getState();

      expect(getPrompt("")).toBe(null);
      expect(getPrompt(null as any)).toBe(null);
      expect(getPrompt(undefined as any)).toBe(null);

      expect(getUIState("")).toBeTruthy(); // 应该返回默认状态
      expect(isIntercepting("")).toBe(false);
    });
  });
});
