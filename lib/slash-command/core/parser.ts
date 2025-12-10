/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command 内核解析器                           ║
 * ║                                                                           ║
 * ║  递归下降解析，支持管道与闭包 `{: ... :}`                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  AstNode,
  BlockArgument,
  CommandNode,
  IfNode,
  KernelParseResult,
  Script,
  TimesNode,
  WhileNode,
} from "./types";

// =============================================================================
//                              公共 API
// =============================================================================

export function parseKernelScript(input: string): KernelParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { script: [], isError: true, errorMessage: "Empty command string" };
  }

  const segments = splitTopLevel(trimmed, "|");
  const script: Script = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i].trim();
    if (!segment) continue;
    const node = parseSegment(segment);
    if (!node.ok) {
      return {
        script: [],
        isError: true,
        errorMessage: `Parse error at segment ${i + 1}: ${node.error}`,
      };
    }
    script.push(node.value);
  }

  if (script.length === 0) {
    return { script: [], isError: true, errorMessage: "No valid commands found" };
  }

  return { script, isError: false };
}

// =============================================================================
//                              段解析
// =============================================================================

type Token = WordToken | BlockToken;

interface WordToken {
  kind: "word";
  value: string;
  raw: string;
}

interface BlockToken {
  kind: "block";
  value: string; // 内部脚本
  raw: string;   // 包含 {: :}
}

interface ParseOk<T> {
  ok: true;
  value: T;
}

interface ParseErr {
  ok: false;
  error: string;
}

type ParseResult<T> = ParseOk<T> | ParseErr;

function parseSegment(segment: string): ParseResult<AstNode> {
  const tokens = tokenize(segment);
  if (tokens.length === 0) {
    return { ok: false, error: "Empty segment" };
  }

  const head = tokens[0];
  if (head.kind !== "word" || !head.value.startsWith("/")) {
    return { ok: false, error: `Invalid command head: ${head.raw}` };
  }

  const name = head.value.slice(1).toLowerCase();
  const args: string[] = [];
  const namedArgs: Record<string, string> = {};
  const blocks: BlockArgument[] = [];

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.kind === "block") {
      const parsed = parseKernelScript(token.value);
      if (parsed.isError) {
        return { ok: false, error: parsed.errorMessage ?? "Invalid block" };
      }
      blocks.push({ type: "block", body: parsed.script, raw: token.raw });
      continue;
    }

    const eqIndex = token.value.indexOf("=");
    if (eqIndex > 0) {
      const key = token.value.slice(0, eqIndex);
      const value = token.value.slice(eqIndex + 1);
      namedArgs[key] = value;
      continue;
    }

    args.push(token.value);
  }

  const baseCommand: CommandNode = {
    type: "command",
    name,
    args,
    namedArgs,
    blocks,
    raw: segment,
  };

  return wrapControlNode(baseCommand);
}

// =============================================================================
//                              控制节点转换
// =============================================================================

function wrapControlNode(cmd: CommandNode): ParseResult<AstNode> {
  if (cmd.name === "if") return buildIf(cmd);
  if (cmd.name === "while") return buildWhile(cmd);
  if (cmd.name === "times") return buildTimes(cmd);
  if (cmd.name === "return") return { ok: true, value: { type: "return", value: cmd.args[0], raw: cmd.raw } };
  if (cmd.name === "break") return { ok: true, value: { type: "break", raw: cmd.raw } };
  if (cmd.name === "abort") return { ok: true, value: { type: "abort", raw: cmd.raw } };
  return { ok: true, value: cmd };
}

function buildIf(cmd: CommandNode): ParseResult<IfNode> {
  if (!cmd.args[0]) return { ok: false, error: "Missing condition for /if" };
  if (!cmd.blocks[0]) return { ok: false, error: "Missing then block for /if" };

  const elseBlock = cmd.blocks[1]?.body;
  return {
    ok: true,
    value: {
      type: "if",
      condition: cmd.args[0],
      thenBlock: cmd.blocks[0].body,
      elseBlock,
      raw: cmd.raw,
    },
  };
}

function buildWhile(cmd: CommandNode): ParseResult<WhileNode> {
  if (!cmd.args[0]) return { ok: false, error: "Missing condition for /while" };
  if (!cmd.blocks[0]) return { ok: false, error: "Missing body block for /while" };

  return {
    ok: true,
    value: {
      type: "while",
      condition: cmd.args[0],
      body: cmd.blocks[0].body,
      raw: cmd.raw,
    },
  };
}

function buildTimes(cmd: CommandNode): ParseResult<TimesNode> {
  if (!cmd.args[0]) return { ok: false, error: "Missing count for /times" };
  if (!cmd.blocks[0]) return { ok: false, error: "Missing body block for /times" };

  return {
    ok: true,
    value: {
      type: "times",
      count: cmd.args[0],
      body: cmd.blocks[0].body,
      raw: cmd.raw,
    },
  };
}

// =============================================================================
//                              分段工具
// =============================================================================

function splitTopLevel(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";
  let blockDepth = 0;

  for (let i = 0; i < input.length; i++) {
    const two = input.slice(i, i + 2);
    if (!inQuote && two === "{:") {
      blockDepth += 1;
      current += two;
      i += 1;
      continue;
    }

    if (!inQuote && two === ":}" && blockDepth > 0) {
      blockDepth -= 1;
      current += two;
      i += 1;
      continue;
    }

    const ch = input[i];
    if (!inQuote && (ch === "\"" || ch === "'")) {
      inQuote = true;
      quoteChar = ch;
      current += ch;
      continue;
    }

    if (inQuote && ch === quoteChar) {
      inQuote = false;
      quoteChar = "";
      current += ch;
      continue;
    }

    if (!inQuote && blockDepth === 0 && ch === delimiter) {
      parts.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  if (current) parts.push(current);
  return parts;
}

// =============================================================================
//                              分词
// =============================================================================

function tokenize(segment: string): Token[] {
  const tokens: Token[] = [];
  let buffer = "";
  let inQuote = false;
  let quoteChar = "";
  let i = 0;

  const flushWord = () => {
    const value = buffer.trim();
    if (value) tokens.push({ kind: "word", value: stripQuotes(value), raw: value });
    buffer = "";
  };

  while (i < segment.length) {
    if (!inQuote && segment.startsWith("{:", i)) {
      flushWord();
      const block = readBlock(segment, i + 2);
      if (!block.ok) return [];
      tokens.push({
        kind: "block",
        value: block.value.content.trim(),
        raw: `{:${block.value.content}:}`,
      });
      i = block.value.nextIndex;
      continue;
    }

    const ch = segment[i];
    if (!inQuote && (ch === "\"" || ch === "'")) {
      inQuote = true;
      quoteChar = ch;
      buffer += ch;
      i += 1;
      continue;
    }

    if (inQuote && ch === quoteChar) {
      inQuote = false;
      quoteChar = "";
      buffer += ch;
      i += 1;
      continue;
    }

    if (!inQuote && /\s/.test(ch)) {
      flushWord();
      i += 1;
      continue;
    }

    buffer += ch;
    i += 1;
  }

  flushWord();
  return tokens;
}

function readBlock(segment: string, start: number): ParseResult<{ content: string; nextIndex: number }> {
  let depth = 1;
  let i = start;
  let content = "";

  while (i < segment.length) {
    if (segment.startsWith("{:", i)) {
      depth += 1;
      content += "{:";
      i += 2;
      continue;
    }
    if (segment.startsWith(":}", i)) {
      depth -= 1;
      if (depth === 0) {
        return { ok: true, value: { content, nextIndex: i + 2 } };
      }
      content += ":}";
      i += 2;
      continue;
    }
    content += segment[i];
    i += 1;
  }

  return { ok: false, error: "Unclosed block" };
}

function stripQuotes(value: string): string {
  if (value.length < 2) return value;
  const head = value[0];
  const tail = value[value.length - 1];
  if ((head === "\"" && tail === "\"") || (head === "'" && tail === "'")) {
    return value.slice(1, -1);
  }
  return value;
}
