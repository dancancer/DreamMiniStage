/* ═══════════════════════════════════════════════════════════════════════════
   宏替换器 - MacroSubstitutor
   
   设计理念：
   1. 纯函数设计 - 无副作用，易于测试
   2. 消除特殊情况 - 统一的替换流程，mode 决定行为
   3. 简洁执念 - 每个函数只做一件事
   
   核心功能：
   - substitute: 根据模式替换宏占位符
   - sanitizeRegexMacro: 转义正则特殊字符
   ═══════════════════════════════════════════════════════════════════════════ */

import { SubstituteRegexMode } from "@/lib/models/regex-script-model";

/* ─────────────────────────────────────────────────────────────────────────
   类型定义
   ───────────────────────────────────────────────────────────────────────── */

/**
 * 宏参数接口
 * 包含所有可用的宏替换变量
 */
export interface MacroParams {
  /** 用户名 */
  user?: string;
  /** 角色名 */
  char?: string;
  /** 消息 ID */
  mesId?: number;
  /** 消息深度 */
  depth?: number;
  /** 扩展参数 */
  [key: string]: string | number | undefined;
}

/* ─────────────────────────────────────────────────────────────────────────
   核心函数 - 宏替换
   ───────────────────────────────────────────────────────────────────────── */

/**
 * 替换模式中的宏占位符
 * 
 * 设计理念：
 * - 通过 mode 参数统一控制行为，消除分支特殊情况
 * - NONE: 直接返回，零开销
 * - RAW: 简单替换，保持正则语义
 * - ESCAPED: 安全替换，防止注入
 * 
 * @param pattern - 包含宏占位符的模式字符串
 * @param params - 宏参数对象
 * @param mode - 替换模式（NONE/RAW/ESCAPED）
 * @returns 替换后的字符串
 * 
 * @example
 * substitute("Hello {{user}}", { user: "Alice" }, SubstituteRegexMode.RAW)
 * // => "Hello Alice"
 * 
 * substitute("{{user}}.*", { user: "A+" }, SubstituteRegexMode.ESCAPED)
 * // => "A\\+.*"
 */
export function substitute(
  pattern: string,
  params: MacroParams,
  mode: SubstituteRegexMode,
): string {
  /* ─────────────────────────────────────────────────────────────────────────
     快速路径：NONE 模式直接返回
     消除不必要的计算开销
     ───────────────────────────────────────────────────────────────────────── */
  
  if (mode === SubstituteRegexMode.NONE) {
    return pattern;
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     替换逻辑：统一的替换流程
     mode 决定是否转义，而非分支判断
     ───────────────────────────────────────────────────────────────────────── */
  
  const shouldEscape = mode === SubstituteRegexMode.ESCAPED;
  
  return pattern.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = params[key];
    
    // 值不存在时保留原始占位符
    if (value === undefined || value === null) {
      return match;
    }
    
    const stringValue = String(value);
    
    // 根据模式决定是否转义
    return shouldEscape ? sanitizeRegexMacro(stringValue) : stringValue;
  });
}

/* ─────────────────────────────────────────────────────────────────────────
   辅助函数 - 正则转义
   ───────────────────────────────────────────────────────────────────────── */

/**
 * 转义字符串中的正则特殊字符
 * 
 * 设计理念：
 * - 简单直接的字符替换
 * - 覆盖所有正则元字符
 * - 保证替换后的字符串可以安全用于 RegExp
 * 
 * @param value - 需要转义的字符串
 * @returns 转义后的字符串
 * 
 * @example
 * sanitizeRegexMacro("A+B*C?")
 * // => "A\\+B\\*C\\?"
 */
export function sanitizeRegexMacro(value: string): string {
  /* ─────────────────────────────────────────────────────────────────────────
     正则元字符列表：
     . * + ? ^ $ { } ( ) | [ ] \
     
     使用 replace 一次性处理所有特殊字符
     避免多次遍历字符串
     ───────────────────────────────────────────────────────────────────────── */
  
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ─────────────────────────────────────────────────────────────────────────
   导出接口
   ───────────────────────────────────────────────────────────────────────── */

export const MacroSubstitutor = {
  substitute,
  sanitizeRegexMacro,
};
