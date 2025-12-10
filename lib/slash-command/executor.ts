/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command 执行器                               ║
 * ║                                                                            ║
 * ║  通过内核执行器运行命令序列，支持控制信号与管道                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { executeScript } from "./core/executor";
import { parseKernelScript } from "./core/parser";
import { ScopeChain } from "./core/scope";
import type { AstNode, CommandDescriptor } from "./core/types";
import type { SlashCommand, ExecutionResult, ExecutionContext, SendOptions } from "./types";
import { getCommandHandler } from "./registry";

// ============================================================================
//                              兼容层（旧命令 -> 内核）
// ============================================================================

function toAst(commands: SlashCommand[]): AstNode[] {
  return commands.map(mapCommandToAst);
}

function makeResolver(): (name: string) => CommandDescriptor | undefined {
  return (name: string) => {
    const handler = getCommandHandler(name);
    if (!handler) return undefined;
    return {
      name,
      handler: (args, namedArgs, context, pipe, _scope) =>
        handler(args, namedArgs, context, pipe),
    };
  };
}

function adaptKernelResult(pipe: string, signal?: { kind: string; value?: string }): ExecutionResult {
  if (signal?.kind === "abort") {
    return {
      pipe,
      isError: true,
      errorMessage: signal.value ?? "Aborted",
      aborted: true,
    };
  }
  return { pipe, isError: false };
}

function mapCommandToAst(cmd: SlashCommand): AstNode {
  const name = cmd.name.toLowerCase();
  if (name === "return") {
    return { type: "return", value: cmd.args[0], raw: cmd.raw };
  }
  if (name === "break") {
    return { type: "break", raw: cmd.raw };
  }
  if (name === "abort") {
    return { type: "abort", raw: cmd.raw };
  }
  return {
    type: "command",
    name: cmd.name,
    args: cmd.args,
    namedArgs: cmd.namedArgs,
    blocks: [],
    raw: cmd.raw,
  };
}

// ============================================================================
//                              执行 API
// ============================================================================

/** 兼容旧接口：接受已解析命令数组 */
export async function executeSlashCommands(
  commands: SlashCommand[],
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const resolver = makeResolver();
  const scope = new ScopeChain();
  const script = toAst(commands);
  const result = await executeScript(script, { resolveCommand: resolver, context: ctx, scope });
  return adaptKernelResult(result.pipe, result.signal);
}

/** 新接口：直接接收命令脚本字符串，使用内核解析器 */
export async function executeSlashCommandScript(
  input: string,
  ctx: ExecutionContext,
): Promise<ExecutionResult> {
  const parsed = parseKernelScript(input);
  if (parsed.isError) {
    return { pipe: "", isError: true, errorMessage: parsed.errorMessage };
  }
  const resolver = makeResolver();
  const scope = new ScopeChain();
  const result = await executeScript(parsed.script, { resolveCommand: resolver, context: ctx, scope });
  return adaptKernelResult(result.pipe, result.signal);
}

/**
 * 创建一个最小化的执行上下文（用于测试）
 */
export function createMinimalContext(
  overrides: Partial<ExecutionContext> = {},
): ExecutionContext {
  const variables = new Map<string, unknown>();
  
  return {
    messages: [],
    onSend: async (_text: string, _options?: SendOptions) => {},
    onTrigger: async (_member?: string) => {},
    getVariable: (key) => variables.get(key),
    setVariable: (key, value) => { variables.set(key, value); },
    deleteVariable: (key) => { variables.delete(key); },
    ...overrides,
  };
}
