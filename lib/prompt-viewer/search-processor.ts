/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     搜索处理器实现                                          ║
 * ║                                                                            ║
 * ║  纯函数式搜索逻辑：文本匹配、高亮渲染、折叠区域计算                          ║
 * ║  设计原则：无副作用、可测试、高性能                                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  SearchProcessor,
  SearchState,
  SearchResult,
  CollapsibleRegion,
} from "@/types/prompt-viewer";
import {
  SEARCH_CONFIG,
  CSS_CLASSES,
  UI_CONFIG,
  generateId,
  createEmptySearchResult,
} from "@/lib/prompt-viewer/constants";

/* ═══════════════════════════════════════════════════════════════════════════
   搜索处理器实现
   ═══════════════════════════════════════════════════════════════════════════ */

export class SearchProcessorImpl implements SearchProcessor {
  /**
   * 处理搜索查询，返回完整结果
   */
  processSearch(content: string, searchState: SearchState): SearchResult {
    // 空查询或无效查询返回空结果
    if (!searchState.query.trim() || !searchState.isValid || !searchState.regex) {
      return {
        ...createEmptySearchResult(),
        highlightedContent: content,
      };
    }

    try {
      const matches = Array.from(content.matchAll(searchState.regex));
      
      if (matches.length === 0) {
        return {
          ...createEmptySearchResult(),
          highlightedContent: content,
        };
      }

      const highlightedContent = this.highlightMatches(content, searchState.regex);
      const collapsibleRegions = searchState.matchedOnly
        ? this.calculateCollapsibleRegions(content, matches, SEARCH_CONFIG.CONTEXT_LINES)
        : [];

      return {
        matches,
        highlightedContent,
        collapsibleRegions,
        hasMatches: true,
      };
    } catch (error) {
      console.error("[SearchProcessor] 搜索处理失败:", error);
      return createEmptySearchResult();
    }
  }

  /**
   * 创建搜索状态
   */
  createSearchState(query: string, matchedOnly: boolean): SearchState {
    let regex: RegExp | null = null;
    let isValid = true;
    
    if (query.trim()) {
      try {
        // 转义特殊字符，创建安全的正则表达式
        const escapedQuery = this.escapeRegExp(query);
        regex = new RegExp(escapedQuery, SEARCH_CONFIG.REGEX_FLAGS);
      } catch (error) {
        console.warn("[SearchProcessor] 正则表达式创建失败:", error);
        isValid = false;
      }
    }

    return {
      query,
      regex,
      matchedOnly,
      isValid,
    };
  }

  /**
   * 高亮匹配文本
   */
  highlightMatches(content: string, regex: RegExp): string {
    if (!regex) return content;

    try {
      return content.replace(regex, (match) => {
        // 转义 HTML 特殊字符
        const escapedMatch = this.escapeHtml(match);
        return `<span class="${CSS_CLASSES.HIGHLIGHT_MATCH}">${escapedMatch}</span>`;
      });
    } catch (error) {
      console.error("[SearchProcessor] 高亮处理失败:", error);
      return content;
    }
  }

  /**
   * 计算折叠区域
   */
  calculateCollapsibleRegions(
    content: string,
    matches: readonly RegExpMatchArray[],
    contextLines: number,
  ): readonly CollapsibleRegion[] {
    if (matches.length === 0) {
      return [];
    }

    const lines = content.split("\n");
    const matchLines = new Set<number>();

    // 收集所有匹配行及其上下文行
    for (const match of matches) {
      if (match.index === undefined) continue;

      const beforeMatch = content.substring(0, match.index);
      const matchLineIndex = beforeMatch.split("\n").length - 1;

      // 添加匹配行及其上下文
      for (let i = Math.max(0, matchLineIndex - contextLines); 
        i <= Math.min(lines.length - 1, matchLineIndex + contextLines); 
        i++) {
        matchLines.add(i);
      }
    }

    // 计算需要折叠的区域
    const collapsibleRegions: CollapsibleRegion[] = [];
    let regionStart = -1;

    for (let i = 0; i < lines.length; i++) {
      if (!matchLines.has(i)) {
        // 开始一个新的折叠区域
        if (regionStart === -1) {
          regionStart = i;
        }
      } else {
        // 结束当前折叠区域
        if (regionStart !== -1) {
          const regionEnd = i - 1;
          const lineCount = regionEnd - regionStart + 1;

          // 只有足够长的区域才值得折叠
          if (lineCount >= UI_CONFIG.MIN_COLLAPSIBLE_LINES) {
            collapsibleRegions.push({
              id: generateId("region"),
              startLine: regionStart,
              endLine: regionEnd,
              lineCount,
              content: lines.slice(regionStart, regionEnd + 1).join("\n"),
              isExpanded: false,
            });
          }

          regionStart = -1;
        }
      }
    }

    // 处理最后一个区域
    if (regionStart !== -1) {
      const regionEnd = lines.length - 1;
      const lineCount = regionEnd - regionStart + 1;

      if (lineCount >= UI_CONFIG.MIN_COLLAPSIBLE_LINES) {
        collapsibleRegions.push({
          id: generateId("region"),
          startLine: regionStart,
          endLine: regionEnd,
          lineCount,
          content: lines.slice(regionStart, regionEnd + 1).join("\n"),
          isExpanded: false,
        });
      }
    }

    return collapsibleRegions;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     私有工具方法
     ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * 转义 HTML 特殊字符
   */
  private escapeHtml(text: string): string {
    // 检查是否在浏览器环境
    if (typeof document !== "undefined") {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }
    
    // 服务器端环境的简单转义
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出单例实例
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 搜索处理器单例
 * 无状态服务，可以安全地共享实例
 */
export const searchProcessor = new SearchProcessorImpl();

/* ═══════════════════════════════════════════════════════════════════════════
   工具函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 渲染折叠区域为 HTML
 */
export function renderCollapsibleRegion(
  region: CollapsibleRegion,
  isExpanded: boolean,
  onToggle: (regionId: string) => void,
): string {
  const buttonClass = `${CSS_CLASSES.COLLAPSIBLE_BUTTON} ${
    isExpanded ? CSS_CLASSES.COLLAPSIBLE_EXPANDED : ""
  }`;

  if (isExpanded) {
    return `
      <div class="${CSS_CLASSES.COLLAPSIBLE_REGION} ${CSS_CLASSES.COLLAPSIBLE_EXPANDED}">
        <button class="${buttonClass}" onclick="toggleRegion('${region.id}')">
          收起 ${region.lineCount} 行
        </button>
        <div class="${CSS_CLASSES.COLLAPSIBLE_CONTENT}">
          ${region.content}
        </div>
      </div>
    `;
  } else {
    return `
      <div class="${CSS_CLASSES.COLLAPSIBLE_REGION}">
        <button class="${buttonClass}" onclick="toggleRegion('${region.id}')">
          展开 ${region.lineCount} 行隐藏内容
        </button>
      </div>
    `;
  }
}

/**
 * 应用搜索结果到内容
 * 将搜索结果和折叠状态应用到原始内容上
 */
export function applySearchResult(
  originalContent: string,
  searchResult: SearchResult,
  expandedRegions: ReadonlySet<string>,
): string {
  if (!searchResult.hasMatches) {
    return searchResult.highlightedContent || originalContent;
  }

  let result = searchResult.highlightedContent;

  // 如果没有折叠区域，直接返回高亮内容
  if (searchResult.collapsibleRegions.length === 0) {
    return result;
  }

  // 应用折叠区域
  const lines = originalContent.split("\n");
  const processedLines: string[] = [];
  let currentLine = 0;

  for (const region of searchResult.collapsibleRegions) {
    // 添加折叠区域之前的内容
    while (currentLine < region.startLine) {
      processedLines.push(lines[currentLine]);
      currentLine++;
    }

    // 添加折叠区域
    const isExpanded = expandedRegions.has(region.id);
    if (isExpanded) {
      // 展开状态：显示所有内容
      for (let i = region.startLine; i <= region.endLine; i++) {
        processedLines.push(lines[i]);
      }
    } else {
      // 折叠状态：显示折叠按钮
      processedLines.push(`[折叠 ${region.lineCount} 行内容]`);
    }

    currentLine = region.endLine + 1;
  }

  // 添加剩余内容
  while (currentLine < lines.length) {
    processedLines.push(lines[currentLine]);
    currentLine++;
  }

  // 重新应用高亮
  const finalContent = processedLines.join("\n");
  if (searchResult.matches.length > 0 && searchResult.matches[0]) {
    // 创建新的搜索状态来重新高亮
    const searchState = searchProcessor.createSearchState(searchResult.matches[0][0], false);
    if (searchState.regex) {
      return searchProcessor.highlightMatches(finalContent, searchState.regex);
    }
  }
  return finalContent;
}
