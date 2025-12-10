/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command 内核类型                             ║
 * ║                                                                           ║
 * ║  解析器/执行器/作用域的基元定义                                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ExecutionContext } from "../types";
import type { ScopeChain } from "./scope";

// =============================================================================
//                              AST 结构
// =============================================================================

export type Script = AstNode[];

export type AstNode =
  | CommandNode
  | IfNode
  | WhileNode
  | TimesNode
  | ReturnNode
  | BreakNode
  | AbortNode;

export interface CommandNode {
  type: "command";
  name: string;
  args: string[];
  namedArgs: Record<string, string>;
  blocks: BlockArgument[];
  raw: string;
}

export interface BlockArgument {
  type: "block";
  body: Script;
  raw: string;
}

export interface IfNode {
  type: "if";
  condition: string;
  thenBlock: Script;
  elseBlock?: Script;
  raw: string;
}

export interface WhileNode {
  type: "while";
  condition: string;
  body: Script;
  raw: string;
}

export interface TimesNode {
  type: "times";
  count: string;
  body: Script;
  raw: string;
}

export interface ReturnNode {
  type: "return";
  value?: string;
  raw: string;
}

export interface BreakNode {
  type: "break";
  raw: string;
}

export interface AbortNode {
  type: "abort";
  raw: string;
}

// =============================================================================
//                              解析结果
// =============================================================================

export interface KernelParseResult {
  script: Script;
  isError: boolean;
  errorMessage?: string;
}

// =============================================================================
//                              执行模型
// =============================================================================

export type ControlSignalKind = "return" | "break" | "abort";

export interface ControlSignal {
  kind: ControlSignalKind;
  value?: string;
}

export interface ExecutionSnapshot {
  node: AstNode;
  pipe: string;
  signal?: ControlSignal;
}

export interface KernelExecutionResult {
  pipe: string;
  signal?: ControlSignal;
}

export interface ExecutorOptions {
  resolveCommand: CommandResolver;
  context: ExecutionContext;
  initialPipe?: string;
  scope?: ScopeChain;
}

// =============================================================================
//                              命令注册表契约
// =============================================================================

export type CommandHandler = (
  args: string[],
  namedArgs: Record<string, string>,
  context: ExecutionContext,
  pipe: string,
  scope: ScopeChain
) => Promise<string | void> | string | void;

export interface CommandDescriptor {
  name: string;
  aliases?: string[];
  handler: CommandHandler;
}

export type CommandResolver = (name: string) => CommandDescriptor | undefined;
