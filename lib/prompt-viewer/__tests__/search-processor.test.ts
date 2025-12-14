/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     搜索处理器测试                                          ║
 * ║                                                                            ║
 * ║  测试搜索功能、高亮渲染、折叠区域计算的正确性                                ║
 * ║  覆盖边界情况和错误处理                                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SearchProcessorImpl, searchProcessor } from "../search-processor";
import type { SearchState } from "../../../types/prompt-viewer";

describe("SearchProcessor", () => {
  let processor: SearchProcessorImpl;

  beforeEach(() => {
    processor = new SearchProcessorImpl();
  });

  describe("createSearchState", () => {
    it("应该创建有效的搜索状态", () => {
      const state = processor.createSearchState("test", false);
      
      expect(state.query).toBe("test");
      expect(state.matchedOnly).toBe(false);
      expect(state.isValid).toBe(true);
      expect(state.regex).toBeInstanceOf(RegExp);
    });

    it("应该处理空查询", () => {
      const state = processor.createSearchState("", false);
      
      expect(state.query).toBe("");
      expect(state.isValid).toBe(true);
      expect(state.regex).toBeNull();
    });

    it("应该处理仅包含空格的查询", () => {
      const state = processor.createSearchState("   ", true);
      
      expect(state.query).toBe("   ");
      expect(state.isValid).toBe(true);
      expect(state.regex).toBeNull();
    });

    it("应该转义正则表达式特殊字符", () => {
      const state = processor.createSearchState("test.*+?", false);
      
      expect(state.isValid).toBe(true);
      expect(state.regex).toBeInstanceOf(RegExp);
      
      // 测试转义是否正确
      const testString = "test.*+? and test123";
      const matches = testString.match(state.regex!);
      expect(matches).toHaveLength(1);
      expect(matches![0]).toBe("test.*+?");
    });
  });

  describe("highlightMatches", () => {
    it("应该高亮匹配的文本", () => {
      const content = "Hello world, this is a test world";
      const regex = /world/gi;
      
      const result = processor.highlightMatches(content, regex);
      
      expect(result).toContain("<span class=\"prompt-viewer-highlight-match\">world</span>");
      // 应该高亮两个 "world"
      const matches = result.match(/<span class="prompt-viewer-highlight-match">world<\/span>/g);
      expect(matches).toHaveLength(2);
    });

    it("应该转义 HTML 特殊字符", () => {
      const content = "Test <script>alert('xss')</script> content";
      const regex = /<script>/gi;
      
      const result = processor.highlightMatches(content, regex);
      
      expect(result).toContain("&lt;script&gt;");
      expect(result).not.toContain("<script>");
    });

    it("应该处理空正则表达式", () => {
      const content = "Test content";
      
      const result = processor.highlightMatches(content, null as unknown);
      
      expect(result).toBe(content);
    });

    it("应该处理正则表达式错误", () => {
      const content = "Test content";
      // 创建一个会导致错误的正则表达式对象
      const invalidRegex = {
        [Symbol.replace]: () => {
          throw new Error("Regex error");
        },
      } as unknown;
      
      const result = processor.highlightMatches(content, invalidRegex);
      
      // 应该返回原始内容而不是抛出错误
      expect(result).toBe(content);
    });
  });

  describe("calculateCollapsibleRegions", () => {
    it("应该计算简单的折叠区域", () => {
      const content = [
        "line 1",
        "line 2", 
        "line 3",
        "line 4",
        "line 5 match",
        "line 6",
        "line 7",
        "line 8",
        "line 9",
      ].join("\n");
      
      const matches = Array.from(content.matchAll(/match/g));
      const regions = processor.calculateCollapsibleRegions(content, matches, 1);
      
      expect(regions).toHaveLength(2);
      
      // 第一个区域：line 1-3 (在匹配前，不包括上下文)
      expect(regions[0].startLine).toBe(0);
      expect(regions[0].endLine).toBe(2);
      expect(regions[0].lineCount).toBe(3);
      
      // 第二个区域：line 7-9 (在匹配后，不包括上下文)
      expect(regions[1].startLine).toBe(6);
      expect(regions[1].endLine).toBe(8);
      expect(regions[1].lineCount).toBe(3);
    });

    it("应该忽略太短的区域", () => {
      const content = [
        "line 1",
        "line 2 match",
        "line 3",
        "line 4 match",
      ].join("\n");
      
      const matches = Array.from(content.matchAll(/match/g));
      const regions = processor.calculateCollapsibleRegions(content, matches, 0);
      
      // line 3 只有1行，小于最小折叠行数(3)，应该被忽略
      expect(regions).toHaveLength(0);
    });

    it("应该处理没有匹配的情况", () => {
      const content = "line 1\nline 2\nline 3";
      const matches: RegExpMatchArray[] = [];
      
      const regions = processor.calculateCollapsibleRegions(content, matches, 1);
      
      expect(regions).toHaveLength(0);
    });

    it("应该处理上下文行重叠的情况", () => {
      const content = [
        "line 1",
        "line 2 match",
        "line 3",
        "line 4 match", 
        "line 5",
      ].join("\n");
      
      const matches = Array.from(content.matchAll(/match/g));
      const regions = processor.calculateCollapsibleRegions(content, matches, 2);
      
      // 由于上下文重叠，不应该有折叠区域
      expect(regions).toHaveLength(0);
    });
  });

  describe("processSearch", () => {
    it("应该处理完整的搜索流程", () => {
      // 创建足够长的内容，确保有可折叠的区域
      const content = [
        "This is line 1",
        "This is line 2", 
        "This is line 3",
        "This is line 4",
        "This is line 5",
        "This contains test word", // 第6行有匹配
        "This is line 7",
        "This is line 8",
        "This is line 9",
        "This is line 10",
        "This is line 11",
        "This is line 12",
        "Another test here", // 第13行有匹配
        "This is line 14",
        "This is line 15",
        "This is line 16",
      ].join("\n");
      
      const searchState = processor.createSearchState("test", true);
      const result = processor.processSearch(content, searchState);
      
      expect(result.hasMatches).toBe(true);
      expect(result.matches).toHaveLength(2);
      expect(result.highlightedContent).toContain("<span class=\"prompt-viewer-highlight-match\">test</span>");
      // 现在应该有折叠区域了
      expect(result.collapsibleRegions.length).toBeGreaterThan(0);
    });

    it("应该处理空查询", () => {
      const content = "Test content";
      const searchState = processor.createSearchState("", false);
      
      const result = processor.processSearch(content, searchState);
      
      expect(result.hasMatches).toBe(false);
      expect(result.matches).toHaveLength(0);
      expect(result.highlightedContent).toBe(content);
      expect(result.collapsibleRegions).toHaveLength(0);
    });

    it("应该处理无效的搜索状态", () => {
      const content = "Test content";
      const searchState: SearchState = {
        query: "test",
        regex: null,
        matchedOnly: false,
        isValid: false,
      };
      
      const result = processor.processSearch(content, searchState);
      
      expect(result.hasMatches).toBe(false);
      expect(result.highlightedContent).toBe(content);
    });

    it("应该处理搜索异常", () => {
      const content = "Test content";
      const searchState: SearchState = {
        query: "test",
        regex: {
          [Symbol.matchAll]: () => {
            throw new Error("Search error");
          },
        } as unknown,
        matchedOnly: false,
        isValid: true,
      };
      
      const result = processor.processSearch(content, searchState);
      
      // 应该返回空结果而不是抛出错误
      expect(result.hasMatches).toBe(false);
    });
  });

  describe("单例实例", () => {
    it("应该导出单例实例", () => {
      expect(searchProcessor).toBeInstanceOf(SearchProcessorImpl);
    });

    it("单例实例应该正常工作", () => {
      const state = searchProcessor.createSearchState("test", false);
      expect(state.isValid).toBe(true);
    });
  });

  describe("边界情况", () => {
    it("应该处理非常长的内容", () => {
      const longContent = "test ".repeat(10000);
      const searchState = searchProcessor.createSearchState("test", false);
      
      const result = searchProcessor.processSearch(longContent, searchState);
      
      expect(result.hasMatches).toBe(true);
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it("应该处理特殊字符", () => {
      const content = "测试内容 with émojis 🚀 and symbols @#$%";
      const searchState = searchProcessor.createSearchState("测试", false);
      
      const result = searchProcessor.processSearch(content, searchState);
      
      expect(result.hasMatches).toBe(true);
      expect(result.highlightedContent).toContain("测试");
    });

    it("应该处理多行匹配", () => {
      const content = "line 1\ntest\nline 3\ntest again\nline 5";
      const searchState = searchProcessor.createSearchState("test", true);
      
      const result = searchProcessor.processSearch(content, searchState);
      
      expect(result.hasMatches).toBe(true);
      expect(result.matches).toHaveLength(2);
    });
  });
});
