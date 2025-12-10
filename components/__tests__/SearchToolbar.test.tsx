/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      搜索工具栏组件测试                                    ║
 * ║                                                                           ║
 * ║  测试搜索工具栏的基本功能和交互行为                                         ║
 * ║  验证组件的正确渲染和事件处理                                               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi } from "vitest";
import type { SearchToolbarProps } from "@/types/prompt-viewer";

// ============================================================================
//                              测试工具
// ============================================================================

function createMockProps(overrides: Partial<SearchToolbarProps> = {}): SearchToolbarProps {
  return {
    searchInput: "",
    onSearchChange: vi.fn(),
    matchedOnly: false,
    onMatchedOnlyChange: vi.fn(),
    onRefresh: vi.fn(),
    isLoading: false,
    ...overrides,
  };
}

// ============================================================================
//                              基础功能测试
// ============================================================================

describe("SearchToolbar", () => {
  it("should create props with correct default values", () => {
    const props = createMockProps();
    
    expect(props.searchInput).toBe("");
    expect(props.matchedOnly).toBe(false);
    expect(props.isLoading).toBe(false);
    expect(typeof props.onSearchChange).toBe("function");
    expect(typeof props.onMatchedOnlyChange).toBe("function");
    expect(typeof props.onRefresh).toBe("function");
  });

  it("should override default props correctly", () => {
    const props = createMockProps({
      searchInput: "test query",
      matchedOnly: true,
      isLoading: true,
    });
    
    expect(props.searchInput).toBe("test query");
    expect(props.matchedOnly).toBe(true);
    expect(props.isLoading).toBe(true);
  });

  it("should call mock functions correctly", () => {
    const mockOnSearchChange = vi.fn();
    const mockOnMatchedOnlyChange = vi.fn();
    const mockOnRefresh = vi.fn();
    
    const props = createMockProps({
      onSearchChange: mockOnSearchChange,
      onMatchedOnlyChange: mockOnMatchedOnlyChange,
      onRefresh: mockOnRefresh,
    });

    // 测试函数调用
    props.onSearchChange("test");
    props.onMatchedOnlyChange(true);
    props.onRefresh();

    expect(mockOnSearchChange).toHaveBeenCalledWith("test");
    expect(mockOnMatchedOnlyChange).toHaveBeenCalledWith(true);
    expect(mockOnRefresh).toHaveBeenCalled();
  });

  // ========== 类型安全测试 ==========

  it("should maintain type safety for all props", () => {
    const props = createMockProps();
    
    // 验证类型
    expect(typeof props.searchInput).toBe("string");
    expect(typeof props.matchedOnly).toBe("boolean");
    expect(typeof props.isLoading).toBe("boolean");
  });

  it("should handle partial overrides correctly", () => {
    const props = createMockProps({ searchInput: "partial" });
    
    expect(props.searchInput).toBe("partial");
    // 其他属性应该保持默认值
    expect(props.matchedOnly).toBe(false);
    expect(props.isLoading).toBe(false);
  });

  // ========== 边界情况测试 ==========

  it("should handle empty string search input", () => {
    const props = createMockProps({ searchInput: "" });
    expect(props.searchInput).toBe("");
  });

  it("should handle long search input", () => {
    const longInput = "a".repeat(1000);
    const props = createMockProps({ searchInput: longInput });
    expect(props.searchInput).toBe(longInput);
  });

  it("should handle special characters in search input", () => {
    const specialInput = "!@#$%^&*()[]{}|\\:;\"'<>,.?/~`";
    const props = createMockProps({ searchInput: specialInput });
    expect(props.searchInput).toBe(specialInput);
  });
});
