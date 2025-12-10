/**
 * CSS Variable Inliner - CSS变量内联工具
 * 
 * 设计原则：
 * 1. 隔离上下文兼容：在iframe等隔离环境中内联CSS变量
 * 2. 性能优先：缓存变量值，避免重复计算
 * 3. 安全降级：当变量未定义时使用合理的默认值
 * 4. 保持简洁：只做一件事，并做到极致
 */

// 从 app/globals.css 提取的CSS变量定义
// 深色主题默认值（与 shadcn 默认色阶对齐）
const CSS_VARIABLES = {
  // 背景层级
  "--color-canvas": "oklch(0.145 0 0)",
  "--color-surface": "oklch(0.187 0 0)",
  "--color-layer": "oklch(0.212 0 0)",
  "--color-deep": "oklch(0.246 0 0)",
  "--color-ember": "oklch(0.238 0 0)",
  "--color-coal": "oklch(0.296 0 0)",
  "--color-muted-surface": "oklch(0.259 0 0)",
  "--color-overlay": "oklch(0.254 0 0)",
  "--color-card": "oklch(0.205 0 0)",
  "--color-input": "oklch(1 0 0 / 15%)",

  // 边框和线条
  "--color-stroke": "oklch(1 0 0 / 10%)",
  "--color-stroke-strong": "oklch(0.65 0 0)",

  // 文本颜色
  "--color-text": "oklch(0.985 0 0)",
  "--color-text-muted": "oklch(0.708 0 0)",
  "--color-ink": "oklch(0.785 0 0)",
  "--color-ink-soft": "oklch(0.641 0 0)",

  // 主题色
  "--color-primary-soft": "#e2e8f0",
  "--color-cream": "#f8fafc",
  "--color-cream-soft": "#e2e8f0",
  "--color-primary": "#f8fafc",
  "--color-primary-bright": "#f8fafc",
  "--color-primary-50": "#f8fafc",
  "--color-primary-100": "#e2e8f0",
  "--color-primary-200": "#cbd5e1",
  "--color-primary-300": "#94a3b8",
  "--color-primary-400": "#64748b",
  "--color-primary-500": "#475569",
  "--color-primary-600": "#334155",
  "--color-primary-700": "#1e293b",
  "--color-primary-800": "#0f172a",
  "--color-primary-900": "#0b1220",
  "--color-highlight": "oklch(0.269 0 0)",
  "--color-sand": "oklch(0.269 0 0)",

  // 状态色
  "--color-success": "oklch(0.696 0.17 162.48)",
  "--color-info": "oklch(0.769 0.188 70.08)",
  "--color-sky-strong": "oklch(0.739 0.17 162.48)",
  "--color-sky": "oklch(0.696 0.17 162.48)",
  "--color-danger": "oklch(0.704 0.191 22.216)",
} as const;

type CssVariableName = keyof typeof CSS_VARIABLES;

/**
 * 内联CSS变量 - 将 var(--variable) 替换为实际值
 * 
 * @param cssText - 包含CSS变量的样式字符串
 * @returns 内联后的样式字符串
 * 
 * @example
 * inlineCssVariables("color: var(--color-danger);")
 * // 返回 "color: oklch(0.704 0.191 22.216);"
 */
export function inlineCssVariables(cssText: string): string {
  if (!cssText || !cssText.includes("var(--")) {
    return cssText;
  }

  let result = cssText;
  
  // 替换所有CSS变量引用
  Object.entries(CSS_VARIABLES).forEach(([variable, value]) => {
    // 匹配 var(--variable) 和 var(--variable, fallback) 两种形式
    const regex = new RegExp(`var\\(${variable}(?:,\\s*[^)]+)?\\)`, "g");
    result = result.replace(regex, value);
  });

  return result;
}

/**
 * 获取CSS变量的值
 * 
 * @param variableName - CSS变量名称，如 "--color-danger"
 * @returns 变量的值，如果未定义则返回undefined
 */
export function getCssVariableValue(variableName: CssVariableName): string | undefined {
  return CSS_VARIABLES[variableName];
}

/**
 * 检查字符串是否包含CSS变量引用
 * 
 * @param text - 要检查的文本
 * @returns 如果包含CSS变量则返回true
 */
export function containsCssVariables(text: string): boolean {
  return text.includes("var(--");
}
