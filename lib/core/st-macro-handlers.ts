/**
 * SillyTavern 宏处理函数
 *
 * 独立的宏替换处理器，供 STMacroEvaluator 调用
 */

import type { MacroEnv } from "./st-preset-types";

/* ═══════════════════════════════════════════════════════════════════════════
   变量宏处理
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 判断值是否为有效数字（排除空白字符串）
 *
 * JavaScript 的 Number(" ") 返回 0，这会导致空格被误判为数字
 * 此方法确保只有真正的数字才返回 true
 */
export function isNumericValue(value: string | number | undefined): boolean {
  if (value === undefined) return false;
  if (typeof value === "number") return true;
  // 排除空字符串和纯空白字符串
  const trimmed = String(value).trim();
  if (trimmed === "") return false;
  return !isNaN(Number(trimmed));
}

/**
 * 替换变量宏 (setvar, getvar, incvar, decvar 等)
 */
export function replaceVariableMacros(
  content: string,
  _env: MacroEnv,
  localVariables: Map<string, string | number>,
  globalVariables: Map<string, string | number>,
): string {
  let result = content;

  result = result.replace(
    /\{\{setvar::([^:}]+)::([^}]*)\}\}/gi,
    (_, name, value) => {
      localVariables.set(name, value);
      return "";
    },
  );

  result = result.replace(
    /\{\{setglobalvar::([^:}]+)::([^}]*)\}\}/gi,
    (_, name, value) => {
      globalVariables.set(name, value);
      return "";
    },
  );

  result = result.replace(/\{\{getvar::([^}]+)\}\}/gi, (_, name) => {
    const value = localVariables.get(name);
    return value !== undefined ? String(value) : "";
  });

  result = result.replace(/\{\{getglobalvar::([^}]+)\}\}/gi, (_, name) => {
    const value = globalVariables.get(name);
    return value !== undefined ? String(value) : "";
  });

  result = result.replace(/\{\{incvar::([^}]+)\}\}/gi, (_, name) => {
    const current = localVariables.get(name);
    const num = typeof current === "number" ? current : Number(current) || 0;
    localVariables.set(name, num + 1);
    return "";
  });

  result = result.replace(/\{\{decvar::([^}]+)\}\}/gi, (_, name) => {
    const current = localVariables.get(name);
    const num = typeof current === "number" ? current : Number(current) || 0;
    localVariables.set(name, num - 1);
    return "";
  });

  result = result.replace(/\{\{incglobalvar::([^}]+)\}\}/gi, (_, name) => {
    const current = globalVariables.get(name);
    const num = typeof current === "number" ? current : Number(current) || 0;
    globalVariables.set(name, num + 1);
    return "";
  });

  result = result.replace(/\{\{decglobalvar::([^}]+)\}\}/gi, (_, name) => {
    const current = globalVariables.get(name);
    const num = typeof current === "number" ? current : Number(current) || 0;
    globalVariables.set(name, num - 1);
    return "";
  });

  result = result.replace(
    /\{\{addvar::([^:}]+)::([^}]*)\}\}/gi,
    (_, name, value) => {
      const current = localVariables.get(name);
      if (current === undefined) {
        localVariables.set(name, value);
      } else if (isNumericValue(current) && isNumericValue(value)) {
        // 两边都是数字时才做数值加法
        localVariables.set(name, Number(current) + Number(value));
      } else {
        // 否则做字符串拼接
        localVariables.set(name, String(current) + value);
      }
      return "";
    },
  );

  result = result.replace(
    /\{\{addglobalvar::([^:}]+)::([^}]*)\}\}/gi,
    (_, name, value) => {
      const current = globalVariables.get(name);
      if (current === undefined) {
        globalVariables.set(name, value);
      } else if (isNumericValue(current) && isNumericValue(value)) {
        globalVariables.set(name, Number(current) + Number(value));
      } else {
        globalVariables.set(name, String(current) + value);
      }
      return "";
    },
  );

  return result;
}

/* ═══════════════════════════════════════════════════════════════════════════
   工具宏处理
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 替换工具宏 (newline, trim, noop, input)
 */
export function replaceToolMacros(content: string): string {
  let result = content;

  result = result.replace(/\{\{newline\}\}/gi, "\n");
  result = result.replace(/\{\{noop\}\}/gi, "");

  // SillyTavern: /(?:\r?\n)*{{trim}}(?:\r?\n)*/gi - 删除 {{trim}} 及周围换行符
  result = result.replace(/(?:\r?\n)*\{\{trim\}\}(?:\r?\n)*/gi, "");

  return result;
}

/**
 * 替换骰子宏 {{roll X}}
 */
export function replaceRollMacro(content: string): string {
  return content.replace(/\{\{roll\s+(\d+)\}\}/gi, (_, sides) => {
    const max = parseInt(sides, 10);
    if (isNaN(max) || max < 1) return "";
    return String(Math.floor(Math.random() * max) + 1);
  });
}

/**
 * 清理模板噪声标签与占位符
 * - 去除 <content>/<length>/<word_count>/<context> 标签
 * - 去除 ${...} 包裹
 */
export function stripTemplateNoise(content: string): string {
  const withoutTags = content.replace(/<\/?(content|length|word_count|context)>/gi, "");
  return withoutTags.replace(/\$\{([^}]+)\}/g, "$1");
}

/* ═══════════════════════════════════════════════════════════════════════════
   时间/消息/随机宏处理
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 替换时间宏
 */
export function replaceTimeMacros(content: string): string {
  const now = new Date();

  return content
    .replace(/\{\{time\}\}/gi, () =>
      now.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    )
    .replace(/\{\{date\}\}/gi, () =>
      now.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    )
    .replace(/\{\{weekday\}\}/gi, () =>
      now.toLocaleDateString(undefined, { weekday: "long" }),
    )
    .replace(/\{\{isotime\}\}/gi, () =>
      now.toTimeString().split(" ")[0],
    )
    .replace(/\{\{isodate\}\}/gi, () =>
      now.toISOString().split("T")[0],
    )
    .replace(/\{\{datetimeformat\s+([^}]+)\}\}/gi, (_, format) => {
      try {
        return new Intl.DateTimeFormat(undefined, JSON.parse(format)).format(
          now,
        );
      } catch {
        return now.toISOString();
      }
    });
}

/**
 * 替换消息宏
 */
export function replaceMessageMacros(content: string, env: MacroEnv): string {
  return content
    .replace(/\{\{lastMessage\}\}/gi, () => env.lastMessage || "")
    .replace(/\{\{lastUserMessage\}\}/gi, () => env.lastUserMessage || "")
    .replace(/\{\{lastCharMessage\}\}/gi, () => env.lastCharMessage || "")
    .replace(/\{\{lastMessageId\}\}/gi, () =>
      env.lastMessageId !== undefined ? String(env.lastMessageId) : "",
    );
}

/**
 * 替换随机宏 {{random::a::b::c}} 或 {{random a,b,c}}
 */
export function replaceRandomMacros(content: string, simpleHash: (str: string) => number): string {
  let result = content;

  result = result.replace(/\{\{random::([^}]+)\}\}/gi, (_, options) => {
    const parts = options.split("::");
    if (parts.length === 0) return "";
    return parts[Math.floor(Math.random() * parts.length)];
  });

  result = result.replace(/\{\{random\s+([^}]+)\}\}/gi, (_, options) => {
    const parts = options.split(",").map((s: string) => s.trim());
    if (parts.length === 0) return "";
    return parts[Math.floor(Math.random() * parts.length)];
  });

  result = result.replace(/\{\{pick::([^}]+)\}\}/gi, (_, options) => {
    const parts = options.split("::");
    if (parts.length === 0) return "";
    const hash = simpleHash(options);
    return parts[hash % parts.length];
  });

  result = result.replace(/\{\{pick\s+([^}]+)\}\}/gi, (_, options) => {
    const parts = options.split(",").map((s: string) => s.trim());
    if (parts.length === 0) return "";
    const hash = simpleHash(options);
    return parts[hash % parts.length];
  });

  return result;
}

/**
 * 替换注释宏 {{// ...}}
 */
export function replaceCommentMacros(content: string): string {
  return content.replace(/\{\{\/\/[^}]*\}\}/g, "");
}

/**
 * 替换反转宏 {{reverse:TEXT}}
 */
export function replaceReverseMacro(content: string): string {
  return content.replace(/\{\{reverse:([^}]+)\}\}/gi, (_, text) => {
    return text.split("").reverse().join("");
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   哈希工具
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 简单哈希函数 (用于 pick 宏的稳定选择)
 */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
