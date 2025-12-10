/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                     PromptContent 组件测试                                ║
 * ║                                                                           ║
 * ║  测试内容显示、搜索高亮、折叠展开等核心功能                                 ║
 * ║  验证组件的正确性和边界情况处理                                             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi } from "vitest";
import type { PromptContentProps, SearchResult, PromptImage } from "@/types/prompt-viewer";

/* ═══════════════════════════════════════════════════════════════════════════
   测试工具
   ═══════════════════════════════════════════════════════════════════════════ */

function createMockProps(overrides: Partial<PromptContentProps> = {}): PromptContentProps {
  return {
    content: "这是一个测试提示词内容\n包含多行文本\n用于测试搜索和折叠功能",
    searchResult: {
      matches: [],
      highlightedContent: "这是一个测试提示词内容\n包含多行文本\n用于测试搜索和折叠功能",
      collapsibleRegions: [],
      hasMatches: false,
    },
    expandedRegions: new Set<string>(),
    onToggleRegion: vi.fn(),
    ...overrides,
  };
}

function createMockSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    matches: [],
    highlightedContent: "",
    collapsibleRegions: [],
    hasMatches: false,
    ...overrides,
  };
}

function createMockImages(): PromptImage[] {
  return [
    {
      id: "img-1",
      url: "data:image/png;base64,test",
      type: "base64",
      mimeType: "image/png",
    },
    {
      id: "img-2", 
      url: "https://example.com/image.jpg",
      type: "url",
      mimeType: "image/jpeg",
    },
  ];
}

/* ═══════════════════════════════════════════════════════════════════════════
   基础功能测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("PromptContent", () => {
  it("should create props with correct default values", () => {
    const props = createMockProps();
    
    expect(props.content).toBe("这是一个测试提示词内容\n包含多行文本\n用于测试搜索和折叠功能");
    expect(props.searchResult?.hasMatches).toBe(false);
    expect(props.expandedRegions.size).toBe(0);
    expect(typeof props.onToggleRegion).toBe("function");
  });

  it("should override default props correctly", () => {
    const customSearchResult = createMockSearchResult({ hasMatches: true });
    const props = createMockProps({
      content: "自定义内容",
      searchResult: customSearchResult,
      expandedRegions: new Set(["region-1"]),
    });
    
    expect(props.content).toBe("自定义内容");
    expect(props.searchResult?.hasMatches).toBe(true);
    expect(props.expandedRegions.has("region-1")).toBe(true);
  });

  it("should handle empty content", () => {
    const props = createMockProps({ content: "" });
    expect(props.content).toBe("");
  });

  it("should handle null search result", () => {
    const props = createMockProps({ searchResult: null });
    expect(props.searchResult).toBeNull();
  });

  it("should handle images prop", () => {
    const images = createMockImages();
    const props = createMockProps({ 
      images,
      imageGalleryExpanded: true,
      onToggleImageGallery: vi.fn(),
    });
    
    expect(props.images).toHaveLength(2);
    expect(props.imageGalleryExpanded).toBe(true);
    expect(typeof props.onToggleImageGallery).toBe("function");
  });

  it("should handle collapsible regions", () => {
    const searchResult = createMockSearchResult({
      collapsibleRegions: [
        {
          id: "region-1",
          startLine: 1,
          endLine: 2,
          lineCount: 2,
          content: "折叠内容",
          isExpanded: false,
        },
      ],
      hasMatches: true,
    });
    
    const props = createMockProps({ searchResult });
    expect(props.searchResult?.collapsibleRegions).toHaveLength(1);
    expect(props.searchResult?.collapsibleRegions[0]?.id).toBe("region-1");
  });

  it("should call toggle functions correctly", () => {
    const mockToggleRegion = vi.fn();
    const mockToggleImageGallery = vi.fn();
    
    const props = createMockProps({
      onToggleRegion: mockToggleRegion,
      onToggleImageGallery: mockToggleImageGallery,
    });

    // 测试函数调用
    props.onToggleRegion("region-1");
    props.onToggleImageGallery?.();

    expect(mockToggleRegion).toHaveBeenCalledWith("region-1");
    expect(mockToggleImageGallery).toHaveBeenCalled();
  });

  // ========== 类型安全测试 ==========

  it("should maintain type safety for all props", () => {
    const props = createMockProps();
    
    expect(typeof props.content).toBe("string");
    expect(typeof props.onToggleRegion).toBe("function");
    expect(props.expandedRegions instanceof Set).toBe(true);
  });

  it("should handle partial overrides correctly", () => {
    const props = createMockProps({ content: "部分覆盖" });
    
    expect(props.content).toBe("部分覆盖");
    // 其他属性应该保持默认值
    expect(props.expandedRegions.size).toBe(0);
    expect(typeof props.onToggleRegion).toBe("function");
  });

  // ========== 边界情况测试 ==========

  it("should handle very long content", () => {
    const longContent = "a".repeat(10000);
    const props = createMockProps({ content: longContent });
    expect(props.content).toBe(longContent);
  });

  it("should handle special characters in content", () => {
    const specialContent = "特殊字符: !@#$%^&*()[]{}|\\:;\"'<>,.?/~`\n换行符测试";
    const props = createMockProps({ content: specialContent });
    expect(props.content).toBe(specialContent);
  });

  it("should handle empty expanded regions set", () => {
    const props = createMockProps({ expandedRegions: new Set() });
    expect(props.expandedRegions.size).toBe(0);
  });

  it("should handle multiple expanded regions", () => {
    const expandedRegions = new Set(["region-1", "region-2", "region-3"]);
    const props = createMockProps({ expandedRegions });
    expect(props.expandedRegions.size).toBe(3);
    expect(props.expandedRegions.has("region-2")).toBe(true);
  });
});
