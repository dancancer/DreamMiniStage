/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    Slash Command 解析结果 / 执行结果类型                     ║
 * ║                                                                            ║
 * ║  命令解析产物、管道输出、调用元数据                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              解析结果类型
// ============================================================================

/** 单个 Slash 命令的解析结果 */
export interface SlashCommand {
  name: string;                           // 命令名，如 "send"
  args: string[];                         // 位置参数
  namedArgs: Record<string, string>;      // 命名参数 key=value
  namedArgumentList?: ParsedNamedArgument[]; // 命名参数赋值列表（保序，包含重复）
  unnamedArgumentList?: ParsedUnnamedArgument[]; // 位置参数赋值列表（保序）
  parserFlags?: ParserFlags;              // 解析期 parser flag 快照
  scopeDepth?: number;                    // 解析期作用域深度（root=0）
  raw: string;                            // 原始命令字符串，用于错误报告
}

/** 命名参数赋值（解析期元数据） */
export interface ParsedNamedArgument {
  name: string;
  value: string;
  rawValue: string;
  wasQuoted: boolean;
}

/** 位置参数赋值（解析期元数据） */
export interface ParsedUnnamedArgument {
  value: string;
  rawValue: string;
  wasQuoted: boolean;
}

/** 单次命令调用元数据（执行期透传） */
export interface CommandInvocationMeta {
  raw: string;
  namedArgumentList: ParsedNamedArgument[];
  unnamedArgumentList: ParsedUnnamedArgument[];
  blocks?: Array<{ raw: string }>;
  parserFlags?: ParserFlags;
  scopeDepth?: number;
}

/** parser flags（对齐 ST Parser 的最小子集） */
export interface ParserFlags {
  STRICT_ESCAPING: boolean;
  REPLACE_GETVAR: boolean;
}

export type ParserFlagName = keyof ParserFlags;

/** 解析器返回结果 */
export interface ParseResult {
  commands: SlashCommand[];
  isError: boolean;
  errorMessage?: string;
}

// ============================================================================
//                              执行结果类型
// ============================================================================

/** 命令执行结果 */
export interface ExecutionResult {
  pipe: string;                           // 管道输出值
  isError: boolean;
  errorMessage?: string;
  aborted?: boolean;
}

// ============================================================================
//                              命令作用域
// ============================================================================

export interface CommandScope {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  setLocal(key: string, value: unknown): void;
  delete(key: string): boolean;
}
