/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         正则处理器                                         ║
 * ║                                                                            ║
 * ║  职责：执行用户定义的正则脚本，对 LLM 输出进行文本替换                       ║
 * ║  设计：管道式处理，每个脚本按优先级顺序执行                                  ║
 * ║                                                                            ║
 * ║  重构理念（Linus 好品味）：                                                 ║
 * ║  1. 消除特殊情况 - 统一的过滤流程，让边界条件自然融入                        ║
 * ║  2. 简洁执念 - 每个函数只做一件事，避免深层嵌套                             ║
 * ║  3. 实用主义 - 解决真实问题，不做过度设计                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { 
  RegexReplacementResult, 
  RegexScript,
  SubstituteRegexMode, 
} from "@/lib/models/regex-script-model";
import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";
import { substitute, MacroParams } from "@/lib/core/macro-substitutor";
import { filterString } from "@/lib/core/trim-string-filter";

/* ═══════════════════════════════════════════════════════════════════════════
   Placement 枚举（与 SillyTavern 兼容）
   ═══════════════════════════════════════════════════════════════════════════ */
export enum RegexPlacement {
  USER_INPUT = 1,
  AI_OUTPUT = 2,
  SLASH_COMMAND = 3,
  WORLD_INFO = 5,
  REASONING = 6,
}

/* ═══════════════════════════════════════════════════════════════════════════
   处理器选项接口
   ═══════════════════════════════════════════════════════════════════════════ */

export interface RegexProcessorOptions {
  /** 所有者 ID（角色 ID 或会话 ID） */
  ownerId: string;

  /** 当前启用的预设来源（用于加载预设级正则脚本） */
  presetSource?: {
    ownerId: string;
    apiId?: string;
    presetName?: string;
  };

  /** 是否包含全局脚本，默认包含 */
  includeGlobal?: boolean;

  /** 是否启用白名单过滤 */
  allowedOnly?: boolean;
  
  /** 当前处理场景的 placement */
  placement?: RegexPlacement;
  
  /** 是否为 Markdown 渲染场景 */
  isMarkdown?: boolean;
  
  /** 是否为发送给 LLM 的提示词场景 */
  isPrompt?: boolean;
  
  /** 当前消息深度（用于深度约束过滤） */
  depth?: number;
  
  /** 宏替换参数 */
  macroParams?: MacroParams;
}

/* ═══════════════════════════════════════════════════════════════════════════
   日志开关：设为 true 开启详细日志
   ═══════════════════════════════════════════════════════════════════════════ */
const DEBUG_REGEX = true;

function log(tag: string, ...args: unknown[]): void {
  if (DEBUG_REGEX) {
    // console.log(`[RegexProcessor][${tag}]`, ...args);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   辅助函数
   ═══════════════════════════════════════════════════════════════════════════ */

const ESCAPE_SEQS = ["\\t", "\\n", "\\r", "\\f", "\\v", "\\b", "\\0"];
// 支持所有常用 flags: g(global), i(ignoreCase), m(multiline), s(dotAll), u(unicode)
const REGEX_FORMAT = /^\/(.*)\/([gimsuy]*)$/;

function escapeControlChars(pattern: string): string {
  let result = pattern;
  let changed = false;

  for (const seq of ESCAPE_SEQS) {
    if (result.includes(seq)) {
      const escaped = seq.replace("\\", "\\\\");
      result = result.replace(new RegExp(seq.replace("\\", "\\\\"), "g"), escaped);
      changed = true;
    }
  }

  if (changed) {
    log("ESCAPE", `'${pattern}' → '${result}'`);
  }
  return result;
}

function tryCompileRegex(pattern: string, flags = "g"): RegExp | null {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

function compileWithFallback(raw: string): RegExp | null {
  // 优先处理 /pattern/flags 格式，避免被直接编译为字面量字符串
  const formatMatch = raw.match(REGEX_FORMAT);
  if (formatMatch) {
    const pattern = formatMatch[1];
    const flags = formatMatch[2] || "g";
    const regex = tryCompileRegex(pattern, flags);
    if (regex) {
      log("COMPILE", `格式化编译成功: '${raw}' → /${pattern}/${flags}`);
      return regex;
    }
  }

  // 尝试 1：直接编译
  let regex = tryCompileRegex(raw, "g");
  if (regex) {
    log("COMPILE", `直接编译成功: '${raw}'`);
    return regex;
  }

  // 尝试 2：移除末尾反斜杠
  let safe = raw.endsWith("\\") ? raw.slice(0, -1) : raw;
  const fallbackFormatMatch = safe.match(REGEX_FORMAT);
  if (fallbackFormatMatch) safe = fallbackFormatMatch[1];

  regex = tryCompileRegex(safe, "g");
  if (regex) {
    log("COMPILE", `修复后编译成功: '${raw}' → '${safe}'`);
    return regex;
  }

  // 尝试 3：转为字面量
  const literal = raw.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  regex = tryCompileRegex(literal, "g");
  if (regex) {
    log("COMPILE", `字面量转换成功: '${raw}' → '${literal}'`);
    return regex;
  }

  log("COMPILE", `编译失败，跳过: '${raw}'`);
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   脚本过滤函数 - 消除特殊情况的设计
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 检查脚本是否应该在当前上下文中执行
 * 
 * 设计理念：
 * - 所有过滤条件统一流向，返回 true/false
 * - 消除嵌套 if，让每个条件独立判断
 * - 早返回模式，失败快速退出
 * 
 * @param script - 待检查的脚本
 * @param options - 处理器选项
 * @returns true 表示应该执行，false 表示应该跳过
 */
export function shouldExecuteScript(
  script: RegexScript,
  options: RegexProcessorOptions,
): boolean {
  const { placement, isMarkdown, isPrompt, depth } = options;
  
  /* ─────────────────────────────────────────────────────────────────────────
     过滤 1：禁用的脚本
     ───────────────────────────────────────────────────────────────────────── */
  
  if (script.disabled) {
    log("FILTER", `排除(禁用): ${script.scriptName || script.scriptKey}`);
    return false;
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     过滤 2：默认脚本（空操作脚本）
     ───────────────────────────────────────────────────────────────────────── */
  
  const isDefault = script.findRegex === "/[\\s\\S]*/gm" && script.replaceString === "";
  if (isDefault) {
    log("FILTER", `排除(默认): ${script.scriptName || script.scriptKey}`);
    return false;
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     过滤 3：Placement 匹配
     脚本的 placement 数组必须包含当前 placement
     ───────────────────────────────────────────────────────────────────────── */
  
  if (placement !== undefined) {
    const placements = script.placement || [];
    if (placements.length > 0 && !placements.includes(placement)) {
      log("FILTER", `排除(placement不匹配): ${script.scriptName}, 需要=${placements}, 当前=${placement}`);
      return false;
    }
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     过滤 4：Markdown 标志位
     markdownOnly=true 时，只在 Markdown 场景执行
     ───────────────────────────────────────────────────────────────────────── */
  
  if (script.markdownOnly && !isMarkdown) {
    log("FILTER", `排除(markdownOnly): ${script.scriptName}`);
    return false;
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     过滤 5：Prompt 标志位
     promptOnly=true 时，只在 Prompt 场景执行
     ───────────────────────────────────────────────────────────────────────── */
  
  if (script.promptOnly && !isPrompt) {
    log("FILTER", `排除(promptOnly): ${script.scriptName}`);
    return false;
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     过滤 6：深度约束
     minDepth 和 maxDepth 定义了脚本适用的消息深度范围
     ───────────────────────────────────────────────────────────────────────── */
  
  if (depth !== undefined) {
    if (script.minDepth !== undefined && depth < script.minDepth) {
      log("FILTER", `排除(深度过浅): ${script.scriptName}, depth=${depth}, minDepth=${script.minDepth}`);
      return false;
    }
    
    if (script.maxDepth !== undefined && depth > script.maxDepth) {
      log("FILTER", `排除(深度过深): ${script.scriptName}, depth=${depth}, maxDepth=${script.maxDepth}`);
      return false;
    }
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     所有过滤条件通过，脚本应该执行
     ───────────────────────────────────────────────────────────────────────── */
  
  return true;
}

/**
 * 编译正则表达式，应用宏替换
 * 
 * 设计理念：
 * - 先宏替换，再编译正则
 * - 根据 substituteRegex 模式选择替换策略
 * - 失败时返回 null，让调用者决定如何处理
 * 
 * @param script - 脚本对象
 * @param macroParams - 宏参数
 * @returns 编译后的正则表达式，失败返回 null
 */
function compileScriptRegex(
  script: RegexScript,
  macroParams: MacroParams,
): RegExp | null {
  let pattern = script.findRegex;
  
  /* ─────────────────────────────────────────────────────────────────────────
     步骤 1：宏替换
     根据 substituteRegex 模式应用宏替换
     ───────────────────────────────────────────────────────────────────────── */
  
  const mode = script.substituteRegex ?? SubstituteRegexMode.NONE;
  if (mode !== SubstituteRegexMode.NONE) {
    pattern = substitute(pattern, macroParams, mode);
    log("MACRO", `宏替换: ${script.findRegex} → ${pattern}`);
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     步骤 2：转义控制字符
     ───────────────────────────────────────────────────────────────────────── */
  
  const escaped = escapeControlChars(pattern);
  
  /* ─────────────────────────────────────────────────────────────────────────
     步骤 3：编译正则表达式
     支持 /pattern/flags 格式
     ───────────────────────────────────────────────────────────────────────── */
  
  const formatMatch = escaped.match(REGEX_FORMAT);
  
  if (formatMatch) {
    // 格式化正则: /pattern/flags
    const regexBody = escapeControlChars(formatMatch[1]);
    const flags = formatMatch[2] || "g";
    return tryCompileRegex(regexBody, flags);
  }
  
  // 回退编译
  return compileWithFallback(escaped);
}

/**
 * 执行单个脚本的替换
 * 
 * 设计理念：
 * - 单一职责：只负责执行替换
 * - 应用 TrimStrings 过滤
 * - 返回替换后的文本和是否成功的标志
 * 
 * @param text - 输入文本
 * @param script - 脚本对象
 * @param regex - 已编译的正则表达式
 * @returns 替换后的文本和替换详情
 */
function executeScriptReplacement(
  text: string,
  script: RegexScript,
  regex: RegExp,
): { text: string; replacements: Array<{ before: string; after: string }> } {
  const replaceStr = script.replaceString ?? "";
  const replacements: Array<{ before: string; after: string }> = [];
  
  /* ─────────────────────────────────────────────────────────────────────────
     步骤 1：执行正则替换
     利用 JS 原生 replace 对 $1, $2 等捕获组的支持
     ───────────────────────────────────────────────────────────────────────── */
  
  let result = text.replace(regex, (...args) => {
    const match = args[0] as string;
    
    // 手动替换 $1, $2, ... $n 为对应捕获组
    const after = replaceStr.replace(/\$(\d+)/g, (_, n) => {
      const idx = parseInt(n, 10);
      return (args[idx] as string) ?? "";
    });
    
    replacements.push({ before: match, after });
    return after;
  });
  
  /* ─────────────────────────────────────────────────────────────────────────
     步骤 2：应用 TrimStrings 过滤
     在替换后进一步过滤结果
     ───────────────────────────────────────────────────────────────────────── */
  
  if (script.trimStrings && script.trimStrings.length > 0) {
    result = filterString(result, script.trimStrings);
    log("TRIM", `应用 trimStrings: ${script.trimStrings.length} 个规则`);
  }
  
  return { text: result, replacements };
}

/* ═══════════════════════════════════════════════════════════════════════════
   核心处理器
   ═══════════════════════════════════════════════════════════════════════════ */

export class RegexProcessor {
  static async processFullContext(
    fullContext: string,
    options: RegexProcessorOptions,
  ): Promise<RegexReplacementResult> {
    const { 
      ownerId, 
      placement = RegexPlacement.AI_OUTPUT,
      macroParams = {},
    } = options;

    log("START", `ownerId=${ownerId}, placement=${placement}, 输入长度=${fullContext.length}`);
    log("INPUT", `${fullContext}`);

    const result: RegexReplacementResult = {
      originalText: fullContext,
      replacedText: fullContext,
      appliedScripts: [],
      success: false,
    };

    /* ─────────────────────────────────────────────────────────────────────────
       步骤 1：检查设置
       ───────────────────────────────────────────────────────────────────────── */
    
    const settings = await RegexScriptOperations.getRegexScriptSettings(ownerId);
    log("SETTINGS", `enabled=${settings.enabled}`);

    if (!settings.enabled) {
      log("SKIP", "正则处理已禁用");
      return result;
    }

    /* ─────────────────────────────────────────────────────────────────────────
       步骤 2：获取并过滤脚本
       使用 shouldExecuteScript 统一过滤逻辑
       ───────────────────────────────────────────────────────────────────────── */
    
    const allScripts = await RegexScriptOperations.getAllScriptsForProcessing(ownerId, {
      allowedOnly: options.allowedOnly,
      includeGlobal: options.includeGlobal !== false,
      presetSource: options.presetSource,
    });
    log("SCRIPTS", `获取到 ${allScripts.length} 个脚本`);

    const scripts = allScripts
      .filter(s => shouldExecuteScript(s, options))
      .sort((a, b) => {
        const aPos = a.placement?.[0] ?? 999;
        const bPos = b.placement?.[0] ?? 999;
        return aPos - bPos;
      });

    log("ENABLED", `启用 ${scripts.length} 个脚本`);

    /* ─────────────────────────────────────────────────────────────────────────
       步骤 3：执行替换管道
       每个脚本按顺序处理文本
       ───────────────────────────────────────────────────────────────────────── */
    
    let text = fullContext;

    for (const script of scripts) {
      const name = script.scriptName || script.scriptKey;
      
      if (!script.findRegex) {
        continue;
      }

      try {
        /* ─────────────────────────────────────────────────────────────────────
           3.1 编译正则（含宏替换）
           ─────────────────────────────────────────────────────────────────── */
        
        const regex = compileScriptRegex(script, macroParams);
        
        if (!regex) {
          log("EXEC", `  ✗ 正则编译失败: ${name}`);
          continue;
        }

        /* ─────────────────────────────────────────────────────────────────────
           3.2 测试匹配
           ─────────────────────────────────────────────────────────────────── */
        
        const matches = text.match(regex);
        if (!matches || matches.length === 0) {
          log("MATCH", name, "  ✗ 无匹配");
          continue;
        }

        log("MATCH", `  匹配: ${matches.length} 处`);

        /* ─────────────────────────────────────────────────────────────────────
           3.3 执行替换（含 TrimStrings）
           ─────────────────────────────────────────────────────────────────── */
        
        const prev = text;
        const { text: newText, replacements } = executeScriptReplacement(text, script, regex);
        text = newText;

        /* ─────────────────────────────────────────────────────────────────────
           3.4 记录结果
           ─────────────────────────────────────────────────────────────────── */
        
        if (prev !== text) {
          result.appliedScripts.push(script.scriptKey);
          result.success = true;

          // 输出命中日志
          log("HIT", `  ✓ 规则命中: 【${name}】`);
          log("HIT", `  ✓ 替换数量: ${replacements.length} 处`);
          replacements.slice(0, 5).forEach((r, i) => {
            const beforePreview = r.before.length > 80 ? r.before.slice(0, 80) + "..." : r.before;
            const afterPreview = r.after.length > 80 ? r.after.slice(0, 80) + "..." : r.after;
            log("HIT", `  [${i + 1}] 前: "${beforePreview}"`);
            log("HIT", `      后: "${afterPreview}"`);
          });
          if (replacements.length > 5) {
            log("HIT", `  ... 还有 ${replacements.length - 5} 处替换`);
          }
        } else {
          log("EXEC", "  ✗ 未生效（替换结果相同）");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log("ERROR", `  ✗ 异常: ${msg}`);
      }
    }

    result.replacedText = text;

    log("DONE", "━━━ 完成 ━━━");
    log("DONE", `  应用: ${result.appliedScripts.length} 个`);
    log("DONE", `  脚本: ${result.appliedScripts.join(", ") || "(无)"}`);
    log("DONE", `  输出长度: ${text.length}`);
    log("OUTPUT", `${text}`);

    return result;
  }
}
