/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         标签替换器                                         ║
 * ║                                                                            ║
 * ║  职责：为 HTML 标签添加样式和语义属性                                        ║
 * ║  设计：递归处理嵌套标签，智能合并样式                                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { generatePalette, detectHtmlTags } from "./html-tag-processor";
import { useSymbolColorStore } from "@/contexts/SymbolColorStore";

/* ═══════════════════════════════════════════════════════════════════════════
   日志开关
   ═══════════════════════════════════════════════════════════════════════════ */
const DEBUG_TAG = true;

function log(tag: string, ...args: unknown[]): void {
  if (DEBUG_TAG) {
    console.log(`[TagReplacer][${tag}]`, ...args);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   常量
   ═══════════════════════════════════════════════════════════════════════════ */
const SKIP_TAGS = new Set(["script", "style", "head", "meta", "link", "title"]);
const SKIP_SELF_CLOSING = new Set(["br", "hr", "img", "input", "meta", "link"]);

const TAG_REGEX = /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>([\s\S]*?)<\/\1>/g;
const SELF_CLOSING_REGEX = /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)\s*\/\s*>/g;
const CLASS_REGEX = /class\s*=\s*["']([^"']*)["']/i;
const STYLE_REGEX = /style\s*=\s*["']([^"']*)["']/i;

/* ═══════════════════════════════════════════════════════════════════════════
   辅助函数
   ═══════════════════════════════════════════════════════════════════════════ */

function getTagColor(
  tagName: string,
  className: string,
  colours: Record<string, string>,
  getColorForHtmlTag: (tag: string, cls: string) => string | undefined,
): string | undefined {
  return getColorForHtmlTag(tagName, className) || colours[tagName];
}

function buildAttributes(
  original: string,
  color: string,
  tagName: string,
): string {
  let attrs = original.trim();
  const styleMatch = attrs.match(STYLE_REGEX);
  const classMatch = attrs.match(CLASS_REGEX);

  // 合并 style
  if (styleMatch) {
    attrs = attrs.replace(styleMatch[0], `style="${styleMatch[1]}; color:${color}"`);
  } else {
    attrs += ` style="color:${color}"`;
  }

  // 合并 class
  if (classMatch) {
    attrs = attrs.replace(classMatch[0], `class="${classMatch[1]} tag-styled"`);
  } else {
    attrs += " class=\"tag-styled\"";
  }

  return `${attrs} data-tag="${tagName}"`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主函数
   ═══════════════════════════════════════════════════════════════════════════ */

export function replaceTags(html: string): string {
  log("START", `输入长度=${html.length}`);
  log("INPUT", `前200字符: ${html.slice(0, 200)}...`);

  const tags = detectHtmlTags(html);
  log("DETECT", `检测到标签: ${tags.length} 种 - ${tags.join(", ")}`);

  if (tags.length === 0) {
    log("SKIP", "无标签，跳过处理");
    return html;
  }

  const colours = generatePalette(tags);
  log("PALETTE", `生成调色板: ${JSON.stringify(colours)}`);

  const { getColorForHtmlTag } = useSymbolColorStore.getState();

  let processCount = 0;
  let colorApplyCount = 0;

  function processHtml(htmlStr: string, depth = 0): string {
    // 移除标签间空白
    const cleaned = htmlStr.replace(/>\s*\n\s*</g, "><");

    return cleaned.replace(TAG_REGEX, (match, tagName, attributes, inner) => {
      const lower = tagName.toLowerCase();
      processCount++;

      log("PROCESS", `${"  ".repeat(depth)}[${processCount}] <${tagName}> attrs='${attributes.slice(0, 50)}'`);

      if (SKIP_TAGS.has(lower)) {
        log("PROCESS", `${"  ".repeat(depth)}  ✗ 跳过敏感标签`);
        return match;
      }

      // 递归处理内部
      const processedInner = processHtml(inner, depth + 1);

      // 获取颜色
      const className = attributes.match(CLASS_REGEX)?.[1] || "";
      const color = getTagColor(lower, className, colours, getColorForHtmlTag);

      if (color) {
        colorApplyCount++;
        log("PROCESS", `${"  ".repeat(depth)}  ✓ 应用颜色: ${color}`);
        const finalAttrs = buildAttributes(attributes, color, tagName);
        return `<${tagName} ${finalAttrs}>${processedInner}</${tagName}>`;
      }

      log("PROCESS", `${"  ".repeat(depth)}  ✗ 无颜色配置`);
      return `<${tagName}${attributes ? " " + attributes : ""}>${processedInner}</${tagName}>`;
    });
  }

  function processSelfClosing(htmlStr: string): string {
    return htmlStr.replace(SELF_CLOSING_REGEX, (match, tagName, attributes) => {
      const lower = tagName.toLowerCase();
      processCount++;

      log("SELF_CLOSE", `[${processCount}] <${tagName} /> attrs='${attributes.slice(0, 50)}'`);

      if (SKIP_SELF_CLOSING.has(lower)) {
        log("SELF_CLOSE", "  ✗ 跳过");
        return match;
      }

      const className = attributes.match(CLASS_REGEX)?.[1] || "";
      const color = getTagColor(lower, className, colours, getColorForHtmlTag);

      if (color) {
        colorApplyCount++;
        log("SELF_CLOSE", `  ✓ 应用颜色: ${color}`);
        const finalAttrs = buildAttributes(attributes, color, tagName);
        return `<${tagName} ${finalAttrs} />`;
      }

      log("SELF_CLOSE", "  ✗ 无颜色配置");
      return match;
    });
  }

  let result = processHtml(html);
  result = processSelfClosing(result);

  log("DONE", `处理标签: ${processCount} 个，应用颜色: ${colorApplyCount} 个`);
  log("DONE", `输出长度=${result.length}`);
  log("OUTPUT", `前200字符: ${result.slice(0, 200)}...`);

  return result;
}
