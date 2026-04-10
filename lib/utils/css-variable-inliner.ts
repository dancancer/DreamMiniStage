/**
 * CSS Variable Inliner - CSS变量内联工具
 * 
 * 设计原则：
 * 1. 隔离上下文兼容：在iframe等隔离环境中内联CSS变量
 * 2. 性能优先：缓存变量值，避免重复计算
 * 3. 安全降级：当变量未定义时使用合理的默认值
 * 4. 保持简洁：只做一件事，并做到极致
 */

// 从 app/globals.css 提取的 CSS 变量定义
// 深色主题默认值（与 Velvet Stage 配色保持一致）
const CSS_VARIABLES = {
  // 背景层级
  "--color-canvas": "oklch(0.17 0.01 330)",
  "--color-surface": "oklch(0.2 0.012 332)",
  "--color-layer": "oklch(0.23 0.014 332)",
  "--color-deep": "oklch(0.26 0.016 334)",
  "--color-ember": "oklch(0.3 0.04 348)",
  "--color-coal": "oklch(0.29 0.012 332)",
  "--color-muted-surface": "oklch(0.25 0.012 334)",
  "--color-overlay": "oklch(0.28 0.024 340)",
  "--color-card": "oklch(0.21 0.014 332)",
  "--color-input": "oklch(0.29 0.01 334 / 80%)",

  // 边框和线条
  "--color-stroke": "oklch(0.36 0.012 334 / 70%)",
  "--color-stroke-strong": "oklch(0.54 0.04 340 / 80%)",

  // 文本颜色
  "--color-text": "oklch(0.94 0.006 335)",
  "--color-text-muted": "oklch(0.71 0.012 330)",
  "--color-ink": "oklch(0.82 0.014 332)",
  "--color-ink-soft": "oklch(0.69 0.02 338)",

  // 主题色
  "--color-primary-soft": "oklch(0.74 0.08 352)",
  "--color-cream": "oklch(0.94 0.006 335)",
  "--color-cream-soft": "oklch(0.82 0.014 332)",
  "--color-primary": "oklch(0.56 0.18 8)",
  "--color-primary-bright": "oklch(0.69 0.12 8)",
  "--color-primary-50": "oklch(0.982 0.005 8)",
  "--color-primary-100": "oklch(0.956 0.014 8)",
  "--color-primary-200": "oklch(0.908 0.032 8)",
  "--color-primary-300": "oklch(0.81 0.07 8)",
  "--color-primary-400": "oklch(0.69 0.12 8)",
  "--color-primary-500": "oklch(0.61 0.16 8)",
  "--color-primary-600": "oklch(0.56 0.18 8)",
  "--color-primary-700": "oklch(0.48 0.14 8)",
  "--color-primary-800": "oklch(0.39 0.1 8)",
  "--color-primary-900": "oklch(0.29 0.06 8)",
  "--color-highlight": "oklch(0.75 0.1 8)",
  "--color-sand": "oklch(0.63 0.08 352)",

  // 状态色
  "--color-success": "oklch(0.67 0.11 155)",
  "--color-info": "oklch(0.68 0.07 338)",
  "--color-sky-strong": "oklch(0.74 0.06 338)",
  "--color-sky": "oklch(0.68 0.07 338)",
  "--color-danger": "oklch(0.63 0.21 24)",
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
 * // 返回 "color: oklch(0.63 0.21 24);"
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
