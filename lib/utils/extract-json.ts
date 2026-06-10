// 从一段文本中抽取第一个完整 JSON object（按括号配对扫描，忽略字符串内的括号）。
// 单一来源：initial-state 的初始变量解析与 qa-repair 的模型响应解析都用它。
// 注：扫描器兼容 JSON-like 的引号边界（单/双引号皆视为字符串边界），仅用于"框出候选
// 子串"，最终合法性仍由调用方的 JSON.parse 决定。
export function extractFirstJsonObject(content: string): string | undefined {
  const start = content.indexOf("{");
  if (start < 0) return undefined;

  let depth = 0;
  let quote = "";
  for (let index = start; index < content.length; index += 1) {
    const char = content[index] ?? "";
    if (quote) {
      if (char === quote && !isEscaped(content, index)) quote = "";
      continue;
    }
    if (char === "\"" || char === "'") quote = char;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return content.slice(start, index + 1);
  }

  return undefined;
}

// 字符是否被转义：统计其前方连续反斜杠个数，奇数才算转义（偶数个反斜杠是字面反斜杠）。
function isEscaped(content: string, index: number): boolean {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && content[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}
