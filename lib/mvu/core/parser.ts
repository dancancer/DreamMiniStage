/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 命令解析器                                     ║
 * ║                                                                            ║
 * ║  从 LLM 输出中提取变量更新命令                                               ║
 * ║  设计原则：状态机解析，精确匹配括号配对                                        ║
 * ║  MagVarUpdate 完全兼容：支持 _.set() 和 <jsonpatch> 格式                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { MvuCommand, CommandName } from "../types";
import { extractJsonPatch, patchToMvuCommands } from "../json-patch";
import { parse as parseYaml } from "yaml";

// ============================================================================
//                              字符串工具
// ============================================================================

/** 去除首尾引号和反斜杠 */
export function trimQuotes(str: string): string {
  if (typeof str !== "string") return str;
  return str.replace(/^[\\"'` ]*(.*?)[\\"'` ]*$/, "$1");
}

// ============================================================================
//                              值解析
// ============================================================================

const MATH_ALIAS = Object.freeze({
  abs: Math.abs,
  acos: Math.acos,
  asin: Math.asin,
  atan: Math.atan,
  ceil: Math.ceil,
  cos: Math.cos,
  exp: Math.exp,
  floor: Math.floor,
  log: (value: number, base = Math.E): number => Math.log(value) / Math.log(base),
  log10: Math.log10,
  log2: Math.log2,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  random: Math.random,
  round: Math.round,
  sign: Math.sign,
  sin: Math.sin,
  sqrt: Math.sqrt,
  tan: Math.tan,
  trunc: Math.trunc,
  PI: Math.PI,
  E: Math.E,
  pi: Math.PI,
  e: Math.E,
});

const MATH_SCOPE: Record<string, unknown> = Object.freeze({
  Math,
  math: MATH_ALIAS,
  ...MATH_ALIAS,
});

const MATH_SCOPE_KEYS = Object.keys(MATH_SCOPE);
const MATH_SCOPE_VALUES = MATH_SCOPE_KEYS.map((key) => MATH_SCOPE[key]);
const MATH_IDENTIFIER_WHITELIST = new Set(MATH_SCOPE_KEYS);

function evaluateMathExpression(expression: string): number | undefined {
  const source = expression.trim();
  if (!source) return undefined;
  if (!/^[A-Za-z0-9_+\-*/%().,\s]+$/.test(source)) {
    return undefined;
  }

  const identifiers = source.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  for (const identifier of identifiers) {
    if (!MATH_IDENTIFIER_WHITELIST.has(identifier)) {
      return undefined;
    }
  }

  try {
    const evaluator = new Function(...MATH_SCOPE_KEYS, `"use strict"; return (${source});`);
    const result = evaluator(...MATH_SCOPE_VALUES);
    if (typeof result !== "number" || !Number.isFinite(result)) {
      return undefined;
    }
    return Number.parseFloat(result.toPrecision(12));
  } catch {
    return undefined;
  }
}

function tryParseYaml(value: string): unknown {
  if (!value.trim()) return undefined;
  try {
    return parseYaml(value);
  } catch {
    return undefined;
  }
}

/** 解析命令参数值 - 支持 JSON、布尔、数字、数学表达式 */
export function parseCommandValue(valStr: string): unknown {
  if (typeof valStr !== "string") return valStr;
  const trimmed = valStr.trim();

  // 布尔值和空值
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (trimmed === "undefined") return undefined;

  // JSON 解析
  try {
    return JSON.parse(trimmed);
  } catch {
    // 继续尝试其他解析方式
  }

  // JavaScript 对象/数组字面量
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      const result = new Function(`return ${trimmed};`)();
      if (typeof result === "object" && result !== null) return result;
    } catch {
      // 解析失败，继续
    }
  }

  // 数字
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== "") return num;

  // 数学表达式（支持 Math.* / math.* / 常用函数）
  const mathValue = evaluateMathExpression(trimmed);
  if (mathValue !== undefined) {
    return mathValue;
  }

  // YAML（用于对齐 MagVarUpdate 高频配置片段）
  const yamlValue = tryParseYaml(trimmed);
  if (yamlValue !== undefined) {
    return yamlValue;
  }

  // 返回去除引号的字符串
  return trimQuotes(valStr);
}

// ============================================================================
//                              括号匹配
// ============================================================================

/** 找到匹配的闭括号位置 */
function findMatchingCloseParen(str: string, startPos: number): number {
  let parenCount = 1;
  let inQuote = false;
  let quoteChar = "";

  for (let i = startPos; i < str.length; i++) {
    const char = str[i];
    const prevChar = i > 0 ? str[i - 1] : "";

    // 处理引号状态
    if ((char === "\"" || char === "'" || char === "`") && prevChar !== "\\") {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuote = false;
      }
    }

    // 只在不在引号内时计算括号
    if (!inQuote) {
      if (char === "(") parenCount++;
      else if (char === ")") {
        parenCount--;
        if (parenCount === 0) return i;
      }
    }
  }

  return -1;
}

/** 解析参数字符串 */
function parseParameters(paramsString: string): string[] {
  const params: string[] = [];
  let currentParam = "";
  let inQuote = false;
  let quoteChar = "";
  let bracketCount = 0;
  let braceCount = 0;
  let parenCount = 0;

  for (let i = 0; i < paramsString.length; i++) {
    const char = paramsString[i];

    // 处理引号
    if (
      (char === "\"" || char === "'" || char === "`") &&
      (i === 0 || paramsString[i - 1] !== "\\")
    ) {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuote = false;
      }
    }

    if (!inQuote) {
      if (char === "(") parenCount++;
      if (char === ")") parenCount--;
      if (char === "[") bracketCount++;
      if (char === "]") bracketCount--;
      if (char === "{") braceCount++;
      if (char === "}") braceCount--;
    }

    // 参数分隔符
    if (
      char === "," &&
      !inQuote &&
      parenCount === 0 &&
      bracketCount === 0 &&
      braceCount === 0
    ) {
      params.push(currentParam.trim());
      currentParam = "";
      continue;
    }

    currentParam += char;
  }

  if (currentParam.trim()) {
    params.push(currentParam.trim());
  }

  return params;
}

// ============================================================================
//                              命令提取
// ============================================================================

/** 从文本中提取所有 MVU 命令（MagVarUpdate 完全兼容） */
export function extractCommands(inputText: string): MvuCommand[] {
  const results: MvuCommand[] = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // 步骤1：提取 JSON Patch 并转换为命令（MagVarUpdate 兼容）
  // ═══════════════════════════════════════════════════════════════════════════
  const jsonPatch = extractJsonPatch(inputText);
  if (jsonPatch) {
    const patchCommands = patchToMvuCommands(jsonPatch);
    results.push(...patchCommands as MvuCommand[]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 步骤2：规范化空白字符（支持多行命令）
  // ═══════════════════════════════════════════════════════════════════════════
  const normalizedText = inputText.replace(/\s+/g, " ");

  // ═══════════════════════════════════════════════════════════════════════════
  // 步骤3：提取 _.set() 等函数调用格式的命令
  // ═══════════════════════════════════════════════════════════════════════════
  let i = 0;

  while (i < normalizedText.length) {
    // 匹配 _.set(、_.assign( 等命令
    const cmdMatch = normalizedText
      .substring(i)
      .match(/_\.(set|insert|assign|remove|unset|delete|add)\s*\(/);

    if (!cmdMatch || cmdMatch.index === undefined) break;

    const commandType = cmdMatch[1] as CommandName;
    const cmdStart = i + cmdMatch.index;
    const openParen = cmdStart + cmdMatch[0].length;

    // 找到匹配的闭括号
    const closeParen = findMatchingCloseParen(normalizedText, openParen);
    if (closeParen === -1) {
      i = openParen;
      continue;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 分号可选（SillyTavern 兼容）
    // ═══════════════════════════════════════════════════════════════════════════
    let endPos = closeParen + 1;
    const hasSemicolon = endPos < normalizedText.length && normalizedText[endPos] === ";";
    if (hasSemicolon) {
      endPos++;
    }

    // 提取注释（限制在下一个命令之前，或下一个空格之前）
    let comment = "";
    const commentMatch = normalizedText.substring(endPos).match(/^\s*\/\/([^_]*?)(?=\s*_\.|$)/);
    if (commentMatch) {
      comment = commentMatch[1].trim();
      endPos += commentMatch[0].length;
    }

    const fullMatch = normalizedText.substring(cmdStart, endPos);
    const paramsString = normalizedText.substring(openParen, closeParen);
    const params = parseParameters(paramsString);

    // 验证命令有效性
    const isValid = validateCommand(commandType, params);

    if (isValid) {
      const normalizedType = normalizeCommandType(commandType);
      const parsedPath = trimQuotes(params[0]);

      // ═══════════════════════════════════════════════════════════════════════
      // 解析 oldValue 和 newValue（SillyTavern 兼容）
      // ═══════════════════════════════════════════════════════════════════════
      let oldValue: unknown;
      let newValue: unknown;

      if (normalizedType === "set" || normalizedType === "insert") {
        if (params.length >= 3) {
          // _.set(path, oldValue, newValue)
          oldValue = parseCommandValue(params[1]);
          newValue = parseCommandValue(params[2]);
        } else if (params.length >= 2) {
          // _.set(path, newValue) 或 _.insert(path, value)
          newValue = parseCommandValue(params[1]);
        }
      } else if (normalizedType === "delete") {
        // _.delete(path) - 无 newValue
      } else if (normalizedType === "add") {
        // _.add(path) 或 _.add(path, delta)
        if (params.length >= 2) {
          newValue = parseCommandValue(params[1]);
        }
      }

      results.push({
        type: normalizedType,
        name: normalizedType,
        fullMatch,
        args: params,
        reason: comment,
        path: parsedPath,
        oldValue,
        newValue,
      });
    }

    i = endPos;
  }

  return results;
}

/** 验证命令参数数量 */
function validateCommand(type: CommandName, params: string[]): boolean {
  switch (type) {
  case "set":
  case "assign":
  case "insert":
    return params.length >= 2;
  case "remove":
  case "unset":
  case "delete":
    return params.length >= 1;
  case "add":
    return params.length === 1 || params.length === 2;
  default:
    return false;
  }
}

/** 标准化命令类型（处理别名） */
function normalizeCommandType(type: CommandName): CommandName {
  switch (type) {
  case "remove":
  case "unset":
    return "delete";
  case "assign":
    return "insert";
  default:
    return type;
  }
}

// ============================================================================
//                              路径修正
// ============================================================================

/** 修正变量路径格式 */
export function fixPath(path: string): string {
  if (!path) return path;

  // 处理 [] 内的内容
  const fixedBrackets = path.replace(/\[([^\]]*)\]/g, (_match, rawInner: string) => {
    let inner = rawInner.trim();
    if (!inner) return "[]";

    // 检查是否有引号
    let wasQuoted = false;
    const first = inner[0];
    const last = inner[inner.length - 1];

    if (inner.length >= 2 && (first === "\"" || first === "'") && first === last) {
      wasQuoted = true;
      inner = inner.slice(1, -1);
    }

    const isPureDigits = /^\d+$/.test(inner);
    const hasWhitespace = /\s/.test(inner);

    // 纯数字
    if (isPureDigits) {
      if (!wasQuoted) return `[${inner}]`;
      const escaped = inner.replace(/"/g, "\\\"");
      return `["${escaped}"]`;
    }

    // 非纯数字
    if (hasWhitespace) {
      const escaped = inner.replace(/"/g, "\\\"");
      return `["${escaped}"]`;
    }

    return `[${inner}]`;
  });

  // 处理点分段中被引号包裹的字段
  return fixedBrackets.replace(
    /(^|\.)(["'])([^"']*)\2(?=\.|\[|$)/g,
    (_match, prefix: string, _quote: string, name: string) => {
      const hasWhitespace = /\s/.test(name);
      const hasSpecial = /[.[\]]/.test(name);

      if (!hasWhitespace && !hasSpecial) {
        return prefix + name;
      }

      const escaped = name.replace(/"/g, "\\\"");
      return prefix === "." ? `["${escaped}"]` : `${prefix}["${escaped}"]`;
    },
  );
}
