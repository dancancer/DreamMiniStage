/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Markdown 转换器                                    ║
 * ║                                                                            ║
 * ║  职责：将 Markdown 字符串转换为 HTML                                        ║
 * ║  设计：渐进增强，占位符机制避免嵌套冲突                                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   日志开关
   ═══════════════════════════════════════════════════════════════════════════ */
const DEBUG_MD = true;

function log(tag: string, ...args: unknown[]): void {
  if (DEBUG_MD) {
    console.log(`[MarkdownConverter][${tag}]`, ...args);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   正则定义（预编译，避免重复创建）
   ═══════════════════════════════════════════════════════════════════════════ */
const PATTERNS = {
  image: /!\[\]\(([^)]+)\)/g,
  hr: /^---$/gm,
  codeBlock: /```[\s\S]*?```/g,
  codeBlockOpen: /^```\w*\n?/,
  codeBlockClose: /```$/,
  blockquote: /^>\s*(.+)$/gm,
  blockquoteMerge: /<\/blockquote>\s*<blockquote>/g,
  bold: /\*\*([^*]+)\*\*/g,
  // 斜体：排除 /* 开头（CSS 注释）和 */ 结尾
  italic: /(?<!\/)\*([^*]+)\*(?!\/)/g,
  talk: /(<[^>]+>)|(["""][^"""]+["""]|「[^「」]+」)/g,
  bracket: /\[([^\]]+)\]|【([^】]+)】/g,
  // 保护 <style> 标签，避免 CSS 内容被误处理
  styleTag: /<style[^>]*>[\s\S]*?<\/style>/gi,
};

/* ═══════════════════════════════════════════════════════════════════════════
   替换步骤（每步一个函数，便于追踪）
   ═══════════════════════════════════════════════════════════════════════════ */

interface Step {
  name: string;
  pattern: RegExp;
  replacer: (match: string, ...args: string[]) => string;
}

function applyStep(text: string, step: Step): string {
  const before = text;
  const matches = text.match(step.pattern);

  log(step.name, `匹配: ${matches ? matches.length : 0} 处`);
  if (matches && matches.length > 0) {
    log(step.name, `内容: ${JSON.stringify(matches.slice(0, 3))}${matches.length > 3 ? "..." : ""}`);
  }

  const after = text.replace(step.pattern, step.replacer as any);

  if (before !== after) {
    log(step.name, `✓ 生效，长度: ${before.length} → ${after.length}`);
  } else {
    log(step.name, "✗ 未变化");
  }

  return after;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主函数
   ═══════════════════════════════════════════════════════════════════════════ */

export function convertMarkdown(str: string): string {
  log("START", `输入长度=${str.length}`);
  log("INPUT", `前200字符: ${str.slice(0, 200)}...`);

  const imagePlaceholders: string[] = [];
  const styleTagPlaceholders: string[] = [];

  // Step 0: 保护 <style> 标签，避免 CSS 内容被 Markdown 误处理
  let result = applyStep(str, {
    name: "STYLE_TAG_PROTECT",
    pattern: PATTERNS.styleTag,
    replacer: (match) => {
      const placeholder = `__STYLE_TAG_${styleTagPlaceholders.length}__`;
      styleTagPlaceholders.push(match);
      return placeholder;
    },
  });

  // Step 1: 提取图片，使用占位符
  result = applyStep(result, {
    name: "IMAGE_EXTRACT",
    pattern: PATTERNS.image,
    replacer: (_match, url) => {
      const placeholder = `__IMAGE_PLACEHOLDER_${imagePlaceholders.length}__`;
      imagePlaceholders.push(`<img src="${url}" alt="Image" />`);
      return placeholder;
    },
  });

  // Step 2: 移除分隔线
  result = applyStep(result, {
    name: "HR_REMOVE",
    pattern: PATTERNS.hr,
    replacer: () => "",
  });

  // Step 3: 代码块
  result = applyStep(result, {
    name: "CODE_BLOCK",
    pattern: PATTERNS.codeBlock,
    replacer: (match) => {
      const content = match
        .replace(PATTERNS.codeBlockOpen, "")
        .replace(PATTERNS.codeBlockClose, "");
      return `<pre>${content}</pre>`;
    },
  });

  // Step 4: 引用块
  result = applyStep(result, {
    name: "BLOCKQUOTE",
    pattern: PATTERNS.blockquote,
    replacer: (_m, content) => `<blockquote>${content}</blockquote>`,
  });

  // Step 5: 合并相邻引用块
  result = applyStep(result, {
    name: "BLOCKQUOTE_MERGE",
    pattern: PATTERNS.blockquoteMerge,
    replacer: () => "\n",
  });

  // Step 6: 恢复遗漏的图片
  result = applyStep(result, {
    name: "IMAGE_RESTORE",
    pattern: PATTERNS.image,
    replacer: (_m, url) => `<img src="${url}" alt="Image" />`,
  });

  // Step 7: 粗体
  result = applyStep(result, {
    name: "BOLD",
    pattern: PATTERNS.bold,
    replacer: (_m, content) => `<strong>${content}</strong>`,
  });

  // Step 8: 斜体
  result = applyStep(result, {
    name: "ITALIC",
    pattern: PATTERNS.italic,
    replacer: (_m, content) => `<em>${content}</em>`,
  });

  // Step 9: 对话标记
  result = applyStep(result, {
    name: "TALK",
    pattern: PATTERNS.talk,
    replacer: (_match, tag, quote) => {
      if (tag) return tag;
      return `<talk>${quote}</talk>`;
    },
  });

  // Step 10: 方括号内容
  result = applyStep(result, {
    name: "BRACKET",
    pattern: PATTERNS.bracket,
    replacer: (_match, latin, cjk) => {
      const content = latin || cjk;
      return `<bracket-content>${content}</bracket-content>`;
    },
  });

  // Step 11: 恢复图片占位符
  imagePlaceholders.forEach((html, i) => {
    const placeholder = `__IMAGE_PLACEHOLDER_${i}__`;
    if (result.includes(placeholder)) {
      log("IMAGE_FINAL", `恢复占位符 ${i}`);
      result = result.replace(placeholder, html);
    }
  });

  // Step 12: 恢复 <style> 标签
  styleTagPlaceholders.forEach((original, i) => {
    const placeholder = `__STYLE_TAG_${i}__`;
    if (result.includes(placeholder)) {
      log("STYLE_TAG_RESTORE", `恢复占位符 ${i}`);
      result = result.replace(placeholder, original);
    }
  });

  log("DONE", `输出长度=${result.length}`);
  log("OUTPUT", `前200字符: ${result.slice(0, 200)}...`);

  return result;
}
