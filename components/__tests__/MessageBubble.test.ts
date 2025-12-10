import { describe, it, expect } from "vitest";

/**
 * 测试中文引号处理逻辑
 * 中文左引号: \u201C (")
 * 中文右引号: \u201D (")
 */
function processText(str: string): string {
  const quotePattern = /(<[^>]+>)|(\u201C[^\u201C\u201D]+\u201D)/g;
  return str.replace(quotePattern, (_match, tag, quote) => {
    if (tag) return tag;
    return `<span class="dialogue">${quote}</span>`;
  });
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
 * 从代码块中提取完整 HTML 文档
 */
function extractHtmlDocuments(input: string): { cleaned: string; docs: string[] } {
  const docs: string[] = [];
  const cleaned = input.replace(
    /```(?:html)?\s*([\s\S]*?)```/g,
    (match, content) => {
      const trimmed = content.trim();
      if (!isCompleteHtmlDocument(trimmed)) return match;
      docs.push(trimmed);
      return `__PLACEHOLDER_${docs.length - 1}__`;
    },
  );
  return { cleaned, docs };
}

describe("MessageBubble text processing", () => {
  it("should process Chinese quotation marks correctly", () => {
    // 这是一段"中文引号"的测试
    const input = "\u8FD9\u662F\u4E00\u6BB5\u201C\u4E2D\u6587\u5F15\u53F7\u201D\u7684\u6D4B\u8BD5";
    // 这是一段<span class="dialogue">"中文引号"</span>的测试
    const expected = "\u8FD9\u662F\u4E00\u6BB5<span class=\"dialogue\">\u201C\u4E2D\u6587\u5F15\u53F7\u201D</span>\u7684\u6D4B\u8BD5";
    expect(processText(input)).toBe(expected);
  });

  it("should detect complete HTML documents", () => {
    expect(isCompleteHtmlDocument("<!DOCTYPE html><html></html>")).toBe(true);
    expect(isCompleteHtmlDocument("<html><body></body></html>")).toBe(true);
    expect(isCompleteHtmlDocument("<div>not a document</div>")).toBe(false);
    expect(isCompleteHtmlDocument("just text")).toBe(false);
  });

  it("should extract html doc code fences", () => {
    const input = `
<screen>content</screen>
\`\`\`html
<!DOCTYPE html>
<html><body><div>demo</div></body></html>
\`\`\`
<speech>done</speech>
`;
    const { cleaned, docs } = extractHtmlDocuments(input);

    expect(docs).toHaveLength(1);
    expect(docs[0]).toContain("<!DOCTYPE html>");
    expect(cleaned).toContain("__PLACEHOLDER_0__");
    expect(cleaned).not.toContain("<!DOCTYPE html>");
  });

  it("should ignore non-html code fences", () => {
    const input = "```js\nconsole.log('hi')\n```";
    const { cleaned, docs } = extractHtmlDocuments(input);

    expect(docs).toHaveLength(0);
    expect(cleaned).toContain("```js");
  });

  it("should handle multiple html documents", () => {
    const input = `
\`\`\`html
<!DOCTYPE html><html><body>First</body></html>
\`\`\`
Some text
\`\`\`html
<!DOCTYPE html><html><body>Second</body></html>
\`\`\`
`;
    const { docs } = extractHtmlDocuments(input);
    expect(docs).toHaveLength(2);
  });
});
