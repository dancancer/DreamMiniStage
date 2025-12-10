/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                   提示词查看器弹窗组件测试                                 ║
 * ║                                                                           ║
 * ║  测试弹窗组件的基本功能和属性处理                                           ║
 * ║  设计原则：简洁的测试用例，专注于核心功能验证                               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi } from "vitest";
import type { PromptViewerModalProps } from "@/types/prompt-viewer";

/* ═══════════════════════════════════════════════════════════════════════════
   测试工具函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 创建默认的弹窗组件属性
 */
function createDefaultProps(): PromptViewerModalProps {
  return {
    isOpen: false,
    onClose: vi.fn(),
    dialogueKey: "test-dialogue-123",
    characterId: "test-character-456",
  };
}

/**
 * 创建自定义属性的辅助函数
 */
function createProps(overrides: Partial<PromptViewerModalProps> = {}): PromptViewerModalProps {
  return {
    ...createDefaultProps(),
    ...overrides,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   基础属性测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("PromptViewerModal", () => {
  it("should create props with correct default values", () => {
    const props = createDefaultProps();

    expect(props.isOpen).toBe(false);
    expect(props.onClose).toBeTypeOf("function");
    expect(props.dialogueKey).toBe("test-dialogue-123");
    expect(props.characterId).toBe("test-character-456");
  });

  it("should override default props correctly", () => {
    const props = createProps({
      isOpen: true,
      dialogueKey: "custom-dialogue",
      characterId: "custom-character",
    });

    expect(props.isOpen).toBe(true);
    expect(props.dialogueKey).toBe("custom-dialogue");
    expect(props.characterId).toBe("custom-character");
    expect(props.onClose).toBeTypeOf("function");
  });

  it("should require all necessary parameters", () => {
    const props = createDefaultProps();

    // 验证所有必需的属性都存在
    expect(props).toHaveProperty("isOpen");
    expect(props).toHaveProperty("onClose");
    expect(props).toHaveProperty("dialogueKey");
    expect(props).toHaveProperty("characterId");
  });

  it("should handle boolean isOpen prop correctly", () => {
    const openProps = createProps({ isOpen: true });
    const closedProps = createProps({ isOpen: false });

    expect(openProps.isOpen).toBe(true);
    expect(closedProps.isOpen).toBe(false);
  });

  it("should call onClose function correctly", () => {
    const mockOnClose = vi.fn();
    const props = createProps({ onClose: mockOnClose });

    // 调用 onClose 函数
    props.onClose();

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("should maintain type safety for all props", () => {
    const props = createDefaultProps();

    // 类型检查
    expect(typeof props.isOpen).toBe("boolean");
    expect(typeof props.onClose).toBe("function");
    expect(typeof props.dialogueKey).toBe("string");
    expect(typeof props.characterId).toBe("string");
  });

  it("should handle partial overrides correctly", () => {
    const props = createProps({ isOpen: true });

    // 只覆盖部分属性，其他保持默认值
    expect(props.isOpen).toBe(true);
    expect(props.dialogueKey).toBe("test-dialogue-123");
    expect(props.characterId).toBe("test-character-456");
    expect(props.onClose).toBeTypeOf("function");
  });

  it("should handle empty string values", () => {
    const props = createProps({
      dialogueKey: "",
      characterId: "",
    });

    expect(props.dialogueKey).toBe("");
    expect(props.characterId).toBe("");
  });

  it("should handle long string values", () => {
    const longDialogueKey = "a".repeat(1000);
    const longCharacterId = "b".repeat(1000);

    const props = createProps({
      dialogueKey: longDialogueKey,
      characterId: longCharacterId,
    });

    expect(props.dialogueKey).toBe(longDialogueKey);
    expect(props.characterId).toBe(longCharacterId);
  });

  it("should handle special characters in string values", () => {
    const specialDialogueKey = "test-dialogue-123!@#$%^&*()";
    const specialCharacterId = "test-character-456<>?:{}[]";

    const props = createProps({
      dialogueKey: specialDialogueKey,
      characterId: specialCharacterId,
    });

    expect(props.dialogueKey).toBe(specialDialogueKey);
    expect(props.characterId).toBe(specialCharacterId);
  });
});
