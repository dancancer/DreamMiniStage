/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Utility Command Handlers                              ║
 * ║                                                                           ║
 * ║  工具命令 - run / trimtokens / is-mobile / import / clipboard-*            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import { parseNumber } from "../utils/helpers";

const RUN_NAMED_ARG_PATTERN = /\{\{arg::([a-zA-Z0-9_-]+)\}\}/g;
const CLOSURE_PAYLOAD_FORMAT = "dreammini-closure-v1";
const PERSONA_LOCK_TYPES = new Set(["chat", "character", "default"]);
const PERSONA_LOCK_TRUE_VALUES = new Set(["true", "1", "on"]);
const PERSONA_LOCK_FALSE_VALUES = new Set(["false", "0", "off"]);
const PERSONA_LOCK_TOGGLE_VALUES = new Set(["toggle", "t"]);

type TrimDirection = "start" | "end";
type PersonaLockType = "chat" | "character" | "default";
type PersonaLockState = "on" | "off" | "toggle";

function resolveRunScript(
  target: string,
  ctx: Parameters<CommandHandler>[2],
): string {
  if (target.startsWith("/")) {
    return target;
  }

  const fromVariable = ctx.getVariable(target);
  if (typeof fromVariable !== "string") {
    throw new Error(`/run target is not executable: ${target}`);
  }

  const script = fromVariable.trim();
  if (!script.startsWith("/")) {
    throw new Error(`/run variable '${target}' must contain a slash command script`);
  }

  return script;
}

function applyRunNamedArgs(
  script: string,
  namedArgs: Record<string, string>,
): string {
  if (Object.keys(namedArgs).length === 0) {
    return script;
  }

  return script.replace(RUN_NAMED_ARG_PATTERN, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(namedArgs, key) ? namedArgs[key] : match;
  });
}

function normalizeTrimDirection(raw: string | undefined): TrimDirection {
  const normalized = (raw || "end").trim().toLowerCase();
  if (normalized === "start" || normalized === "end") {
    return normalized;
  }
  throw new Error(`/trimtokens invalid direction: ${raw || ""}`);
}

function parseDelayMs(raw: string | undefined): number {
  const parsed = parseNumber(raw);
  if (parsed === undefined || !Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`/delay invalid milliseconds: ${raw || ""}`);
  }
  return Math.floor(parsed);
}

function normalizeGalleryList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("/list-gallery host returned non-array result");
  }

  return value.map((item) => {
    if (typeof item !== "string") {
      throw new Error("/list-gallery host returned non-string item");
    }
    return item;
  });
}

function resolveGalleryOptions(namedArgs: Record<string, string>): { character?: string; group?: string } {
  const character = (namedArgs.char || "").trim();
  const group = (namedArgs.group || "").trim();
  return {
    ...(character ? { character } : {}),
    ...(group ? { group } : {}),
  };
}


function estimateTokenCount(text: string): number {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }
  return Math.max(1, Math.ceil(normalized.length / 4));
}

function trimByCharacterRatio(
  text: string,
  limit: number,
  tokenCount: number,
  direction: TrimDirection,
): string {
  if (limit <= 0) {
    return "";
  }

  if (tokenCount <= limit) {
    return text;
  }

  const keepRatio = limit / tokenCount;
  const keepChars = Math.max(1, Math.floor(text.length * keepRatio));
  return direction === "start"
    ? text.slice(0, keepChars)
    : text.slice(Math.max(0, text.length - keepChars));
}

function buildCountSourceText(messages: Parameters<CommandHandler>[2]["messages"]): string {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => (message.content || "").trim())
    .filter((content) => content.length > 0)
    .join(" ");
}

function resolveClipboardText(args: string[], namedArgs: Record<string, string>, pipe: string): string {
  const fromArgs = args.join(" ");
  const fromNamed = namedArgs.text;
  return fromArgs || fromNamed || pipe || "";
}

function detectIsMobileUserAgent(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(userAgent);
}

function parseImportMappings(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
): Array<{ source: string; target: string }> {
  const fromNamed = (namedArgs.items || namedArgs.keys || "").trim();
  const sourceText = fromNamed || args.join(" ") || pipe;
  const tokens = sourceText
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    throw new Error("/import requires items to import");
  }

  const mappings: Array<{ source: string; target: string }> = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const source = tokens[index];
    if (!source) {
      continue;
    }

    const marker = tokens[index + 1]?.toLowerCase();
    if (marker === "as") {
      const target = tokens[index + 2];
      if (!target) {
        throw new Error(`/import missing target variable after 'as': ${source}`);
      }
      mappings.push({ source, target });
      index += 2;
      continue;
    }

    mappings.push({ source, target: source });
  }

  return mappings;
}

function normalizeImportResult(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error("/import host returned invalid import count");
  }
  return String(value);
}

function isEscapedCharacter(input: string, index: number): boolean {
  let slashCount = 0;
  for (let i = index - 1; i >= 0 && input[i] === "\\"; i -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function extractFirstClosureBlock(raw: string): string | undefined {
  const input = raw.trim();
  let inQuote = false;
  let quoteChar = "";
  let depth = 0;
  let start = -1;

  for (let i = 0; i < input.length; i += 1) {
    const twoChars = input.slice(i, i + 2);
    const ch = input[i];

    if (!inQuote && twoChars === "{:") {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
      i += 1;
      continue;
    }

    if (!inQuote && twoChars === ":}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return input.slice(start, i + 2);
      }
      i += 1;
      continue;
    }

    if (!inQuote && (ch === "\"" || ch === "'") && !isEscapedCharacter(input, i)) {
      inQuote = true;
      quoteChar = ch;
      continue;
    }

    if (inQuote && ch === quoteChar && !isEscapedCharacter(input, i)) {
      inQuote = false;
      quoteChar = "";
    }
  }

  return undefined;
}

function extractClosureBody(payload: string): string | null {
  const trimmed = payload.trim();
  const block = extractFirstClosureBlock(trimmed);
  if (!block || block !== trimmed) {
    return null;
  }

  const body = block.slice(2, -2).trim();
  return body || null;
}

function resolveClosurePayload(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
  rawBlock?: string,
): string {
  const fromNamed = namedArgs.payload ?? namedArgs.value ?? namedArgs.text;
  const fromArgs = args.join(" ").trim();
  const fromRaw = rawBlock?.trim();
  const fromPipe = pipe.trim();
  return (fromNamed || fromArgs || fromRaw || fromPipe || "").trim();
}

function parseSerializedClosurePayload(payload: string): string {
  const trimmed = payload.trim();
  if (!trimmed) {
    throw new Error("/closure-deserialize requires serialized payload");
  }

  const blockBody = extractClosureBody(trimmed);
  if (blockBody !== null) {
    return blockBody;
  }

  if (trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("/closure-deserialize invalid serialized payload");
    }

    const normalized = parsed as { format?: unknown; script?: unknown };
    if (normalized.format !== CLOSURE_PAYLOAD_FORMAT || typeof normalized.script !== "string") {
      throw new Error("/closure-deserialize invalid serialized payload");
    }

    const script = normalized.script.trim();
    if (!script) {
      throw new Error("/closure-deserialize serialized payload has empty script");
    }
    return script;
  }

  return trimmed;
}

function parsePersonaLockType(raw: string | undefined): PersonaLockType {
  const normalized = (raw || "chat").trim().toLowerCase();
  if (PERSONA_LOCK_TYPES.has(normalized)) {
    return normalized as PersonaLockType;
  }
  throw new Error(`/lock invalid type: ${raw || ""}`);
}

function parsePersonaLockState(raw: string | undefined): PersonaLockState {
  const normalized = (raw || "toggle").trim().toLowerCase();
  if (PERSONA_LOCK_TOGGLE_VALUES.has(normalized)) {
    return "toggle";
  }
  if (PERSONA_LOCK_TRUE_VALUES.has(normalized)) {
    return "on";
  }
  if (PERSONA_LOCK_FALSE_VALUES.has(normalized)) {
    return "off";
  }
  throw new Error(`/lock invalid state: ${raw || ""}`);
}

/** /run <script|variable> - 执行闭包脚本最小子集（支持变量脚本 + {{arg::}} 注入） */
export const handleRun: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.runSlashCommand) {
    throw new Error("/run is not available in current context");
  }

  const target = (args.join(" ") || pipe || "").trim();
  if (!target) {
    throw new Error("/run requires a script target");
  }

  const script = resolveRunScript(target, ctx);
  const hydratedScript = applyRunNamedArgs(script, namedArgs);
  return ctx.runSlashCommand(hydratedScript);
};

/** /closure-serialize - 将闭包脚本文本序列化为可持久化字符串 */
export const handleClosureSerialize: CommandHandler = async (
  args,
  namedArgs,
  _ctx,
  pipe,
  invocationMeta,
) => {
  const rawBlock = invocationMeta?.raw ? extractFirstClosureBlock(invocationMeta.raw) : undefined;
  const payload = resolveClosurePayload(args, namedArgs, pipe, rawBlock);
  if (!payload) {
    throw new Error("/closure-serialize requires closure script");
  }

  const script = (extractClosureBody(payload) || payload).trim();
  if (!script) {
    throw new Error("/closure-serialize requires non-empty closure script");
  }

  return JSON.stringify({
    format: CLOSURE_PAYLOAD_FORMAT,
    script,
  });
};

/** /closure-deserialize - 反序列化闭包脚本文本（输出可直接继续管道执行） */
export const handleClosureDeserialize: CommandHandler = async (
  args,
  namedArgs,
  _ctx,
  pipe,
  invocationMeta,
) => {
  const rawBlock = invocationMeta?.raw ? extractFirstClosureBlock(invocationMeta.raw) : undefined;
  const payload = resolveClosurePayload(args, namedArgs, pipe, rawBlock);
  if (!payload) {
    throw new Error("/closure-deserialize requires serialized payload");
  }

  return parseSerializedClosurePayload(payload);
};

/** /lock|/bind - 切换 persona 绑定锁状态（chat/character/default） */
export const handleLock: CommandHandler = async (args, namedArgs, ctx, _pipe) => {
  if (!ctx.setPersonaLock) {
    throw new Error("/lock is not available in current context");
  }

  const type = parsePersonaLockType(namedArgs.type);
  const state = parsePersonaLockState(namedArgs.state ?? args[0]);
  const result = await Promise.resolve(ctx.setPersonaLock(state, { type }));

  if (typeof result !== "boolean") {
    throw new Error("/lock host returned non-boolean lock state");
  }
  return String(result);
};

/** /trimtokens [limit] <text> - 裁剪 token（优先宿主 tokenizer，缺失时按比例降级） */
export const handleTrimTokens: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const limitSource = namedArgs.limit ?? args[0];
  const limit = parseNumber(limitSource);
  if (limit === undefined) {
    throw new Error(`/trimtokens invalid limit: ${limitSource || ""}`);
  }

  const direction = normalizeTrimDirection(namedArgs.direction);
  const textArgs = namedArgs.limit === undefined ? args.slice(1) : args;
  const text = (textArgs.join(" ") || pipe || "").toString();
  if (!text || limit <= 0) {
    return "";
  }

  const tokenCount = ctx.countTokens
    ? await Promise.resolve(ctx.countTokens(text))
    : estimateTokenCount(text);

  if (!Number.isFinite(tokenCount) || tokenCount < 0) {
    throw new Error("/trimtokens tokenizer returned invalid token count");
  }
  if (tokenCount <= limit) {
    return text;
  }

  if (ctx.sliceByTokens) {
    const sliced = await Promise.resolve(ctx.sliceByTokens(text, limit, direction));
    if (typeof sliced !== "string") {
      throw new Error("/trimtokens tokenizer returned invalid slice result");
    }
    return sliced;
  }

  return trimByCharacterRatio(text, limit, tokenCount, direction);
};

/** /count - 统计当前会话消息 token 数 */
export const handleCount: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  const sourceText = buildCountSourceText(ctx.messages ?? []);
  const tokenCount = ctx.countTokens
    ? await Promise.resolve(ctx.countTokens(sourceText))
    : estimateTokenCount(sourceText);

  if (!Number.isInteger(tokenCount) || tokenCount < 0) {
    throw new Error("/count tokenizer returned invalid token count");
  }

  return String(tokenCount);
};

/** /is-mobile - 返回当前终端是否为移动设备 */
export const handleIsMobile: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  const isMobile = ctx.isMobileDevice
    ? await Promise.resolve(ctx.isMobileDevice())
    : detectIsMobileUserAgent();
  if (typeof isMobile !== "boolean") {
    throw new Error("/is-mobile host returned non-boolean result");
  }
  return String(isMobile);
};

/** /import from=<qr> <x [as y]> - 从宿主导入作用域变量 */
export const handleImport: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.importVariables) {
    throw new Error("/import is not available in current context");
  }

  const from = (namedArgs.from || "").trim();
  if (!from) {
    throw new Error("/import requires from=<source>");
  }

  const mappings = parseImportMappings(args, namedArgs, pipe);
  const result = await Promise.resolve(ctx.importVariables(from, mappings));
  return normalizeImportResult(result);
};

/** /reload-page - 触发宿主页面刷新（宿主未实现时 fail-fast） */
export const handleReloadPage: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.reloadPage) {
    throw new Error("/reload-page is not available in current context");
  }

  await ctx.reloadPage();
  return "";
};

/** /delay <milliseconds> - 延迟后续命令执行 */
export const handleDelay: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  const rawAmount = namedArgs.ms ?? args[0] ?? pipe;
  const milliseconds = parseDelayMs(rawAmount);
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
  return "";
};

/** /show-gallery|/sg - 打开当前角色/群组画廊 */
export const handleShowGallery: CommandHandler = async (_args, namedArgs, ctx, _pipe) => {
  if (!ctx.showGallery) {
    throw new Error("/show-gallery is not available in current context");
  }

  await Promise.resolve(ctx.showGallery(resolveGalleryOptions(namedArgs)));
  return "";
};

/** /list-gallery - 列出角色/群组画廊内容 */
export const handleListGallery: CommandHandler = async (_args, namedArgs, ctx, _pipe) => {
  if (!ctx.listGallery) {
    throw new Error("/list-gallery is not available in current context");
  }

  const list = await Promise.resolve(ctx.listGallery(resolveGalleryOptions(namedArgs)));
  return JSON.stringify(normalizeGalleryList(list));
};

/** /clipboard-get - 读取系统剪贴板文本 */
export const handleClipboardGet: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.getClipboardText) {
    throw new Error("/clipboard-get is not available in current context");
  }

  const text = await Promise.resolve(ctx.getClipboardText());
  if (typeof text !== "string") {
    throw new Error("/clipboard-get host returned non-string clipboard text");
  }
  return text;
};

/** /clipboard-set [text] - 写入系统剪贴板文本 */
export const handleClipboardSet: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.setClipboardText) {
    throw new Error("/clipboard-set is not available in current context");
  }

  const text = resolveClipboardText(args, namedArgs, pipe);
  if (!text) {
    throw new Error("/clipboard-set requires text");
  }

  await Promise.resolve(ctx.setClipboardText(text));
  return "";
};
