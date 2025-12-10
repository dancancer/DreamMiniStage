/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         内容解析器                                         ║
 * ║                                                                            ║
 * ║  职责：将 LLM 输出解析为结构化的内容段落                                    ║
 * ║  设计：支持同步和异步两种模式                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { convertMarkdown } from "@/lib/utils/markdown-converter";
import { replaceTags } from "@/lib/utils/tag-replacer";
import { RegexProcessor, RegexPlacement } from "@/lib/core/regex-processor";
import type { ContentSegment } from "@/types/content-segment";

/* ═══════════════════════════════════════════════════════════════════════════
   日志开关
   ═══════════════════════════════════════════════════════════════════════════ */
const DEBUG_PARSER = true;

function log(tag: string, ...args: unknown[]): void {
  if (DEBUG_PARSER) {
    console.log(`[ContentParser][${tag}]`, ...args);
  }
}

const SANDBOX_MARKER = "__SANDBOX_EMBED_";

/* ═══════════════════════════════════════════════════════════════════════════
   主函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 同步解析（不走 RegexProcessor）
 */
export function parseContent(raw: string): ContentSegment[] {
  return parseContentCore(raw);
}

/**
 * 异步解析（走 RegexProcessor）
 * 执行顺序：RegexProcessor → Markdown（内部保护 style 标签）→ TagReplacer
 */
export async function parseContentAsync(
  raw: string,
  characterId?: string,
  placement: RegexPlacement = RegexPlacement.AI_OUTPUT,
): Promise<ContentSegment[]> {
  if (!characterId) {
    log("ASYNC", "无 characterId，跳过 RegexProcessor");
    return parseContentCore(raw);
  }

  log("ASYNC", `━━━ 异步解析，characterId=${characterId}, placement=${placement} ━━━`);

  // 1. 先走 RegexProcessor
  log("ASYNC", "1. 调用 RegexProcessor...");
  const regexResult = await RegexProcessor.processFullContext(raw, {
    ownerId: characterId,
    placement,
  });
  log("ASYNC", `RegexProcessor 完成，应用脚本: ${regexResult.appliedScripts.join(", ") || "(无)"}`);

  // 2. 走常规解析（Markdown 内部会保护 <style> 标签，避免 CSS 被误处理）
  return parseContentCore(regexResult.replacedText);
}

// 导出 RegexPlacement 供外部使用
export { RegexPlacement };

/**
 * 核心解析逻辑
 */
function parseContentCore(raw: string): ContentSegment[] {
  log("START", "━━━ 开始解析内容 ━━━");
  log("START", `输入长度=${raw?.length ?? 0}`);

  if (!raw || !raw.trim()) {
    log("EMPTY", "输入为空，返回空内容");
    return [{ type: "html", content: "" }];
  }

  log("INPUT", `前300字符: ${raw.slice(0, 300)}...`);

  log("STEP", "1. 提取沙箱内容...");
  const sandboxes = extractSandboxes(raw);
  log("SANDBOX", `提取到 ${sandboxes.items.length} 个沙箱`);

  log("STEP", "2. 处理 HTML 内容（Markdown + 标签替换）...");
  const processed = processHtmlContent(sandboxes.cleaned);

  log("STEP", "3. 分割为段落...");
  const segments = splitIntoSegments(processed, sandboxes.items);
  log("DONE", `生成 ${segments.length} 个段落`);
  segments.forEach((s, i) => {
    log("SEGMENT", `[${i}] type=${s.type}, len=${s.content.length}`);
  });

  return segments;
}

/* ═══════════════════════════════════════════════════════════════════════════
   辅助函数
   ═══════════════════════════════════════════════════════════════════════════ */

interface SandboxItem {
  id: string;
  content: string;
}

interface ExtractResult {
  cleaned: string;
  items: SandboxItem[];
}

/**
 * 提取完整 HTML 文档，替换为占位符
 */
function extractSandboxes(input: string): ExtractResult {
  const items: SandboxItem[] = [];

  const cleaned = input.replace(
    /```(?:html)?\s*([\s\S]*?)```/g,
    (match, content) => {
      const trimmed = content.trim();
      log("SANDBOX_CHECK", `检查代码块，长度=${trimmed.length}`);

      if (!isCompleteHtmlDocument(trimmed)) {
        log("SANDBOX_CHECK", "  ✗ 非完整 HTML 文档，保留原样");
        return match;
      }

      const id = `sandbox-${Date.now()}-${items.length}`;
      items.push({ id, content: trimmed });
      log("SANDBOX_CHECK", `  ✓ 提取为沙箱 id=${id}`);
      return `${SANDBOX_MARKER}${items.length - 1}__`;
    },
  );

  return { cleaned, items };
}

/**
 * 判断是否为完整 HTML 文档
 */
function isCompleteHtmlDocument(str: string): boolean {
  const lower = str.toLowerCase();
  return (
    lower.includes("<!doctype html") ||
    (lower.startsWith("<html") && lower.includes("</html>"))
  );
}

/**
 * 处理普通 HTML 内容：Markdown 转换 + 标签替换
 */
function processHtmlContent(content: string): string {
  const md = convertMarkdown(content);
  return replaceTags(md);
}

/**
 * 将处理后的内容分割为段落数组
 */
function splitIntoSegments(
  processed: string,
  sandboxes: SandboxItem[],
): ContentSegment[] {
  if (sandboxes.length === 0) {
    const trimmed = processed.replace(/^[\s\r\n]+|[\s\r\n]+$/g, "");
    return [{ type: "html", content: trimmed }];
  }

  const segments: ContentSegment[] = [];
  const markerRegex = new RegExp(`${SANDBOX_MARKER}(\\d+)__`, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = markerRegex.exec(processed)) !== null) {
    // 前面的 HTML 内容
    if (match.index > lastIndex) {
      const html = processed.slice(lastIndex, match.index).trim();
      if (html) segments.push({ type: "html", content: html });
    }

    // 沙箱内容
    const idx = parseInt(match[1], 10);
    const sandbox = sandboxes[idx];
    if (sandbox) {
      segments.push({ type: "sandbox", content: sandbox.content, id: sandbox.id });
    }

    lastIndex = match.index + match[0].length;
  }

  // 剩余的 HTML 内容
  if (lastIndex < processed.length) {
    const html = processed.slice(lastIndex).trim();
    if (html) segments.push({ type: "html", content: html });
  }

  return segments.length ? segments : [{ type: "html", content: processed }];
}
