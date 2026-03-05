/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                Expression Command Handlers                                ║
 * ║                                                                           ║
 * ║  表情命令：expression-set/list/last/folder-override/classify             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import { parseBoolean } from "../utils/helpers";

type ExpressionCommandType = "expression" | "sprite";
type ExpressionListReturnType = "pipe" | "json" | "object" | "none";

function ensureHostCallback<T>(callback: T | undefined, commandName: string): T {
  if (!callback) {
    throw new Error(`/${commandName} is not available in current context`);
  }
  return callback;
}

function resolveCommandText(args: string[], pipe: string): string {
  return (args.join(" ") || pipe || "").trim();
}

function resolveExpressionType(raw: string | undefined): ExpressionCommandType {
  const normalized = (raw || "expression").trim().toLowerCase();
  if (normalized === "expression" || normalized === "sprite") {
    return normalized;
  }
  throw new Error(`/expression-set invalid type: ${raw}`);
}

function resolveReturnType(raw: string | undefined): ExpressionListReturnType {
  const normalized = (raw || "pipe").trim().toLowerCase();
  if (
    normalized === "pipe" ||
    normalized === "json" ||
    normalized === "object" ||
    normalized === "none"
  ) {
    return normalized;
  }
  throw new Error(`/expression-list invalid return type: ${raw}`);
}

function stringifyExpressionList(
  list: string[],
  returnType: ExpressionListReturnType,
): string {
  if (returnType === "none") {
    return "";
  }

  if (returnType === "json" || returnType === "object") {
    return JSON.stringify(list);
  }

  return list.join(", ");
}

function normalizeStringList(
  list: unknown,
  commandName: "expression-list",
): string[] {
  if (!Array.isArray(list) || !list.every((item) => typeof item === "string")) {
    throw new Error(`/${commandName} host callback must return string[]`);
  }
  return list;
}

/** /expression-set [label] - 设置当前角色表情（别名 /emote /sprite） */
export const handleExpressionSet: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const callback = ensureHostCallback(ctx.setExpression, "expression-set");
  const label = resolveCommandText(args, pipe) || (namedArgs.label || "").trim();
  if (!label) {
    throw new Error("/expression-set requires expression label");
  }

  const type = resolveExpressionType(namedArgs.type);
  const result = await callback(label, { type });
  if (typeof result !== "string") {
    throw new Error("/expression-set host callback must return a string");
  }
  return result;
};

/** /expression-folder-override [folder] - 覆盖角色表情目录（别名 /costume） */
export const handleExpressionFolderOverride: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const callback = ensureHostCallback(ctx.setExpressionFolderOverride, "expression-folder-override");
  const folder = args.length > 0
    ? args.join(" ").trim()
    : (namedArgs.folder ?? pipe ?? "").trim();
  const name = (namedArgs.name || "").trim() || undefined;
  const result = await callback(folder, { name });
  if (result === undefined || result === null) {
    return "";
  }
  if (typeof result !== "string") {
    throw new Error("/expression-folder-override host callback must return a string");
  }
  return result;
};

/** /expression-last [name] - 获取角色最近一次表情 */
export const handleExpressionLast: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const callback = ensureHostCallback(ctx.getLastExpression, "expression-last");
  const name = resolveCommandText(args, pipe) || (namedArgs.name || "").trim() || undefined;
  const result = await callback(name);
  if (typeof result !== "string") {
    throw new Error("/expression-last host callback must return a string");
  }
  return result;
};

/** /expression-list - 列出当前可用表情 */
export const handleExpressionList: CommandHandler = async (_args, namedArgs, ctx, _pipe) => {
  const callback = ensureHostCallback(ctx.listExpressions, "expression-list");
  const parsedFilter = parseBoolean(namedArgs.filter, undefined);
  if (namedArgs.filter !== undefined && parsedFilter === undefined) {
    throw new Error(`/expression-list invalid filter value: ${namedArgs.filter}`);
  }
  const filterAvailable = parsedFilter ?? true;

  const returnType = resolveReturnType(namedArgs.return);
  const list = normalizeStringList(
    await callback({ filterAvailable }),
    "expression-list",
  );
  return stringifyExpressionList(list, returnType);
};

/** /expression-classify [text] - 分类文本情绪并返回标签（别名 /classify） */
export const handleExpressionClassify: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const callback = ensureHostCallback(ctx.classifyExpression, "expression-classify");
  const text = resolveCommandText(args, pipe);
  if (!text) {
    throw new Error("/expression-classify requires text");
  }

  const parsedFilter = parseBoolean(namedArgs.filter, undefined);
  if (namedArgs.filter !== undefined && parsedFilter === undefined) {
    throw new Error(`/expression-classify invalid filter value: ${namedArgs.filter}`);
  }
  const filterAvailable = parsedFilter ?? true;

  const result = await callback(text, {
    api: (namedArgs.api || "").trim() || undefined,
    prompt: (namedArgs.prompt || "").trim() || undefined,
    filterAvailable,
  });
  if (typeof result !== "string") {
    throw new Error("/expression-classify host callback must return a string");
  }
  return result;
};
