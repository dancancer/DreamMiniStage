/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║               Text & Media Utility Command Handlers                      ║
 * ║                                                                          ║
 * ║  文本工具 - trimtokens / sort / tokens / gallery / clipboard              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../../types";
import { parseBoolean, parseNumber } from "../../utils/helpers";

/* ═══════════════════════════════════════════════════════════════════════════
   类型与解析工具
   ═══════════════════════════════════════════════════════════════════════════ */

type TrimDirection = "start" | "end";

function normalizeTrimDirection(raw: string | undefined): TrimDirection {
  const normalized = (raw || "end").trim().toLowerCase();
  if (normalized === "start" || normalized === "end") {
    return normalized;
  }
  throw new Error(`/trimtokens invalid direction: ${raw || ""}`);
}

function normalizeSortKeyMode(raw: string | undefined): boolean {
  if (raw === undefined) {
    return true;
  }

  const parsed = parseBoolean(raw, undefined);
  if (parsed === undefined) {
    throw new Error(`/sort invalid keysort value: ${raw}`);
  }
  return parsed;
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

function resolveUtilityText(args: string[], namedArgs: Record<string, string>, pipe: string): string {
  return (args.join(" ") || namedArgs.text || pipe || "").toString();
}

function trimToEndSentence(input: string): string {
  if (!input) {
    return "";
  }

  const punctuation = new Set([
    ".",
    "!",
    "?",
    "*",
    "\"",
    ")",
    "}",
    "`",
    "]",
    "$",
    "\u3002",
    "\uFF01",
    "\uFF1F",
    "\u201D",
    "\uFF09",
    "\u3011",
    "\u2019",
    "\u300D",
    "_",
  ]);
  const characters = Array.from(input);
  let last = -1;

  for (let index = characters.length - 1; index >= 0; index -= 1) {
    const current = characters[index];
    const isEmoji = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u.test(current);
    if (!punctuation.has(current) && !isEmoji) {
      continue;
    }

    last = !isEmoji && index > 0 && /[\s\n]/.test(characters[index - 1])
      ? index - 1
      : index;
    break;
  }

  if (last === -1) {
    return input.trimEnd();
  }

  return characters.slice(0, last + 1).join("").trimEnd();
}

function trimToStartSentence(input: string): string {
  if (!input) {
    return "";
  }

  const positions = [
    { index: input.indexOf("."), skipWhitespace: false },
    { index: input.indexOf("!"), skipWhitespace: false },
    { index: input.indexOf("?"), skipWhitespace: false },
    { index: input.indexOf("\n"), skipWhitespace: true },
  ].filter((entry) => entry.index > 0);

  if (positions.length === 0) {
    return input;
  }

  const first = positions.reduce((best, current) => current.index < best.index ? current : best);
  const offset = first.skipWhitespace ? 1 : 2;
  return input.slice(first.index + offset);
}

function compareSortValues(left: unknown, right: unknown): number {
  let a = left;
  let b = right;
  if (typeof a !== typeof b) {
    a = typeof a;
    b = typeof b;
  }
  if (a === b) {
    return 0;
  }

  const normalizedLeft = typeof a === "number" || typeof a === "boolean"
    ? a
    : String(a);
  const normalizedRight = typeof b === "number" || typeof b === "boolean"
    ? b
    : String(b);
  return normalizedLeft > normalizedRight ? 1 : -1;
}

function sortStructuredValue(text: string, keySort: boolean): string {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      parsed.sort(compareSortValues);
      return JSON.stringify(parsed);
    }

    if (parsed && typeof parsed === "object") {
      const source = parsed as Record<string, unknown>;
      const keys = Object.keys(source).sort((left, right) => keySort
        ? compareSortValues(left, right)
        : compareSortValues(source[left], source[right]));
      return JSON.stringify(keys);
    }

    return JSON.stringify(parsed);
  } catch {
    return text;
  }
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

/* ═══════════════════════════════════════════════════════════════════════════
   命令处理器
   ═══════════════════════════════════════════════════════════════════════════ */

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

/** /sort - 对 JSON 数组或对象键进行升序排序 */
export const handleSort: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  const text = resolveUtilityText(args, namedArgs, pipe);
  if (!text) {
    throw new Error("/sort requires a value");
  }

  return sortStructuredValue(text, normalizeSortKeyMode(namedArgs.keysort));
};

/** /tokens - 统计输入文本 token 数 */
export const handleTokens: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const text = resolveUtilityText(args, namedArgs, pipe);
  const tokenCount = ctx.countTokens
    ? await Promise.resolve(ctx.countTokens(text))
    : estimateTokenCount(text);

  if (!Number.isFinite(tokenCount) || tokenCount < 0) {
    throw new Error("/tokens tokenizer returned invalid token count");
  }

  return String(tokenCount);
};

/** /trimstart - 去掉首句之前的前缀 */
export const handleTrimStart: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  return trimToStartSentence(resolveUtilityText(args, namedArgs, pipe));
};

/** /trimend - 截断到最后一个完整句尾 */
export const handleTrimEnd: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  return trimToEndSentence(resolveUtilityText(args, namedArgs, pipe));
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
