/**
 * @input  @/lib
 * @output MessageBubble
 * @pos    消息气泡展示组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MessageBubble 组件                                 ║
 * ║                                                                            ║
 * ║  职责：渲染聊天消息的 HTML 内容                                             ║
 * ║  架构：组合 HtmlSegment + RenderIntentView，不执行脚本                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useEffect, memo, useMemo } from "react";
import { RenderIntentView } from "@/components/story-agent/render-intent";
import { clearColorCache } from "@/lib/utils/html-tag-processor";
import { useMessageRenderPipeline } from "@/components/message-bubble/useMessageRenderPipeline";
import {
  cleanRenderIntentMatchValues,
  extractRenderIntentMatches,
  stripRenderIntentSources,
  type RenderIntent,
} from "@/lib/story-agent/render-intent";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface Props {
  html: string;
  characterId?: string;
  isLoading?: boolean;
  enableStreaming?: boolean;
  renderMode?: "story" | "legacy";
  renderIntents?: RenderIntent[];
  onAppendInput?: (value: string) => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

function MessageBubbleInner({
  html: rawHtml,
  characterId,
  isLoading = false,
  enableStreaming = false,
  renderMode = "legacy",
  renderIntents = [],
  onAppendInput,
}: Props) {
  const renderMatches = useMemo(
    () => extractRenderIntentMatches(rawHtml, renderIntents),
    [rawHtml, renderIntents],
  );
  const displayHtml = useMemo(
    () => stripRenderIntentSources(rawHtml, renderIntents),
    [rawHtml, renderIntents],
  );
  const pipeline = useMessageRenderPipeline({
    html: displayHtml,
    characterId,
    enableStreaming,
    renderMode,
  });
  const hasRenderableContent = displayHtml.trim() !== "" || renderMatches.length > 0;
  const shouldShowLoading = (
    isLoading ||
    !hasRenderableContent ||
    (pipeline.phase === "parsed" && pipeline.isParsing && renderMatches.length === 0)
  );

  // 清理颜色缓存
  useEffect(() => {
    clearColorCache();
  }, []);

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  加载状态                                                         ║
  // ╚══════════════════════════════════════════════════════════════════╝
  if (isLoading || !hasRenderableContent) {
    return null;
  }

  if (shouldShowLoading) {
    return null;
  }

  if (pipeline.phase === "preview" || pipeline.phase === "transition") {
    return <StreamingPreview html={displayHtml} />;
  }

  return (
    <div className="space-y-3 whitespace-pre-wrap prose prose-invert max-w-none">
      {pipeline.segments.map((segment, index) => (
        segment.type === "html"
          ? <HtmlSegment key={`html-${index}`} html={segment.content} />
          : null
      ))}
      {renderMatches.map((match, index) => (
        <RenderIntentView
          intent={match.intent}
          key={`${match.intent.id}-${index}`}
          onAppendInput={onAppendInput}
          values={cleanRenderIntentMatchValues(match, renderMatches)}
        />
      ))}
    </div>
  );
}

/**
 * 【性能优化】MessageBubble memo 化
 * 
 * 只有以下情况才重新渲染：
 * 1. html 内容变化
 * 2. characterId 变化
 * 3. isLoading 状态变化
 */
const MessageBubble = memo(MessageBubbleInner, (prev, next) => {
  // 内容变化 → 必须重渲染
  if (prev.html !== next.html) return false;
  
  // 角色变化 → 必须重渲染（影响正则处理）
  if (prev.characterId !== next.characterId) return false;
  
  // 加载状态变化 → 必须重渲染
  if (prev.isLoading !== next.isLoading) return false;

  // 流式预览/完整解析切换 → 必须重渲染
  if (prev.enableStreaming !== next.enableStreaming) return false;
  if (prev.renderMode !== next.renderMode) return false;
  
  if ((prev.renderIntents?.length ?? 0) !== (next.renderIntents?.length ?? 0)) return false;
  
  // 其他情况 → 跳过重渲染
  return true;
});

export default MessageBubble;

/* ═══════════════════════════════════════════════════════════════════════════
   HTML 段落组件
   ═══════════════════════════════════════════════════════════════════════════ */

const HtmlSegment = memo(function HtmlSegment({ html }: { html: string }) {
  if (!html) return null;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
});

const StreamingPreview = memo(function StreamingPreview({ html }: { html: string }) {
  if (!html) return null;
  return (
    <div className="whitespace-pre-wrap break-words text-foreground leading-relaxed">
      {html}
    </div>
  );
});
