/* ═══════════════════════════════════════════════════════════════════════════
   正则调试器 - RegexDebugger
   
   设计理念：
   1. 透明性 - 记录每个脚本的执行细节，让黑盒变白盒
   2. 可追溯性 - 完整的执行链路，从输入到输出
   3. 零侵入 - 复用现有处理逻辑，不修改核心代码
   
   核心功能：
   - debug: 执行脚本并记录详细步骤
   - 返回 DebugResult 包含每个脚本的匹配和替换信息
   
   哲学思考：
   - 调试是"照亮黑暗"的过程，让隐藏的逻辑可见
   - 好的调试器应该是非侵入的观察者，而非参与者
   - 步骤记录是时间的快照，让我们能够回溯执行历史
   ═══════════════════════════════════════════════════════════════════════════ */

import { RegexScript, SubstituteRegexMode } from "@/lib/models/regex-script-model";
import { substitute, MacroParams } from "@/lib/core/macro-substitutor";
import { filterString } from "@/lib/core/trim-string-filter";

/* ─────────────────────────────────────────────────────────────────────────
   类型定义
   ───────────────────────────────────────────────────────────────────────── */

/**
 * 调试步骤接口
 * 记录单个脚本的执行详情
 */
export interface DebugStep {
  /** 脚本名称 */
  scriptName: string;
  
  /** 脚本键 */
  scriptKey: string;
  
  /** 使用的正则表达式（宏替换后） */
  findRegex: string;
  
  /** 替换字符串 */
  replaceString: string;
  
  /** 是否匹配成功 */
  matched: boolean;
  
  /** 所有匹配的字符串数组 */
  matches: string[];
  
  /** 执行前的文本 */
  beforeText: string;
  
  /** 执行后的文本 */
  afterText: string;
  
  /** 是否因编译失败而跳过 */
  skipped?: boolean;
  
  /** 跳过原因 */
  skipReason?: string;
}

/**
 * 调试结果接口
 * 包含完整的执行链路信息
 */
export interface DebugResult {
  /** 输入文本 */
  inputText: string;
  
  /** 最终输出文本 */
  outputText: string;
  
  /** 所有执行步骤 */
  steps: DebugStep[];
  
  /** 总匹配次数 */
  totalMatches: number;
  
  /** 实际应用的脚本数量 */
  appliedScripts: number;
}

/* ─────────────────────────────────────────────────────────────────────────
   辅助函数 - 正则编译
   ───────────────────────────────────────────────────────────────────────── */

/**
 * 尝试编译正则表达式
 * 
 * @param pattern - 正则模式
 * @param flags - 正则标志
 * @returns 编译后的正则，失败返回 null
 */
function tryCompileRegex(pattern: string, flags = "g"): RegExp | null {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

/**
 * 转义控制字符
 * 
 * @param pattern - 输入模式
 * @returns 转义后的模式
 */
function escapeControlChars(pattern: string): string {
  const ESCAPE_SEQS = ["\\t", "\\n", "\\r", "\\f", "\\v", "\\b", "\\0"];
  let result = pattern;

  for (const seq of ESCAPE_SEQS) {
    if (result.includes(seq)) {
      const escaped = seq.replace("\\", "\\\\");
      result = result.replace(new RegExp(seq.replace("\\", "\\\\"), "g"), escaped);
    }
  }

  return result;
}

/**
 * 编译脚本的正则表达式（含宏替换）
 * 
 * 设计理念：
 * - 先宏替换，再编译
 * - 支持 /pattern/flags 格式
 * - 失败时返回 null 和原因
 * 
 * @param script - 脚本对象
 * @param macroParams - 宏参数
 * @returns 编译结果：{ regex, processedPattern, error }
 */
function compileScriptRegex(
  script: RegexScript,
  macroParams: MacroParams,
): { regex: RegExp | null; processedPattern: string; error?: string } {
  let pattern = script.findRegex;
  
  /* ─────────────────────────────────────────────────────────────────────────
     步骤 1：宏替换
     ───────────────────────────────────────────────────────────────────────── */
  
  const mode = script.substituteRegex ?? SubstituteRegexMode.NONE;
  if (mode !== SubstituteRegexMode.NONE) {
    pattern = substitute(pattern, macroParams, mode);
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     步骤 2：转义控制字符
     ───────────────────────────────────────────────────────────────────────── */
  
  const escaped = escapeControlChars(pattern);
  
  /* ─────────────────────────────────────────────────────────────────────────
     步骤 3：解析格式并编译
     ───────────────────────────────────────────────────────────────────────── */
  
  const REGEX_FORMAT = /^\/(.*)\/([gimsuy]*)$/;
  const formatMatch = escaped.match(REGEX_FORMAT);
  
  if (formatMatch) {
    // 格式化正则: /pattern/flags
    const regexBody = formatMatch[1];
    const flags = formatMatch[2] || "g";
    const regex = tryCompileRegex(regexBody, flags);
    
    if (!regex) {
      return {
        regex: null,
        processedPattern: pattern,
        error: "正则编译失败（格式化模式）",
      };
    }
    
    return { regex, processedPattern: pattern };
  }
  
  // 尝试直接编译
  const regex = tryCompileRegex(escaped, "g");
  
  if (!regex) {
    return {
      regex: null,
      processedPattern: pattern,
      error: "正则编译失败",
    };
  }
  
  return { regex, processedPattern: pattern };
}

/* ─────────────────────────────────────────────────────────────────────────
   核心函数 - 调试执行
   ───────────────────────────────────────────────────────────────────────── */

/**
 * 调试执行正则脚本
 * 
 * 设计理念：
 * - 完全复用 RegexProcessor 的逻辑
 * - 记录每个脚本的执行细节
 * - 不修改输入数据，纯观察模式
 * 
 * @param text - 输入文本
 * @param scripts - 脚本数组（已排序和过滤）
 * @param params - 宏参数（可选）
 * @returns 调试结果
 * 
 * @example
 * const result = debug(
 *   "Hello World",
 *   [script1, script2],
 *   { user: "Alice", char: "Bob" }
 * );
 * 
 * console.log(result.steps);
 * // => [
 * //   { scriptName: "script1", matched: true, ... },
 * //   { scriptName: "script2", matched: false, ... }
 * // ]
 */
export function debug(
  text: string,
  scripts: RegexScript[],
  params: MacroParams = {},
): DebugResult {
  /* ─────────────────────────────────────────────────────────────────────────
     初始化结果对象
     ───────────────────────────────────────────────────────────────────────── */
  
  const result: DebugResult = {
    inputText: text,
    outputText: text,
    steps: [],
    totalMatches: 0,
    appliedScripts: 0,
  };
  
  /* ─────────────────────────────────────────────────────────────────────────
     执行管道：顺序处理每个脚本
     ───────────────────────────────────────────────────────────────────────── */
  
  let currentText = text;
  
  for (const script of scripts) {
    const step = executeScriptWithDebug(currentText, script, params);
    
    result.steps.push(step);
    
    // 更新当前文本
    currentText = step.afterText;
    
    // 统计信息
    if (step.matched) {
      result.totalMatches += step.matches.length;
      result.appliedScripts++;
    }
  }
  
  result.outputText = currentText;
  
  return result;
}

/**
 * 执行单个脚本并记录调试信息
 * 
 * @param text - 输入文本
 * @param script - 脚本对象
 * @param params - 宏参数
 * @returns 调试步骤
 */
function executeScriptWithDebug(
  text: string,
  script: RegexScript,
  params: MacroParams,
): DebugStep {
  const scriptName = script.scriptName || script.scriptKey;
  let replaceString = script.replaceString ?? "";
  
  /* ─────────────────────────────────────────────────────────────────────────
     步骤 1：编译正则（含宏替换）
     ───────────────────────────────────────────────────────────────────────── */
  
  const { regex, processedPattern, error } = compileScriptRegex(script, params);
  
  if (!regex) {
    // 编译失败，返回跳过步骤
    return {
      scriptName,
      scriptKey: script.scriptKey,
      findRegex: processedPattern,
      replaceString,
      matched: false,
      matches: [],
      beforeText: text,
      afterText: text,
      skipped: true,
      skipReason: error || "正则编译失败",
    };
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     步骤 2：对 replaceString 应用宏替换
     注意：replaceString 中的宏替换总是使用 RAW 模式
     ───────────────────────────────────────────────────────────────────────── */
  
  const mode = script.substituteRegex ?? SubstituteRegexMode.NONE;
  if (mode !== SubstituteRegexMode.NONE) {
    replaceString = substitute(replaceString, params, SubstituteRegexMode.RAW);
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     步骤 3：测试匹配
     ───────────────────────────────────────────────────────────────────────── */
  
  const matches = text.match(regex) || [];
  
  if (matches.length === 0) {
    // 无匹配，返回未修改的文本
    return {
      scriptName,
      scriptKey: script.scriptKey,
      findRegex: processedPattern,
      replaceString,
      matched: false,
      matches: [],
      beforeText: text,
      afterText: text,
    };
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     步骤 4：执行替换
     ───────────────────────────────────────────────────────────────────────── */
  
  let afterText = text.replace(regex, (...args) => {
    // 手动替换 $1, $2, ... $n 为对应捕获组
    return replaceString.replace(/\$(\d+)/g, (_, n) => {
      const idx = parseInt(n, 10);
      return (args[idx] as string) ?? "";
    });
  });
  
  /* ─────────────────────────────────────────────────────────────────────────
     步骤 5：应用 TrimStrings 过滤
     ───────────────────────────────────────────────────────────────────────── */
  
  if (script.trimStrings && script.trimStrings.length > 0) {
    afterText = filterString(afterText, script.trimStrings);
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     返回调试步骤
     ───────────────────────────────────────────────────────────────────────── */
  
  return {
    scriptName,
    scriptKey: script.scriptKey,
    findRegex: processedPattern,
    replaceString,
    matched: true,
    matches,
    beforeText: text,
    afterText,
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   导出接口
   ───────────────────────────────────────────────────────────────────────── */

export const RegexDebugger = {
  debug,
};
