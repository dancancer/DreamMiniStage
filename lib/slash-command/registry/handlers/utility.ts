/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Utility Command Handlers                              ║
 * ║                                                                           ║
 * ║  工具命令 - run / trimtokens / reload-page                                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import { parseNumber } from "../utils/helpers";

const RUN_NAMED_ARG_PATTERN = /\{\{arg::([a-zA-Z0-9_-]+)\}\}/g;

type TrimDirection = "start" | "end";

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

/** /reload-page - 触发宿主页面刷新（宿主未实现时 fail-fast） */
export const handleReloadPage: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.reloadPage) {
    throw new Error("/reload-page is not available in current context");
  }

  await ctx.reloadPage();
  return "";
};
