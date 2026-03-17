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
 * ║  架构：组合 HtmlSegment + ScriptSandbox，职责分离                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useEffect, memo, useMemo } from "react";
import { ScriptSandbox } from "./ScriptSandbox";
import { clearColorCache } from "@/lib/utils/html-tag-processor";
import type { ScriptMessageData } from "@/types/script-message";
import { useMessageRenderPipeline } from "@/components/message-bubble/useMessageRenderPipeline";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface TavernHelperScriptValue {
  id: string;
  name: string;
  content: string;
  info?: string;
  buttons?: { name: string; visible: boolean }[];
  data?: Record<string, unknown>;
  enabled?: boolean;
}

type TavernHelperScript =
  | { type: "script"; value: TavernHelperScriptValue }
  | { name: string; content: string; enabled?: boolean; id?: string }
  | TavernHelperScriptValue;

interface Props {
  html: string;
  characterId?: string;
  isLoading?: boolean;
  enableStreaming?: boolean;
  onContentChange?: () => void;
  enableScript?: boolean;
  onScriptMessage?: (data: ScriptMessageData) => Promise<unknown> | unknown;
  scriptVariables?: Record<string, unknown>;
  scripts?: TavernHelperScript[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

function MessageBubbleInner({
  html: rawHtml,
  characterId,
  isLoading = false,
  enableStreaming = false,
  onContentChange,
  enableScript = false,
  onScriptMessage,
  scriptVariables,
  scripts = [],
}: Props) {
  const contentWithScripts = useMemo(
    () => injectScriptsIntoContent(rawHtml, scripts),
    [rawHtml, scripts],
  );
  const pipeline = useMessageRenderPipeline({
    html: contentWithScripts,
    characterId,
    enableStreaming,
  });
  const shouldShowLoading = (
    isLoading ||
    rawHtml.trim() === "" ||
    (pipeline.phase === "parsed" && pipeline.isParsing)
  );

  // 清理颜色缓存
  useEffect(() => {
    clearColorCache();
  }, []);

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  加载状态                                                         ║
  // ╚══════════════════════════════════════════════════════════════════╝
  if (isLoading || rawHtml.trim() === "") {
    return null;
  }

  if (shouldShowLoading) {
    return null;
  }

  if (pipeline.phase === "preview" || pipeline.phase === "transition") {
    return <StreamingPreview html={rawHtml} />;
  }

  return (
    <div className=" whitespace-pre-wrap prose prose-invert max-w-none">
      {pipeline.segments.map((segment, index) =>
        segment.type === "html" ? (
          <HtmlSegment key={`html-${index}`} html={segment.content} />
        ) : (
          <ScriptSandbox
            key={segment.id}
            id={segment.id}
            html={segment.content}
            variables={enableScript ? scriptVariables : undefined}
            onMessage={enableScript ? onScriptMessage : undefined}
            onHeightChange={onContentChange}
          />
        ),
      )}
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
 * 
 * 忽略 onScriptMessage、scriptVariables、onContentChange 的引用变化
 * 这些回调/数据通过 ref 或闭包获取最新值
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
  
  // scripts 数组长度变化 → 必须重渲染
  if ((prev.scripts?.length ?? 0) !== (next.scripts?.length ?? 0)) return false;
  
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

/* ═══════════════════════════════════════════════════════════════════════════
   TavernHelper 脚本处理
   ═══════════════════════════════════════════════════════════════════════════ */

function normalizeScript(script: TavernHelperScript): TavernHelperScriptValue | null {
  // 新格式: { type: "script", value: {...} }
  if ("type" in script && script.type === "script" && "value" in script) {
    if (script.value.enabled === false) return null;
    return script.value;
  }

  // 旧格式: { name, content, ... }
  if ("name" in script && "content" in script) {
    if ("enabled" in script && script.enabled === false) return null;
    const id =
      "id" in script && script.id
        ? script.id
        : `script-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    return { id, name: script.name, content: script.content, enabled: true };
  }

  return null;
}

function injectScriptsIntoContent(rawHtml: string, scripts: TavernHelperScript[]): string {
  if (scripts.length === 0) {
    return rawHtml;
  }

  const scriptTags = scripts
    .map(normalizeScript)
    .filter((s): s is TavernHelperScriptValue => s !== null)
    .map(generateScriptTag)
    .join("\n");

  if (!scriptTags) {
    return rawHtml;
  }

  return scriptTags + rawHtml;
}

function generateScriptTag(script: TavernHelperScriptValue): string {
  const { id, name, content, data } = script;
  const escapedName = name.replace(/'/g, "\\'").replace(/\n/g, "\\n");
  const escapedId = id.replace(/'/g, "\\'");
  const importMatch = content.match(/^\s*import\s+['"](.+?)['"]\s*;?\s*$/);

  if (importMatch) {
    // 动态脚本加载
    return `
      <script data-script-id="${escapedId}" data-script-name="${escapedName}">
        (function() {
          var script = document.createElement('script');
          script.src = '${importMatch[1]}';
          script.async = true;
          window.__tavernHelperScriptData = window.__tavernHelperScriptData || {};
          window.__tavernHelperScriptData['${escapedId}'] = ${JSON.stringify(data || {})};
          document.head.appendChild(script);
        })();
      </script>
    `;
  }

  // 内联脚本
  return `
    <script data-script-id="${escapedId}" data-script-name="${escapedName}">
      (function() {
        window.__tavernHelperScriptData = window.__tavernHelperScriptData || {};
        window.__tavernHelperScriptData['${escapedId}'] = ${JSON.stringify(data || {})};
        try { ${content} } catch (e) { console.error('[TavernHelper] Error:', e); }
      })();
    </script>
  `;
}
