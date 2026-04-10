/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    提示词内容子组件                                        ║
 * ║                                                                           ║
 * ║  从 PromptContent.tsx 拆分而来                                            ║
 * ║  包含：内容显示、折叠区域、文本渲染、消息卡片                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useMemo, useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  PromptContentProps,
  CollapsibleRegion,
  PromptMessage,
} from "@/types/prompt-viewer";
import { CSS_CLASSES } from "@/lib/prompt-viewer/constants";

/* ═══════════════════════════════════════════════════════════════════════════
   内容显示组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface ContentDisplayProps {
  content: string;
  searchResult: PromptContentProps["searchResult"];
  expandedRegions: ReadonlySet<string>;
  onToggleRegion: (regionId: string) => void;
}

export function ContentDisplay({
  content,
  searchResult,
  expandedRegions,
  onToggleRegion,
}: ContentDisplayProps) {
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

function CollapsibleContent({
  content,
  searchResult,
  expandedRegions,
  onToggleRegion,
}: {
  content: string;
  searchResult: NonNullable<PromptContentProps["searchResult"]>;
  expandedRegions: ReadonlySet<string>;
  onToggleRegion: (regionId: string) => void;
}) {
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

function ContentSection({ section, isExpanded, onToggle }: {
  section: ContentSectionData;
  isExpanded: boolean;
  onToggle?: () => void;
}) {
  if (section.type === "visible") {
    return (
      <div className="p-4 border-b border-border/50 last:border-b-0">
        <ContentText content={section.content} />
      </div>
    );
  }

  return (
    <div className={cn(
      CSS_CLASSES.COLLAPSIBLE_REGION,
      "border-b border-border/50 last:border-b-0",
    )}>
      <CollapsibleButton
        isExpanded={isExpanded}
        lineCount={section.lineCount || 0}
        onClick={onToggle}
      />
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

function CollapsibleButton({ isExpanded, lineCount, onClick }: {
  isExpanded: boolean;
  lineCount: number;
  onClick?: () => void;
}) {
  const handleClick = useCallback(() => { onClick?.(); }, [onClick]);

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
      {isExpanded
        ? <ChevronDown className="h-4 w-4 shrink-0" />
        : <ChevronRight className="h-4 w-4 shrink-0" />
      }
      <span className="text-sm">
        {isExpanded ? `收起 ${lineCount} 行内容` : `展开 ${lineCount} 行隐藏内容`}
      </span>
    </Button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   文本内容组件
   ═══════════════════════════════════════════════════════════════════════════ */

export function ContentText({ content }: { content: string }) {
  const hasHighlight = content.includes(`<span class="${CSS_CLASSES.HIGHLIGHT_MATCH}">`);

  if (hasHighlight) {
    return (
      <div
        className={cn(
          "font-mono text-sm leading-relaxed",
          "text-cream whitespace-pre-wrap wrap-break-word",
          `[&_.${CSS_CLASSES.HIGHLIGHT_MATCH}]:bg-primary-900/30`,
          `[&_.${CSS_CLASSES.HIGHLIGHT_MATCH}]:text-primary-300`,
          `[&_.${CSS_CLASSES.HIGHLIGHT_MATCH}]:px-1`,
          `[&_.${CSS_CLASSES.HIGHLIGHT_MATCH}]:rounded`,
        )}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

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

export function EmptyContent({ message }: { message: string }) {
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
   消息卡片列表组件
   ═══════════════════════════════════════════════════════════════════════════ */

export function MessageCardList({
  messages,
  expandedMessages: externalExpandedMessages,
  onToggleMessage: externalOnToggleMessage,
  searchResult,
}: {
  messages: readonly PromptMessage[];
  expandedMessages?: ReadonlySet<string>;
  onToggleMessage?: (messageId: string) => void;
  searchResult: PromptContentProps["searchResult"];
}) {
  const [internalExpandedMessages, setInternalExpandedMessages] = useState<Set<string>>(() => {
    return new Set(messages.map(m => m.id));
  });

  const expandedMessages = externalExpandedMessages ?? internalExpandedMessages;

  const handleToggleMessage = useCallback((messageId: string) => {
    if (externalOnToggleMessage) {
      externalOnToggleMessage(messageId);
    } else {
      setInternalExpandedMessages(prev => {
        const next = new Set(prev);
        if (next.has(messageId)) { next.delete(messageId); } else { next.add(messageId); }
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

const ROLE_LABELS: Record<PromptMessage["role"], string> = {
  system: "系统消息 (System)",
  user: "用户消息 (User)",
  assistant: "助手消息 (Assistant)",
};

const ROLE_COLORS: Record<PromptMessage["role"], string> = {
  system: "bg-blue-500/10 border-blue-500/30 text-blue-400",
  user: "bg-green-500/10 border-green-500/30 text-green-400",
  assistant: "bg-purple-500/10 border-purple-500/30 text-purple-400",
};

function MessageCard({ message, isExpanded, onToggle, searchResult }: {
  message: PromptMessage;
  isExpanded: boolean;
  onToggle: () => void;
  searchResult: PromptContentProps["searchResult"];
}) {
  const displayContent = useMemo(() => {
    if (!searchResult?.hasMatches || !searchResult.highlightedContent) {
      return message.content;
    }
    return message.content;
  }, [message.content, searchResult]);

  const colors = ROLE_COLORS[message.role].split(" ");

  return (
    <div className={cn("border rounded-lg overflow-hidden", "bg-overlay", colors[1])}>
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between p-3",
          "hover:bg-muted/30 transition-colors duration-200",
          colors[0],
        )}
      >
        <span className={cn("font-medium text-sm", colors[2])}>
          {ROLE_LABELS[message.role]}
        </span>
        <span className="text-muted-foreground">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      {isExpanded && (
        <div className={cn(
          "p-4 border-t", colors[1],
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
   工具函数与共享类型
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ContentSectionData {
  id?: string;
  type: "visible" | "collapsible";
  content: string;
  lineCount?: number;
}

/**
 * 构建内容段落
 */
export function buildContentSections(
  content: string,
  collapsibleRegions: readonly CollapsibleRegion[],
): ContentSectionData[] {
  if (!collapsibleRegions || collapsibleRegions.length === 0) {
    return [{ type: "visible", content }];
  }

  const lines = content.split("\n");
  const sections: ContentSectionData[] = [];
  let currentLine = 0;

  const sortedRegions = [...collapsibleRegions].sort((a, b) => a.startLine - b.startLine);

  for (const region of sortedRegions) {
    if (currentLine < region.startLine) {
      const visibleContent = lines.slice(currentLine, region.startLine).join("\n");
      if (visibleContent.trim()) {
        sections.push({ type: "visible", content: visibleContent });
      }
    }

    sections.push({
      id: region.id,
      type: "collapsible",
      content: region.content,
      lineCount: region.lineCount,
    });

    currentLine = region.endLine + 1;
  }

  if (currentLine < lines.length) {
    const remainingContent = lines.slice(currentLine).join("\n");
    if (remainingContent.trim()) {
      sections.push({ type: "visible", content: remainingContent });
    }
  }

  return sections;
}
