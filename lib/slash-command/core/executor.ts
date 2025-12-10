/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command 内核执行器                           ║
 * ║                                                                           ║
 * ║  Generator 执行模型，支持控制信号与作用域                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  AstNode,
  CommandNode,
  ControlSignal,
  ExecutionSnapshot,
  ExecutorOptions,
  IfNode,
  KernelExecutionResult,
  TimesNode,
  WhileNode,
} from "./types";
import { ScopeChain } from "./scope";

// =============================================================================
//                              对外 API
// =============================================================================

export async function* runScript(
  script: AstNode[],
  options: ExecutorOptions,
): AsyncGenerator<ExecutionSnapshot, KernelExecutionResult> {
  const scope = options.scope ?? new ScopeChain();
  let pipe = options.initialPipe ?? "";

  for (const node of script) {
    const execResult = await executeNode(node, {
      pipe,
      scope,
      options,
    });

    pipe = execResult.pipe;
    const snapshot: ExecutionSnapshot = { node, pipe, signal: execResult.signal };
    yield snapshot;

    if (execResult.signal) {
      return { pipe, signal: execResult.signal };
    }
  }

  return { pipe };
}

export async function executeScript(
  script: AstNode[],
  options: ExecutorOptions,
): Promise<KernelExecutionResult> {
  let latest: KernelExecutionResult = { pipe: options.initialPipe ?? "" };
  for await (const step of runScript(script, options)) {
    latest = { pipe: step.pipe, signal: step.signal };
  }
  return latest;
}

// =============================================================================
//                              节点执行
// =============================================================================

interface ExecContext {
  pipe: string;
  scope: ScopeChain;
  options: ExecutorOptions;
}

interface ExecResult {
  pipe: string;
  signal?: ControlSignal;
}

async function executeNode(node: AstNode, ctx: ExecContext): Promise<ExecResult> {
  if (node.type === "command") return executeCommand(node, ctx);
  if (node.type === "if") return executeIf(node, ctx);
  if (node.type === "while") return executeWhile(node, ctx);
  if (node.type === "times") return executeTimes(node, ctx);
  if (node.type === "return") {
    const value = node.value ?? ctx.pipe;
    return { pipe: value, signal: { kind: "return", value } };
  }
  if (node.type === "break") return { pipe: ctx.pipe, signal: { kind: "break" } };
  if (node.type === "abort") return { pipe: ctx.pipe, signal: { kind: "abort" } };
  return { pipe: ctx.pipe };
}

async function executeCommand(node: CommandNode, ctx: ExecContext): Promise<ExecResult> {
  if (node.name === "let" || node.name === "var") {
    return handleLet(node, ctx);
  }

  const descriptor = ctx.options.resolveCommand(node.name);
  if (!descriptor) {
    return { pipe: ctx.pipe, signal: { kind: "abort", value: `Unknown command: /${node.name}` } };
  }

  try {
    const result = await descriptor.handler(
      node.args,
      node.namedArgs,
      ctx.options.context,
      ctx.pipe,
      ctx.scope,
    );

    const nextPipe = typeof result === "string" ? result : ctx.pipe;
    return { pipe: nextPipe };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { pipe: ctx.pipe, signal: { kind: "abort", value: `Command /${node.name} failed: ${message}` } };
  }
}

async function executeIf(node: IfNode, ctx: ExecContext): Promise<ExecResult> {
  const condition = resolveTruth(node.condition, ctx);
  const block = condition ? node.thenBlock : node.elseBlock;
  if (!block) return { pipe: ctx.pipe };
  return runBlock(block, ctx);
}

async function executeWhile(node: WhileNode, ctx: ExecContext): Promise<ExecResult> {
  let pipe = ctx.pipe;
  while (resolveTruth(node.condition, { ...ctx, pipe })) {
    const blockResult = await runBlock(node.body, { ...ctx, pipe });
    pipe = blockResult.pipe;
    if (blockResult.signal?.kind === "return" || blockResult.signal?.kind === "abort") {
      return blockResult;
    }
    if (blockResult.signal?.kind === "break") {
      return { pipe };
    }
  }
  return { pipe };
}

async function executeTimes(node: TimesNode, ctx: ExecContext): Promise<ExecResult> {
  const count = parseCount(node.count);
  let pipe = ctx.pipe;
  for (let i = 0; i < count; i++) {
    const blockResult = await runBlock(node.body, { ...ctx, pipe });
    pipe = blockResult.pipe;
    if (blockResult.signal?.kind === "return" || blockResult.signal?.kind === "abort") {
      return blockResult;
    }
    if (blockResult.signal?.kind === "break") {
      return { pipe };
    }
  }
  return { pipe };
}

async function runBlock(body: AstNode[], ctx: ExecContext): Promise<ExecResult> {
  ctx.scope.push();
  try {
    let pipe = ctx.pipe;
    for (const node of body) {
      const result = await executeNode(node, { ...ctx, pipe });
      pipe = result.pipe;
      if (result.signal) return { pipe, signal: result.signal };
    }
    return { pipe };
  } finally {
    ctx.scope.pop();
  }
}

// =============================================================================
//                              工具函数
// =============================================================================

function resolveTruth(expr: string, ctx: ExecContext): boolean {
  const value = resolveValue(expr, ctx);
  if (value === undefined || value === null) return false;
  const str = String(value).toLowerCase().trim();
  if (str === "" || str === "0" || str === "false" || str === "null") return false;
  return true;
}

function resolveValue(expr: string, ctx: ExecContext): unknown {
  if (expr === "$pipe") return ctx.pipe;
  const scoped = ctx.scope.get(expr);
  if (scoped !== undefined) return scoped;
  return expr;
}

function parseCount(count: string): number {
  const n = Number.parseInt(count, 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return n;
}

function handleLet(node: CommandNode, ctx: ExecContext): ExecResult {
  const assignments: Array<[string, string]> = [];

  if (Object.keys(node.namedArgs).length > 0) {
    for (const [k, v] of Object.entries(node.namedArgs)) {
      assignments.push([k, v]);
    }
  } else if (node.args.length >= 2) {
    const [key, ...rest] = node.args;
    assignments.push([key, rest.join(" ")]);
  } else if (node.args.length === 1 && node.args[0].includes("=")) {
    const [key, ...rest] = node.args[0].split("=");
    assignments.push([key, rest.join("=")]);
  } else if (node.args.length === 1 && ctx.pipe) {
    assignments.push([node.args[0], ctx.pipe]);
  }

  let last = ctx.pipe;
  for (const [k, v] of assignments) {
    ctx.scope.setLocal(k, v);
    last = v;
  }

  return { pipe: last };
}
