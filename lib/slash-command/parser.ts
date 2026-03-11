/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command 解析器                               ║
 * ║                                                                            ║
 * ║  将命令字符串解析为可执行的命令序列                                          ║
 * ║  支持管道操作符 | 进行命令链式调用                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { SlashCommand, ParseResult } from "./types";

const DEFAULT_PARSER_FLAGS = {
  STRICT_ESCAPING: false,
  REPLACE_GETVAR: false,
};

// ============================================================================
//                              解析器实现
// ============================================================================

/**
 * 解析单个命令字符串
 * 格式: /command arg1 arg2 key=value key2="quoted value"
 */
function parseSingleCommand(raw: string): SlashCommand | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;

  // 提取命令名
  const spaceIndex = trimmed.indexOf(" ");
  const name = spaceIndex === -1 
    ? trimmed.slice(1) 
    : trimmed.slice(1, spaceIndex);
  
  if (!name) return null;

  const argsStr = spaceIndex === -1 ? "" : trimmed.slice(spaceIndex + 1);
  const {
    args,
    namedArgs,
    namedArgumentList,
    unnamedArgumentList,
  } = parseArguments(argsStr);

  return {
    name,
    args,
    namedArgs,
    namedArgumentList,
    unnamedArgumentList,
    parserFlags: { ...DEFAULT_PARSER_FLAGS },
    scopeDepth: 0,
    raw: trimmed,
  };
}

/**
 * 解析参数字符串
 * 支持: 位置参数、命名参数 key=value、引号包裹的值
 */
function parseArguments(argsStr: string): { 
  args: string[]; 
  namedArgs: Record<string, string>; 
  namedArgumentList: SlashCommand["namedArgumentList"];
  unnamedArgumentList: SlashCommand["unnamedArgumentList"];
} {
  const args: string[] = [];
  const namedArgs: Record<string, string> = Object.create(null);
  const namedArgumentList: NonNullable<SlashCommand["namedArgumentList"]> = [];
  const unnamedArgumentList: NonNullable<SlashCommand["unnamedArgumentList"]> = [];
  
  if (!argsStr.trim()) {
    return { args, namedArgs, namedArgumentList, unnamedArgumentList };
  }

  const tokens = tokenize(argsStr);
  
  for (const token of tokens) {
    const eqIndex = token.raw.indexOf("=");
    if (eqIndex > 0) {
      // 命名参数: key=value（保留赋值顺序）
      const key = token.raw.slice(0, eqIndex);
      const rawValue = token.raw.slice(eqIndex + 1);
      const parsed = parseRawLiteral(rawValue);
      const value = parsed.value;
      namedArgs[key] = value;
      namedArgumentList.push({
        name: key,
        value,
        rawValue,
        wasQuoted: parsed.wasQuoted,
      });
    } else {
      // 位置参数
      args.push(token.value);
      unnamedArgumentList.push({
        value: token.value,
        rawValue: token.raw,
        wasQuoted: token.wasQuoted,
      });
    }
  }

  return { args, namedArgs, namedArgumentList, unnamedArgumentList };
}

/**
 * 分词器：处理引号和空格
 */
interface ArgumentToken {
  raw: string;
  value: string;
  wasQuoted: boolean;
}

function tokenize(input: string): ArgumentToken[] {
  const tokens: ArgumentToken[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  const pushToken = () => {
    if (!current) return;
    const parsed = parseRawLiteral(current);
    tokens.push({
      raw: current,
      value: parsed.value,
      wasQuoted: parsed.wasQuoted,
    });
    current = "";
  };

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (!inQuote && (char === "\"" || char === "\'")) {
      inQuote = true;
      quoteChar = char;
      current += char;
    } else if (inQuote && char === quoteChar) {
      inQuote = false;
      current += char;
      quoteChar = "";
    } else if (!inQuote && char === " ") {
      pushToken();
    } else {
      current += char;
    }
  }

  pushToken();
  return tokens;
}

/**
 * 移除引号包裹
 */
function parseRawLiteral(raw: string): { value: string; wasQuoted: boolean } {
  const trimmed = raw.trim();
  if (trimmed.length >= 2) {
    const head = trimmed[0];
    const tail = trimmed[trimmed.length - 1];
    const quoted = (head === "\"" && tail === "\"") || (head === "'" && tail === "'");
    if (quoted) {
      return {
        value: trimmed.slice(1, -1),
        wasQuoted: true,
      };
    }
  }
  return {
    value: trimmed,
    wasQuoted: false,
  };
}

// ============================================================================
//                              公开 API
// ============================================================================

/**
 * 解析 Slash 命令字符串
 * 支持管道操作符 | 连接多个命令
 * 
 * @example
 * parseSlashCommands("/send Hello|/trigger")
 * // => { commands: [{name: "send", args: ["Hello"]}, {name: "trigger", args: []}], isError: false }
 */
export function parseSlashCommands(input: string): ParseResult {
  const trimmed = input.trim();
  
  if (!trimmed) {
    return { commands: [], isError: true, errorMessage: "Empty command string" };
  }

  // 按管道符分割，但要注意引号内的管道符
  const rawCommands = splitByPipe(trimmed);
  const commands: SlashCommand[] = [];

  for (let i = 0; i < rawCommands.length; i++) {
    const raw = rawCommands[i].trim();
    if (!raw) continue;

    const cmd = parseSingleCommand(raw);
    if (!cmd) {
      return {
        commands: [],
        isError: true,
        errorMessage: `Invalid command at position ${i + 1}: "${raw}"`,
      };
    }
    commands.push(cmd);
  }

  if (commands.length === 0) {
    return { commands: [], isError: true, errorMessage: "No valid commands found" };
  }

  return { commands, isError: false };
}

/**
 * 按管道符分割，忽略引号内的管道符
 */
function splitByPipe(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (!inQuote && (char === "\"" || char === "\'")) {
      inQuote = true;
      quoteChar = char;
      current += char;
    } else if (inQuote && char === quoteChar) {
      inQuote = false;
      current += char;
      quoteChar = "";
    } else if (!inQuote && char === "|") {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  if (current) parts.push(current);
  return parts;
}

/**
 * 将解析后的命令序列转回字符串（用于测试 round-trip）
 */
export function stringifySlashCommands(commands: SlashCommand[]): string {
  return commands.map(cmd => {
    const parts = [`/${cmd.name}`];
    
    // 位置参数
    for (const arg of cmd.args) {
      parts.push(arg.includes(" ") ? `"${arg}"` : arg);
    }
    
    // 命名参数
    for (const [key, value] of Object.entries(cmd.namedArgs)) {
      const quotedValue = value.includes(" ") ? `"${value}"` : value;
      parts.push(`${key}=${quotedValue}`);
    }
    
    return parts.join(" ");
  }).join("|");
}
