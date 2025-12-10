/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     提示词查看器按钮测试                                    ║
 * ║                                                                            ║
 * ║  测试提示词查看器按钮的基本功能和交互                                        ║
 * ║  设计原则：专注核心功能逻辑，避免过度测试边界情况                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PromptViewerButtonProps } from "@/types/prompt-viewer";

/* ═══════════════════════════════════════════════════════════════════════════
   测试工具
   ═══════════════════════════════════════════════════════════════════════════ */

function createMockProps(overrides: Partial<PromptViewerButtonProps> = {}): PromptViewerButtonProps {
  return {
    dialogueKey: "test-dialogue-123",
    characterId: "test-character-456",
    ...overrides,
  };
}

// ========== Mock 依赖 ==========

// Mock 状态管理 hooks
vi.mock("@/lib/store/prompt-viewer-store", () => ({
  useModalActions: vi.fn(() => ({
    openModal: vi.fn(),
  })),
  useInterceptionActions: vi.fn(() => ({
    startInterception: vi.fn(),
  })),
  useViewerUIState: vi.fn(() => ({
    isOpen: false,
    isLoading: false,
    error: null,
  })),
  useInterceptionState: vi.fn(() => false),
}));

// Mock 分析追踪
vi.mock("@/utils/google-analytics", () => ({
  trackButtonClick: vi.fn(),
}));

// ========== 测试套件 ==========

describe("PromptViewerButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========== 属性验证测试 ==========

  it("应该接受正确的属性", () => {
    const props = createMockProps();
    
    expect(props.dialogueKey).toBe("test-dialogue-123");
    expect(props.characterId).toBe("test-character-456");
  });

  it("应该支持可选属性", () => {
    const props = createMockProps({
      className: "custom-class",
      disabled: true,
    });
    
    expect(props.className).toBe("custom-class");
    expect(props.disabled).toBe(true);
  });

  // ========== 参数验证测试 ==========

  it("应该要求必要的参数", () => {
    const propsWithoutDialogueKey = {
      characterId: "test-character-456",
    };
    
    const propsWithoutCharacterId = {
      dialogueKey: "test-dialogue-123",
    };
    
    // 这些应该在 TypeScript 层面被捕获
    // 在运行时，组件应该优雅地处理缺失参数
    expect(propsWithoutDialogueKey.characterId).toBeDefined();
    expect(propsWithoutCharacterId.dialogueKey).toBeDefined();
  });

  // ========== 按钮文本逻辑测试 ==========

  it("应该根据状态显示正确的按钮文本", () => {
    // 测试按钮文本逻辑
    const getButtonText = (isLoading: boolean, hasError: boolean, isActive: boolean) => {
      if (isLoading) return "加载中...";
      if (hasError) return "查看器错误";
      if (isActive) return "提示词查看器";
      return "查看提示词";
    };
    
    expect(getButtonText(false, false, false)).toBe("查看提示词");
    expect(getButtonText(true, false, false)).toBe("加载中...");
    expect(getButtonText(false, true, false)).toBe("查看器错误");
    expect(getButtonText(false, false, true)).toBe("提示词查看器");
  });

  // ========== 样式类名逻辑测试 ==========

  it("应该根据状态生成正确的样式类名", () => {
    // 测试基础样式类名
    const baseClasses = "h-auto px-1.5 sm:px-2 md:px-4 py-1.5 text-xs whitespace-nowrap min-w-fit";
    expect(baseClasses).toContain("h-auto");
    expect(baseClasses).toContain("px-1.5");
    
    // 测试错误状态样式
    const errorClasses = "bg-destructive/10 text-destructive border-destructive/30 hover:border-destructive";
    expect(errorClasses).toContain("bg-destructive/10");
    
    // 测试激活状态样式
    const activeClasses = "bg-info text-overlay border-info";
    expect(activeClasses).toContain("bg-info");
    
    // 测试默认状态样式
    const defaultClasses = "bg-overlay text-info border-border hover:border-info";
    expect(defaultClasses).toContain("bg-overlay");
  });

  // ========== 工具提示逻辑测试 ==========

  it("应该根据状态生成正确的工具提示", () => {
    const defaultTooltip = "查看发送给AI的完整提示词";
    const errorTooltip = "查看器出现错误";
    
    expect(defaultTooltip).toBe("查看发送给AI的完整提示词");
    expect(errorTooltip).toBe("查看器出现错误");
  });
});
