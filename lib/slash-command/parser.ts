/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command 解析器                               ║
 * ║                                                                            ║
 * ║  将命令字符串解析为可执行的命令序列                                          ║
 * ║  支持管道操作符 | 进行命令链式调用                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { SlashCommand, ParseResult } from "./types";

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
  const { args, namedArgs } = parseArguments(argsStr);

  return { name, args, namedArgs, raw: trimmed };
}

/**
 * 解析参数字符串
 * 支持: 位置参数、命名参数 key=value、引号包裹的值
 */
function parseArguments(argsStr: string): { 
  args: string[]; 
  namedArgs: Record<string, string>; 
} {
  const args: string[] = [];
  const namedArgs: Record<string, string> = {};
  
  if (!argsStr.trim()) return { args, namedArgs };

  const tokens = tokenize(argsStr);
  
  for (const token of tokens) {
    const eqIndex = token.indexOf("=");
    if (eqIndex > 0) {
      // 命名参数: key=value
      const key = token.slice(0, eqIndex);
      const value = unquote(token.slice(eqIndex + 1));
      namedArgs[key] = value;
    } else {
      // 位置参数
      args.push(unquote(token));
    }
  }

  return { args, namedArgs };
}

/**
 * 分词器：处理引号和空格
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
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
    } else if (!inQuote && char === " ") {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current) tokens.push(current);
  return tokens;
}

/**
 * 移除引号包裹
 */
function unquote(str: string): string {
  const trimmed = str.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("\'") && trimmed.endsWith("\'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
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
