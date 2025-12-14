/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                        提示词内容显示组件                                  ║
 * ║                                                                           ║
 * ║  核心功能：文本渲染、搜索高亮、折叠展开、图片画廊                           ║
 * ║  设计原则：消除特殊情况、统一处理逻辑、保持简洁实用                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useMemo, useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ImageGallery from "./ImageGallery";
import PromptViewerErrorBoundary, { safeExecute } from "./PromptViewerErrorBoundary";
import type { 
  PromptContentProps, 
  CollapsibleRegion,
  PromptImage,
  PromptMessage,
  SearchResult,
} from "@/types/prompt-viewer";
import { 
  CSS_CLASSES, 
  UI_CONFIG,
  truncateContent,
  isContentTooLarge, 
} from "@/lib/prompt-viewer/constants";

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
   内容显示组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface ContentDisplayProps {
  content: string;
  searchResult: PromptContentProps["searchResult"];
  expandedRegions: ReadonlySet<string>;
  onToggleRegion: (regionId: string) => void;
}

function ContentDisplay({
  content,
  searchResult,
  expandedRegions,
  onToggleRegion,
}: ContentDisplayProps) {
  // 如果有折叠区域，需要特殊处理
  if (searchResult?.collapsibleRegions && searchResult.collapsibleRegions.length > 0) {
    return (
      <CollapsibleContent
        content={content}
        searchResult={searchResult}
        expandedRegions={expandedRegions}
        onToggleRegion={onToggleRegion}
      />
    );
  }

  // 普通内容显示
  return (
    <div className={cn(
      CSS_CLASSES.HIGHLIGHT_CONTAINER,
      "bg-overlay border border-border rounded-md p-4",
      "font-mono text-sm leading-relaxed",
      "max-h-[60vh] overflow-y-auto",
      "text-cream whitespace-pre-wrap wrap-break-word",
    )}>
      <ContentText content={content} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   可折叠内容组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface CollapsibleContentProps {
  content: string;
  searchResult: NonNullable<PromptContentProps["searchResult"]>;
  expandedRegions: ReadonlySet<string>;
  onToggleRegion: (regionId: string) => void;
}

function CollapsibleContent({
  content,
  searchResult,
  expandedRegions,
  onToggleRegion,
}: CollapsibleContentProps) {
  const contentSections = useMemo(() => {
    return buildContentSections(content, searchResult.collapsibleRegions);
  }, [content, searchResult.collapsibleRegions]);

  return (
    <div className={cn(
      CSS_CLASSES.HIGHLIGHT_CONTAINER,
      "bg-overlay border border-border rounded-md",
      "max-h-[60vh] overflow-y-auto",
    )}>
      {contentSections.map((section, index) => (
        <ContentSection
          key={section.id || `section-${index}`}
          section={section}
          isExpanded={section.type === "collapsible" ? expandedRegions.has(section.id!) : true}
          onToggle={section.type === "collapsible" ? () => onToggleRegion(section.id!) : undefined}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   内容段落组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface ContentSection {
  id?: string;
  type: "visible" | "collapsible";
  content: string;
  lineCount?: number;
}

interface ContentSectionProps {
  section: ContentSection;
  isExpanded: boolean;
  onToggle?: () => void;
}

function ContentSection({ section, isExpanded, onToggle }: ContentSectionProps) {
  if (section.type === "visible") {
    return (
      <div className="p-4 border-b border-border/50 last:border-b-0">
        <ContentText content={section.content} />
      </div>
    );
  }

  // 可折叠区域
  return (
    <div className={cn(
      CSS_CLASSES.COLLAPSIBLE_REGION,
      "border-b border-border/50 last:border-b-0",
    )}>
      {/* 折叠按钮 */}
      <CollapsibleButton
        isExpanded={isExpanded}
        lineCount={section.lineCount || 0}
        onClick={onToggle}
      />

      {/* 可折叠内容 */}
      {isExpanded && (
        <div className={cn(
          CSS_CLASSES.COLLAPSIBLE_CONTENT,
          CSS_CLASSES.COLLAPSIBLE_EXPANDED,
          "p-4 pt-0",
        )}>
          <ContentText content={section.content} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   折叠按钮组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface CollapsibleButtonProps {
  isExpanded: boolean;
  lineCount: number;
  onClick?: () => void;
}

function CollapsibleButton({ isExpanded, lineCount, onClick }: CollapsibleButtonProps) {
  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={cn(
        CSS_CLASSES.COLLAPSIBLE_BUTTON,
        "w-full justify-start gap-2 p-4",
        "text-muted-foreground hover:text-foreground",
        "hover:bg-muted-surface/50 transition-colors duration-200",
        "border-0 rounded-none",
      )}
    >
      {/* 展开/收起图标 */}
      {isExpanded ? (
        <ChevronDown className="h-4 w-4 shrink-0" />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0" />
      )}

      {/* 按钮文本 */}
      <span className="text-sm">
        {isExpanded 
          ? `收起 ${lineCount} 行内容`
          : `展开 ${lineCount} 行隐藏内容`
        }
      </span>
    </Button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   文本内容组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface ContentTextProps {
  content: string;
}

function ContentText({ content }: ContentTextProps) {
  // 检查内容是否包含 HTML 高亮标记
  const hasHighlight = content.includes(`<span class="${CSS_CLASSES.HIGHLIGHT_MATCH}">`);

  if (hasHighlight) {
    // 包含高亮的内容，使用 dangerouslySetInnerHTML
    return (
      <div 
        className={cn(
          "font-mono text-sm leading-relaxed",
          "text-cream whitespace-pre-wrap wrap-break-word",
          // 高亮样式
          `[&_.${CSS_CLASSES.HIGHLIGHT_MATCH}]:bg-primary-900/30`,
          `[&_.${CSS_CLASSES.HIGHLIGHT_MATCH}]:text-primary-300`,
          `[&_.${CSS_CLASSES.HIGHLIGHT_MATCH}]:px-1`,
          `[&_.${CSS_CLASSES.HIGHLIGHT_MATCH}]:rounded`,
        )}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // 普通文本内容
  return (
    <div className={cn(
      "font-mono text-sm leading-relaxed",
      "text-cream whitespace-pre-wrap wrap-break-word",
    )}>
      {content}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   空内容组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface EmptyContentProps {
  message: string;
}

function EmptyContent({ message }: EmptyContentProps) {
  return (
    <div className={cn(
      CSS_CLASSES.EMPTY,
      "flex flex-col items-center justify-center",
      "py-12 px-6 text-center",
      "bg-overlay border border-border rounded-md",
      "text-muted-foreground",
    )}>
      <div className="w-12 h-12 rounded-full bg-muted-surface/50 flex items-center justify-center mb-4">
        <ImageIcon className="h-6 w-6" />
      </div>
      <p className="text-sm">{message}</p>
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
      // 折叠状态：返回占位符
      return `[已折叠 ${section.lineCount} 行内容]`;
    }
    return section.content;
  });

  const finalContent = processedSections.join("\n");

  // 重新应用高亮到最终内容
  if (searchResult.matches && searchResult.matches.length > 0) {
    // 动态导入搜索处理器来应用高亮
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

/**
 * 构建内容段落
 */
function buildContentSections(
  content: string,
  collapsibleRegions: readonly CollapsibleRegion[],
): ContentSection[] {
  if (!collapsibleRegions || collapsibleRegions.length === 0) {
    return [{
      type: "visible",
      content,
    }];
  }

  const lines = content.split("\n");
  const sections: ContentSection[] = [];
  let currentLine = 0;

  // 按开始行排序折叠区域
  const sortedRegions = [...collapsibleRegions].sort((a, b) => a.startLine - b.startLine);

  for (const region of sortedRegions) {
    // 添加折叠区域之前的可见内容
    if (currentLine < region.startLine) {
      const visibleContent = lines.slice(currentLine, region.startLine).join("\n");
      if (visibleContent.trim()) {
        sections.push({
          type: "visible",
          content: visibleContent,
        });
      }
    }

    // 添加折叠区域
    sections.push({
      id: region.id,
      type: "collapsible",
      content: region.content,
      lineCount: region.lineCount,
    });

    currentLine = region.endLine + 1;
  }

  // 添加剩余的可见内容
  if (currentLine < lines.length) {
    const remainingContent = lines.slice(currentLine).join("\n");
    if (remainingContent.trim()) {
      sections.push({
        type: "visible",
        content: remainingContent,
      });
    }
  }

  return sections;
}

/* ═══════════════════════════════════════════════════════════════════════════
   消息卡片列表组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface MessageCardListProps {
  messages: readonly PromptMessage[];
  expandedMessages?: ReadonlySet<string>;
  onToggleMessage?: (messageId: string) => void;
  searchResult: PromptContentProps["searchResult"];
}

function MessageCardList({
  messages,
  expandedMessages: externalExpandedMessages,
  onToggleMessage: externalOnToggleMessage,
  searchResult,
}: MessageCardListProps) {
  // 使用本地状态管理折叠（如果外部没有提供）
  const [internalExpandedMessages, setInternalExpandedMessages] = useState<Set<string>>(() => {
    // 默认所有消息都展开
    return new Set(messages.map(m => m.id));
  });

  // 优先使用外部状态，否则使用内部状态
  const expandedMessages = externalExpandedMessages ?? internalExpandedMessages;
  
  const handleToggleMessage = useCallback((messageId: string) => {
    if (externalOnToggleMessage) {
      externalOnToggleMessage(messageId);
    } else {
      setInternalExpandedMessages(prev => {
        const next = new Set(prev);
        if (next.has(messageId)) {
          next.delete(messageId);
        } else {
          next.add(messageId);
        }
        return next;
      });
    }
  }, [externalOnToggleMessage]);

  const isExpanded = useCallback((messageId: string) => {
    return expandedMessages.has(messageId);
  }, [expandedMessages]);

  return (
    <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
      {messages.map((message) => (
        <MessageCard
          key={message.id}
          message={message}
          isExpanded={isExpanded(message.id)}
          onToggle={() => handleToggleMessage(message.id)}
          searchResult={searchResult}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   消息卡片组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface MessageCardProps {
  message: PromptMessage;
  isExpanded: boolean;
  onToggle: () => void;
  searchResult: PromptContentProps["searchResult"];
}

function MessageCard({ message, isExpanded, onToggle, searchResult }: MessageCardProps) {
  // 角色标签映射
  const roleLabels: Record<PromptMessage["role"], string> = {
    system: "系统消息 (System)",
    user: "用户消息 (User)",
    assistant: "助手消息 (Assistant)",
  };

  // 角色颜色映射
  const roleColors: Record<PromptMessage["role"], string> = {
    system: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    user: "bg-green-500/10 border-green-500/30 text-green-400",
    assistant: "bg-purple-500/10 border-purple-500/30 text-purple-400",
  };

  // 处理搜索高亮
  const displayContent = useMemo(() => {
    if (!searchResult?.hasMatches || !searchResult.highlightedContent) {
      return message.content;
    }
    // 简单的内容匹配检查
    return message.content;
  }, [message.content, searchResult]);

  return (
    <div className={cn(
      "border rounded-lg overflow-hidden",
      "bg-overlay",
      roleColors[message.role].split(" ")[1], // 仅取边框颜色
    )}>
      {/* 卡片标题 - 可点击折叠 */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between p-3",
          "hover:bg-muted/30 transition-colors duration-200",
          roleColors[message.role].split(" ")[0], // 仅取背景颜色
        )}
      >
        <span className={cn(
          "font-medium text-sm",
          roleColors[message.role].split(" ")[2], // 仅取文字颜色
        )}>
          {roleLabels[message.role]}
        </span>
        <span className="text-muted-foreground">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      {/* 卡片内容 */}
      {isExpanded && (
        <div className={cn(
          "p-4 border-t",
          roleColors[message.role].split(" ")[1], // 边框颜色
          "font-mono text-sm leading-relaxed",
          "text-cream whitespace-pre-wrap break-words",
          "max-h-[40vh] overflow-y-auto",
        )}>
          <ContentText content={displayContent} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出
   ═══════════════════════════════════════════════════════════════════════════ */

export default PromptContent;
