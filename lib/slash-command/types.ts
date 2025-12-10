/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command 类型定义                             ║
 * ║                                                                            ║
 * ║  定义命令解析、执行的核心数据结构                                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { DialogueMessage } from "@/types/character-dialogue";

export interface SendOptions {
  at?: number;
  name?: string;
  compact?: boolean;
  returnType?: string;
}

// ============================================================================
//                              解析结果类型
// ============================================================================

/** 单个 Slash 命令的解析结果 */
export interface SlashCommand {
  name: string;                           // 命令名，如 "send"
  args: string[];                         // 位置参数
  namedArgs: Record<string, string>;      // 命名参数 key=value
  raw: string;                            // 原始命令字符串，用于错误报告
}

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
//                              执行上下文类型
// ============================================================================

/** 命令执行所需的上下文 */
export interface ExecutionContext {
  characterId?: string;
  messages: DialogueMessage[];
  onSend: (text: string, options?: SendOptions) => void | Promise<void>;
  onTrigger: (member?: string) => void | Promise<void>;
  onSendAs?: (role: string, text: string) => void | Promise<void>;
  onSendSystem?: (text: string) => void | Promise<void>;
  onImpersonate?: (text: string) => void | Promise<void>;
  onContinue?: () => void | Promise<void>;
  onSwipe?: (target?: string) => void | Promise<void>;
  getVariable: (key: string) => unknown;
  setVariable: (key: string, value: unknown) => void;
  deleteVariable: (key: string) => void;
}

// ============================================================================
//                              命令处理器类型
// ============================================================================

/** 单个命令的处理函数签名 */
export type CommandHandler = (
  args: string[],
  namedArgs: Record<string, string>,
  context: ExecutionContext,
  pipe: string
) => Promise<string>;
