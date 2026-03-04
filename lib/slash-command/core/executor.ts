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
import {
  getDebugMonitor,
  createBreakpointEvent,
  createCommandStartEvent,
  createCommandEndEvent,
  createControlSignalEvent,
  createScopeChangeEvent,
  createScriptLifecycleEvent,
} from "./debug";

// =============================================================================
//                              对外 API
// =============================================================================

export async function* runScript(
  script: AstNode[],
  options: ExecutorOptions,
): AsyncGenerator<ExecutionSnapshot, KernelExecutionResult> {
  const monitor = getDebugMonitor();
  const startTime = Date.now();
  const scope = options.scope ?? new ScopeChain();
  let pipe = options.initialPipe ?? "";

  monitor.emit(createScriptLifecycleEvent("script:start", { nodeCount: script.length }));

  for (const node of script) {
    const execResult = await executeNode(node, { pipe, scope, options });

    pipe = execResult.pipe;
    const snapshot: ExecutionSnapshot = { node, pipe, signal: execResult.signal };
    yield snapshot;

    if (execResult.signal) {
      monitor.emit(createControlSignalEvent(execResult.signal, node));
      monitor.emit(createScriptLifecycleEvent("script:end", {
        totalDuration: Date.now() - startTime,
        finalPipe: pipe,
        aborted: execResult.signal.kind === "abort",
      }));
      return { pipe, signal: execResult.signal };
    }
  }

  monitor.emit(createScriptLifecycleEvent("script:end", {
    totalDuration: Date.now() - startTime,
    finalPipe: pipe,
  }));
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
  if (node.type === "block") return runBlock(node.body, ctx);
  if (node.type === "breakpoint") {
    getDebugMonitor().emit(createBreakpointEvent(node.raw, node.scopeDepth));
    return { pipe: ctx.pipe };
  }
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
  const monitor = getDebugMonitor();

  if (node.name === "let" || node.name === "var") {
    return handleLet(node, ctx);
  }

  const descriptor = ctx.options.resolveCommand(node.name);
  if (!descriptor) {
    return { pipe: ctx.pipe, signal: { kind: "abort", value: `Unknown command: /${node.name}` } };
  }

  const startTime = Date.now();
  monitor.emit(createCommandStartEvent(
    node.name,
    node.args,
    node.namedArgs,
    ctx.pipe,
    node.raw,
  ));

  try {
    const invocationMeta = {
      raw: node.raw,
      namedArgumentList: node.namedArgumentList,
      unnamedArgumentList: node.unnamedArgumentList,
      parserFlags: node.parserFlags,
      scopeDepth: node.scopeDepth,
    };

    const result = await descriptor.handler(
      node.args,
      node.namedArgs,
      ctx.options.context,
      ctx.pipe,
      ctx.scope,
      invocationMeta,
    );

    const nextPipe = typeof result === "string" ? result : ctx.pipe;
    monitor.emit(createCommandEndEvent(node.name, startTime, nextPipe, true));
    return { pipe: nextPipe };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    monitor.emit(createCommandEndEvent(node.name, startTime, ctx.pipe, false, message));
    return { pipe: ctx.pipe, signal: { kind: "abort", value: `Command /${node.name} failed: ${message}` } };
  }
}

async function executeIf(node: IfNode, ctx: ExecContext): Promise<ExecResult> {
  const conditionResult = evaluateCondition(node.condition, ctx);
  if (!conditionResult.ok) {
    return { pipe: ctx.pipe, signal: { kind: "abort", value: `Invalid /if condition: ${conditionResult.error}` } };
  }
  const condition = conditionResult.value;
  const block = condition ? node.thenBlock : node.elseBlock;
  if (!block) return { pipe: ctx.pipe };
  return runBlock(block, ctx);
}

async function executeWhile(node: WhileNode, ctx: ExecContext): Promise<ExecResult> {
  let pipe = ctx.pipe;
  while (true) {
    const conditionResult = evaluateCondition(node.condition, { ...ctx, pipe });
    if (!conditionResult.ok) {
      return { pipe, signal: { kind: "abort", value: `Invalid /while condition: ${conditionResult.error}` } };
    }
    if (!conditionResult.value) break;

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
  const monitor = getDebugMonitor();
  ctx.scope.push();
  const depth = ctx.scope.depth();
  monitor.emit(createScopeChangeEvent("scope:push", depth));

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
    monitor.emit(createScopeChangeEvent("scope:pop", ctx.scope.depth()));
  }
}

// =============================================================================
//                              工具函数
// =============================================================================

interface ConditionResult {
  ok: boolean;
  value: boolean;
  error?: string;
}

type Comparator = "===" | "!==" | "==" | "!=" | ">=" | "<=" | ">" | "<";

const COMPARATORS: Comparator[] = ["===", "!==", ">=", "<=", "==", "!=", ">", "<"];
const CONDITION_MACRO_PATTERN = /\{\{([^{}]+)\}\}/g;

function evaluateCondition(expr: string, ctx: ExecContext): ConditionResult {
  try {
    const normalizedExpr = preprocessConditionMacros(expr, ctx).trim();
    if (!normalizedExpr) {
      return { ok: true, value: false };
    }

    const comparator = findComparator(normalizedExpr);
    if (!comparator) {
      return { ok: true, value: toTruthy(resolveConditionValue(normalizedExpr, ctx)) };
    }

    const leftExpr = normalizedExpr.slice(0, comparator.index).trim();
    const rightExpr = normalizedExpr.slice(comparator.index + comparator.operator.length).trim();
    const leftValue = resolveConditionValue(leftExpr, ctx);
    const rightValue = resolveConditionValue(rightExpr, ctx);
    return { ok: true, value: compareConditionValues(leftValue, rightValue, comparator.operator) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, value: false, error: message };
  }
}

function preprocessConditionMacros(expr: string, ctx: ExecContext): string {
  return expr.replace(CONDITION_MACRO_PATTERN, (_match, rawMacro: string) => {
    const [macroNameRaw, ...argParts] = rawMacro.split("::");
    const macroName = macroNameRaw.trim().toLowerCase();
    const macroArg = argParts.join("::").trim();
    if (!macroArg) {
      throw new Error(`macro '${rawMacro}' missing argument`);
    }

    if (macroName === "getvar") {
      return stringifyMacroValue(ctx.options.context.getVariable(macroArg));
    }
    if (macroName === "getglobalvar") {
      const scoped = ctx.options.context.getScopedVariable?.("global", macroArg);
      const fallback = scoped !== undefined ? scoped : ctx.options.context.getVariable(macroArg);
      return stringifyMacroValue(fallback);
    }

    throw new Error(`unsupported macro '{{${rawMacro}}}'`);
  });
}

function stringifyMacroValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function findComparator(expr: string): { operator: Comparator; index: number } | null {
  for (const operator of COMPARATORS) {
    const index = expr.indexOf(operator);
    if (index > -1) {
      return { operator, index };
    }
  }
  return null;
}

function resolveConditionValue(expr: string, ctx: ExecContext): unknown {
  const symbolValue = resolveSymbolValue(expr, ctx);
  if (symbolValue.found) return symbolValue.value;

  if (expr.length >= 2) {
    const head = expr[0];
    const tail = expr[expr.length - 1];
    if ((head === "\"" && tail === "\"") || (head === "'" && tail === "'")) {
      return expr.slice(1, -1);
    }
  }

  const lowered = expr.toLowerCase();
  if (lowered === "true") return true;
  if (lowered === "false") return false;
  if (lowered === "null") return null;
  if (lowered === "undefined") return undefined;

  const numeric = Number(expr);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }

  return expr;
}

function resolveSymbolValue(expr: string, ctx: ExecContext): { found: boolean; value: unknown } {
  if (expr === "$pipe") return { found: true, value: ctx.pipe };

  const scoped = ctx.scope.get(expr);
  if (scoped !== undefined) return { found: true, value: scoped };

  const contextValue = ctx.options.context.getVariable(expr);
  if (contextValue !== undefined) return { found: true, value: contextValue };

  return { found: false, value: expr };
}

function compareConditionValues(left: unknown, right: unknown, operator: Comparator): boolean {
  if (operator === "===") return left === right;
  if (operator === "!==") return left !== right;

  if (operator === "==" || operator === "!=") {
    const equal = compareLoose(left, right);
    return operator === "==" ? equal : !equal;
  }

  const leftNumber = asNumber(left);
  const rightNumber = asNumber(right);

  if (leftNumber !== null && rightNumber !== null) {
    if (operator === ">") return leftNumber > rightNumber;
    if (operator === "<") return leftNumber < rightNumber;
    if (operator === ">=") return leftNumber >= rightNumber;
    return leftNumber <= rightNumber;
  }

  const leftText = String(left ?? "");
  const rightText = String(right ?? "");
  if (operator === ">") return leftText > rightText;
  if (operator === "<") return leftText < rightText;
  if (operator === ">=") return leftText >= rightText;
  return leftText <= rightText;
}

function compareLoose(left: unknown, right: unknown): boolean {
  const leftNumber = asNumber(left);
  const rightNumber = asNumber(right);
  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber === rightNumber;
  }
  return String(left ?? "") === String(right ?? "");
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toTruthy(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
  const normalized = String(value).toLowerCase().trim();
  if (
    normalized === "" ||
    normalized === "0" ||
    normalized === "false" ||
    normalized === "null" ||
    normalized === "undefined"
  ) {
    return false;
  }
  return true;
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
