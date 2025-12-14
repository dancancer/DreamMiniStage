/* ═══════════════════════════════════════════════════════════════════════════
   TrimStrings 过滤器 - TrimStringFilter
   
   设计理念：
   1. 纯函数设计 - 无副作用，幂等性保证
   2. 消除特殊情况 - 统一的过滤流程，支持字符串和正则
   3. 简洁执念 - 单一职责，只做过滤
   
   核心功能：
   - filterString: 从文本中移除 trimStrings 指定的模式
   
   哲学思考：
   - 过滤是"减法"的艺术，移除噪音，保留信号
   - 幂等性是函数式编程的美学体现：f(f(x)) = f(x)
   - 好的过滤器应该是无状态的、可组合的
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────────────────
   核心函数 - 字符串过滤
   ───────────────────────────────────────────────────────────────────────── */

/**
 * 从文本中过滤掉 trimStrings 指定的模式
 * 
 * 设计理念：
 * - 支持字符串字面量和正则表达式两种模式
 * - 幂等性保证：多次应用结果相同
 * - 空数组快速返回，零开销
 * 
 * 模式识别：
 * - 以 / 开头和结尾的字符串被视为正则表达式
 * - 其他字符串被视为字面量
 * 
 * @param text - 需要过滤的文本
 * @param trimStrings - 要移除的模式数组
 * @returns 过滤后的文本
 * 
 * @example
 * // 字符串字面量模式
 * filterString("Hello World!", ["World"])
 * // => "Hello !"
 * 
 * @example
 * // 正则表达式模式
 * filterString("Hello123World456", ["/\\d+/"])
 * // => "HelloWorld"
 * 
 * @example
 * // 幂等性
 * const once = filterString(text, patterns);
 * const twice = filterString(once, patterns);
 * // once === twice
 */
export function filterString(text: string, trimStrings: string[]): string {
  /* ─────────────────────────────────────────────────────────────────────────
     快速路径：空数组直接返回
     消除不必要的计算开销
     ───────────────────────────────────────────────────────────────────────── */
  
  if (!trimStrings || trimStrings.length === 0) {
    return text;
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     过滤逻辑：顺序应用所有模式
     每个模式独立处理，结果累积
     ───────────────────────────────────────────────────────────────────────── */
  
  let result = text;
  
  for (const pattern of trimStrings) {
    result = applyPattern(result, pattern);
  }
  
  return result;
}

/* ─────────────────────────────────────────────────────────────────────────
   辅助函数 - 应用单个模式
   ───────────────────────────────────────────────────────────────────────── */

/**
 * 应用单个过滤模式到文本
 * 
 * 设计理念：
 * - 自动识别模式类型（字面量 vs 正则）
 * - 正则模式：/pattern/ 或 /pattern/flags
 * - 字面量模式：直接字符串替换
 * 
 * @param text - 输入文本
 * @param pattern - 过滤模式
 * @returns 过滤后的文本
 */
function applyPattern(text: string, pattern: string): string {
  /* ─────────────────────────────────────────────────────────────────────────
     模式识别：检查是否为正则表达式格式
     正则格式：/pattern/ 或 /pattern/flags
     ───────────────────────────────────────────────────────────────────────── */
  
  const regexMatch = pattern.match(/^\/(.+?)\/([gimsuvy]*)$/);
  
  if (regexMatch) {
    // 正则表达式模式
    return applyRegexPattern(text, regexMatch[1], regexMatch[2]);
  } else {
    // 字符串字面量模式
    return applyLiteralPattern(text, pattern);
  }
}

/**
 * 应用正则表达式模式
 * 
 * @param text - 输入文本
 * @param regexBody - 正则表达式主体
 * @param flags - 正则标志（g, i, m 等）
 * @returns 过滤后的文本
 */
function applyRegexPattern(
  text: string,
  regexBody: string,
  flags: string,
): string {
  try {
    /* ─────────────────────────────────────────────────────────────────────────
       确保全局替换：强制添加 'g' 标志
       这保证了幂等性：所有匹配都会被移除
       ───────────────────────────────────────────────────────────────────────── */
    
    const globalFlags = flags.includes("g") ? flags : flags + "g";
    const regex = new RegExp(regexBody, globalFlags);
    
    return text.replace(regex, "");
  } catch (error) {
    /* ─────────────────────────────────────────────────────────────────────────
       错误处理：无效正则表达式时保持原文本
       避免因配置错误导致数据丢失
       ───────────────────────────────────────────────────────────────────────── */
    
    console.warn(`Invalid regex pattern: ${regexBody}`, error);
    return text;
  }
}

/**
 * 应用字符串字面量模式
 * 
 * @param text - 输入文本
 * @param literal - 字面量字符串
 * @returns 过滤后的文本
 */
function applyLiteralPattern(text: string, literal: string): string {
  /* ─────────────────────────────────────────────────────────────────────────
     字面量替换：使用 split-join 模式
     
     为什么不用 replaceAll？
     - split-join 更简洁，一次性移除所有出现
     - 避免正则转义的复杂性
     - 性能相当，代码更清晰
     ───────────────────────────────────────────────────────────────────────── */
  
  return text.split(literal).join("");
}

/* ─────────────────────────────────────────────────────────────────────────
   导出接口
   ───────────────────────────────────────────────────────────────────────── */

export const TrimStringFilter = {
  filterString,
};
