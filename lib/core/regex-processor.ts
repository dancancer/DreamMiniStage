/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         正则处理器                                         ║
 * ║                                                                            ║
 * ║  职责：执行用户定义的正则脚本，对 LLM 输出进行文本替换                       ║
 * ║  设计：管道式处理，每个脚本按优先级顺序执行                                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { RegexReplacementResult } from "@/lib/models/regex-script-model";
import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";

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

export interface RegexProcessorOptions {
  ownerId: string;
  placement?: RegexPlacement;
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
  // 尝试 1：直接编译
  let regex = tryCompileRegex(raw, "g");
  if (regex) {
    log("COMPILE", `直接编译成功: '${raw}'`);
    return regex;
  }

  // 尝试 2：移除末尾反斜杠
  let safe = raw.endsWith("\\") ? raw.slice(0, -1) : raw;
  const formatMatch = safe.match(REGEX_FORMAT);
  if (formatMatch) safe = formatMatch[1];

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
   核心处理器
   ═══════════════════════════════════════════════════════════════════════════ */

export class RegexProcessor {
  static async processFullContext(
    fullContext: string,
    options: RegexProcessorOptions,
  ): Promise<RegexReplacementResult> {
    const { ownerId, placement = RegexPlacement.AI_OUTPUT } = options;

    log("START", `ownerId=${ownerId}, placement=${placement}, 输入长度=${fullContext.length}`);
    log("INPUT", `${fullContext}`);

    const result: RegexReplacementResult = {
      originalText: fullContext,
      replacedText: fullContext,
      appliedScripts: [],
      success: false,
    };

    // 获取设置
    const settings = await RegexScriptOperations.getRegexScriptSettings(ownerId);
    log("SETTINGS", `enabled=${settings.enabled}`);

    if (!settings.enabled) {
      log("SKIP", "正则处理已禁用");
      return result;
    }

    // 获取并过滤脚本
    const allScripts = await RegexScriptOperations.getAllScriptsForProcessing(ownerId);
    log("SCRIPTS", `获取到 ${allScripts.length} 个脚本`);

    const scripts = allScripts
      .filter(s => {
        const isDefault = s.findRegex === "/[\\s\\S]*/gm" && s.replaceString === "";
        if (s.disabled || isDefault) {
          log("FILTER", `排除(禁用/默认): ${s.scriptName || s.scriptKey}`);
          return false;
        }
        // 检查 placement 是否匹配当前场景
        const placements = s.placement || [];
        if (placements.length > 0 && !placements.includes(placement)) {
          log("FILTER", `排除(placement不匹配): ${s.scriptName}, 需要=${placements}, 当前=${placement}`);
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aPos = a.placement?.[0] ?? 999;
        const bPos = b.placement?.[0] ?? 999;
        return aPos - bPos;
      });

    log("ENABLED", `启用 ${scripts.length} 个脚本`);

    // 执行替换
    let text = fullContext;

    for (const script of scripts) {
      const name = script.scriptName || script.scriptKey;
      if (!script.findRegex) {
        continue;
      }

      try {
        const escaped = escapeControlChars(script.findRegex);
        const formatMatch = escaped.match(REGEX_FORMAT);

        let regex: RegExp | null = null;

        if (formatMatch) {
          // 格式化正则: /pattern/flags
          const pattern = escapeControlChars(formatMatch[1]);
          const flags = formatMatch[2] || "g";
          regex = tryCompileRegex(pattern, flags);
        }

        if (!regex) {
          regex = compileWithFallback(escaped);
        }

        if (!regex) {
          log("EXEC", "  ✗ 正则编译失败，跳过");
          continue;
        }

        // 测试匹配
        const matches = text.match(regex);
        if (!matches || matches.length === 0) {
          log("MATCH", name,"  ✗ 无匹配");
          continue;
        }

        log("MATCH", `  匹配: ${matches.length} 处`);

        // 执行替换并记录每处变化
        const prev = text;
        const replaceStr = script.replaceString ?? "";

        // 收集所有替换详情
        // 利用 JS 原生 replace 对 $1, $2 等捕获组的支持
        const replacements: { before: string; after: string }[] = [];
        text = text.replace(regex, (...args) => {
          const match = args[0] as string;
          // 手动替换 $1, $2, ... $n 为对应捕获组
          const after = replaceStr.replace(/\$(\d+)/g, (_, n) => {
            const idx = parseInt(n, 10);
            return (args[idx] as string) ?? "";
          });
          replacements.push({ before: match, after });
          return after;
        });

        if (prev !== text) {
          result.appliedScripts.push(script.scriptKey);
          result.success = true;

          // 输出命中日志：规则名称 + 修改前后内容
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
