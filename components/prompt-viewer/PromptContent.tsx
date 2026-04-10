/**
 * @input  @/components, @/lib
 * @output PromptContent, PromptContent
 * @pos    提示词查看器组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                        提示词内容显示组件                                  ║
 * ║                                                                           ║
 * ║  核心功能：文本渲染、搜索高亮、折叠展开、图片画廊                           ║
 * ║  设计原则：消除特殊情况、统一处理逻辑、保持简洁实用                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import ImageGallery from "./ImageGallery";
import PromptViewerErrorBoundary, { safeExecute } from "./PromptViewerErrorBoundary";
import type {
  PromptContentProps,
  CollapsibleRegion,
} from "@/types/prompt-viewer";
import {
  CSS_CLASSES,
  truncateContent,
  isContentTooLarge,
} from "@/lib/prompt-viewer/constants";
import {
  ContentDisplay,
  MessageCardList,
  EmptyContent,
  buildContentSections,
} from "./PromptContentParts";

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

export function PromptContent({
  messages,
  content,
  searchResult,
  expandedRegions,
  onToggleRegion,
  expandedMessages,
  onToggleMessage,
  images = [],
  imageGalleryExpanded = false,
  onToggleImageGallery,
}: PromptContentProps) {
  // ========== 内容处理（用于搜索和旧版显示） ==========

  const processedContent = useMemo(() => {
    return safeExecute(() => {
      if (!content) return "";

      // 处理过大内容
      const safeContent = isContentTooLarge(content)
        ? truncateContent(content)
        : content;

      // 如果没有搜索结果，直接返回原始内容
      if (!searchResult || !searchResult.hasMatches) {
        return safeContent;
      }

      // 应用搜索结果和折叠状态
      return applySearchAndCollapse(
        safeContent,
        searchResult,
        expandedRegions,
      );
    }, "", "PromptContent.processedContent");
  }, [content, searchResult, expandedRegions]);

  // ========== 渲染 ==========

  // 空内容检查
  if (!content && (!messages || messages.length === 0)) {
    return (
      <EmptyContent message="暂无提示词内容" />
    );
  }

  return (
    <div className={cn(CSS_CLASSES.VIEWER_CONTENT, "space-y-4")}>
      {/* 消息卡片列表（新版UI）- 使用错误边界保护 */}
      <PromptViewerErrorBoundary
        onError={(error) => {
          console.error("[PromptContent] 内容显示错误:", error);
        }}
        maxRetries={2}
      >
        {messages && messages.length > 0 ? (
          <MessageCardList
            messages={messages}
            expandedMessages={expandedMessages}
            onToggleMessage={onToggleMessage}
            searchResult={searchResult}
          />
        ) : (
          <ContentDisplay
            content={processedContent}
            searchResult={searchResult}
            expandedRegions={expandedRegions}
            onToggleRegion={onToggleRegion}
          />
        )}
      </PromptViewerErrorBoundary>

      {/* 图片画廊 - 使用错误边界保护 */}
      {images.length > 0 && onToggleImageGallery && (
        <PromptViewerErrorBoundary
          onError={(error) => {
            console.error("[PromptContent] 图片画廊错误:", error);
          }}
          maxRetries={1}
          fallback={
            <div className="text-center text-muted-foreground py-4">
              图片加载失败，但不影响文本内容查看
            </div>
          }
        >
          <ImageGallery
            images={images}
            isExpanded={imageGalleryExpanded}
            onToggleExpanded={onToggleImageGallery}
          />
        </PromptViewerErrorBoundary>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   工具函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 应用搜索结果和折叠状态到内容
 */
function applySearchAndCollapse(
  content: string,
  searchResult: NonNullable<PromptContentProps["searchResult"]>,
  expandedRegions: ReadonlySet<string>,
): string {
  // 如果没有折叠区域，直接返回高亮内容
  if (!searchResult.collapsibleRegions || searchResult.collapsibleRegions.length === 0) {
    return searchResult.highlightedContent || content;
  }

  // 构建内容段落并应用折叠状态
  const sections = buildContentSections(content, searchResult.collapsibleRegions);
  const processedSections = sections.map(section => {
    if (section.type === "collapsible" && section.id && !expandedRegions.has(section.id)) {
      return `[已折叠 ${section.lineCount} 行内容]`;
    }
    return section.content;
  });

  const finalContent = processedSections.join("\n");

  // 重新应用高亮到最终内容
  if (searchResult.matches && searchResult.matches.length > 0) {
    try {
      // 这里简化处理，直接返回内容
      // 实际的高亮会在 ContentText 组件中处理
      return finalContent;
    } catch (error) {
      console.error("[PromptContent] 高亮应用失败:", error);
      return finalContent;
    }
  }

  return finalContent;
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出
   ═══════════════════════════════════════════════════════════════════════════ */

export default PromptContent;
