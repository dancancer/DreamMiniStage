/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║               Reasoning & Injection Command Handlers                     ║
 * ║                                                                          ║
 * ║  推理块 - get-reasoning / set-reasoning / reasoning-parse / listinjects  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../../types";
import type { ReasoningParseResult } from "../../../types";
import { parseBoolean } from "../../utils/helpers";

/* ═══════════════════════════════════════════════════════════════════════════
   常量与解析工具
   ═══════════════════════════════════════════════════════════════════════════ */

const REASONING_TAG_PAIRS = [
  { open: "<thinking>", close: "</thinking>" },
  { open: "<think>", close: "</think>" },
  { open: "<reasoning>", close: "</reasoning>" },
  { open: "<thought>", close: "</thought>" },
  { open: "<内心>", close: "</内心>" },
  { open: "<思考>", close: "</思考>" },
];

function resolveReasoningMessageIndex(
  raw: string | undefined,
  messages: Array<{ content: string }>,
  commandName: "get-reasoning" | "set-reasoning",
): number {
  if (messages.length === 0) {
    throw new Error(`/${commandName} requires at least one message`);
  }

  if (!raw || raw.trim().length === 0) {
    return messages.length - 1;
  }

  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`/${commandName} invalid message index: ${raw}`);
  }
  if (parsed >= messages.length) {
    throw new Error(`/${commandName} message index out of range: ${parsed}`);
  }
  return parsed;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseReasoningReturnType(raw: string | undefined): "reasoning" | "content" {
  const normalized = (raw || "reasoning").trim().toLowerCase();
  if (normalized === "reasoning" || normalized === "content") {
    return normalized;
  }
  throw new Error(`/parse-reasoning invalid return value: ${raw || ""}`);
}

function parseReasoningBooleanOption(
  raw: string | undefined,
  optionName: "strict" | "regex",
): boolean {
  if (raw === undefined) {
    return true;
  }

  const parsed = parseBoolean(raw, undefined);
  if (parsed === undefined) {
    throw new Error(`/parse-reasoning invalid ${optionName} value: ${raw}`);
  }
  return parsed;
}

function normalizeReasoningParseResult(commandName: string, value: unknown): ReasoningParseResult | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`/${commandName} host returned invalid reasoning parse result`);
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.reasoning !== "string" || typeof raw.content !== "string") {
    throw new Error(`/${commandName} host returned invalid reasoning parse payload`);
  }

  return {
    reasoning: raw.reasoning,
    content: raw.content,
  };
}

function parseReasoningBlockFromText(
  input: string,
  options: { strict: boolean },
): ReasoningParseResult | null {
  let matchStart = Number.MAX_SAFE_INTEGER;
  let matchEnd = -1;
  let reasoning = "";

  for (const pair of REASONING_TAG_PAIRS) {
    const pattern = options.strict
      ? `^\\s*${escapeRegex(pair.open)}([\\s\\S]*?)${escapeRegex(pair.close)}`
      : `${escapeRegex(pair.open)}([\\s\\S]*?)${escapeRegex(pair.close)}`;
    const matcher = new RegExp(pattern);
    const match = matcher.exec(input);
    if (!match) {
      continue;
    }

    if (match.index < matchStart) {
      matchStart = match.index;
      matchEnd = match.index + match[0].length;
      reasoning = (match[1] || "").trim();
      if (options.strict && match.index === 0) {
        break;
      }
    }
  }

  if (matchEnd <= matchStart) {
    return null;
  }

  const content = `${input.slice(0, matchStart)}${input.slice(matchEnd)}`.trim();
  return { reasoning, content };
}

function normalizeInjectionRecord(record: unknown): Record<string, unknown> {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("/listinjects host returned invalid injection record");
  }

  const raw = record as Record<string, unknown>;
  if (typeof raw.id !== "string" || raw.id.trim().length === 0) {
    throw new Error("/listinjects host returned injection with invalid id");
  }
  if (typeof raw.content !== "string") {
    throw new Error(`/listinjects host returned injection ${raw.id} with invalid content`);
  }

  return {
    id: raw.id,
    content: raw.content,
    role: typeof raw.role === "string" ? raw.role : "system",
    position: typeof raw.position === "string" ? raw.position : "in_chat",
    depth: typeof raw.depth === "number" ? raw.depth : 0,
    should_scan: raw.should_scan === true,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   命令处理器
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * /get-reasoning [index] - 获取消息推理块
 * SillyTavern 语义：默认读取最后一条消息的 reasoning 内容。
 */
export const handleGetReasoning: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const messages = ctx.messages ?? [];
  const index = resolveReasoningMessageIndex(args[0] || namedArgs.at || pipe, messages, "get-reasoning");

  if (ctx.getMessageReasoning) {
    const reasoning = await Promise.resolve(ctx.getMessageReasoning(index));
    if (reasoning === undefined || reasoning === null) {
      return "";
    }
    if (typeof reasoning !== "string") {
      throw new Error("/get-reasoning host returned non-string reasoning");
    }
    return reasoning;
  }

  return messages[index]?.thinkingContent || "";
};

/**
 * /set-reasoning [text] - 设置消息推理块
 * SillyTavern 语义：默认写入最后一条消息，可通过 at= 指定索引。
 */
export const handleSetReasoning: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const messages = ctx.messages ?? [];
  const index = resolveReasoningMessageIndex(namedArgs.at, messages, "set-reasoning");
  const reasoning = args.join(" ") || pipe || "";

  const collapse = parseBoolean(namedArgs.collapse, undefined);
  if (namedArgs.collapse !== undefined && collapse === undefined) {
    throw new Error(`/set-reasoning invalid collapse value: ${namedArgs.collapse}`);
  }

  if (ctx.setMessageReasoning) {
    await Promise.resolve(ctx.setMessageReasoning(index, reasoning, { collapse }));
    return reasoning;
  }

  const message = messages[index];
  if (!message) {
    throw new Error(`/set-reasoning message index out of range: ${index}`);
  }
  message.thinkingContent = reasoning;
  return reasoning;
};

/**
 * /reasoning-parse [text] - 解析文本中的 reasoning block
 * 别名：/parse-reasoning
 */
export const handleReasoningParse: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const source = args.join(" ") || namedArgs.text || namedArgs.value || pipe || "";
  if (!source) {
    return "";
  }

  const strict = parseReasoningBooleanOption(namedArgs.strict, "strict");
  const applyRegex = parseReasoningBooleanOption(namedArgs.regex, "regex");
  const returnType = parseReasoningReturnType(namedArgs.return);
  const parsed = ctx.parseReasoningBlock
    ? normalizeReasoningParseResult(
      "parse-reasoning",
      await Promise.resolve(ctx.parseReasoningBlock(source, { strict })),
    )
    : parseReasoningBlockFromText(source, { strict });

  if (!parsed) {
    return returnType === "content" ? source : "";
  }

  if (returnType === "content") {
    return parsed.content;
  }

  let reasoning = parsed.reasoning;
  if (applyRegex && ctx.applyReasoningRegex) {
    const regexed = await Promise.resolve(ctx.applyReasoningRegex(reasoning));
    if (typeof regexed !== "string") {
      throw new Error("/parse-reasoning host returned non-string regex result");
    }
    reasoning = regexed;
  }

  return reasoning;
};

/**
 * /listinjects - 列出当前会话注入项
 * SillyTavern 语义：返回注入对象；这里统一返回 JSON 字符串。
 */
export const handleListInjects: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.listPromptInjections) {
    throw new Error("/listinjects is not available in current context");
  }

  const injections = await Promise.resolve(ctx.listPromptInjections());
  if (!Array.isArray(injections)) {
    throw new Error("/listinjects host returned non-array injections");
  }

  return JSON.stringify(injections.map(normalizeInjectionRecord));
};

/**
 * /flushinject [id] - 删除当前会话注入项
 * 别名：/flushinjects
 * SillyTavern 语义：无返回值（空字符串）；未提供 id 时删除全部。
 */
export const handleFlushInjects: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.removePromptInjections) {
    throw new Error("/flushinject is not available in current context");
  }

  const targetId = (args[0] || namedArgs.id || pipe || "").trim() || undefined;
  const removed = await Promise.resolve(ctx.removePromptInjections(targetId));
  if (!Number.isInteger(removed) || removed < 0) {
    throw new Error("/flushinject host returned invalid remove count");
  }
  return "";
};
