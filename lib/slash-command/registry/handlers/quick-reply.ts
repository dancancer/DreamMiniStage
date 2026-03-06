/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Quick Reply Command Handlers                           ║
 * ║                                                                          ║
 * ║  /qr + /qr-* 第一批命令，统一宿主透传与 fail-fast 语义                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import type { QuickReplyCreateOptions, QuickReplyLookup, QuickReplySnapshot } from "../../types";
import { parseBoolean } from "../utils/helpers";

function ensureHostCallback<T>(callback: T | undefined, commandName: string): T {
  if (!callback) {
    throw new Error(`/${commandName} is not available in current context`);
  }
  return callback;
}

function parseQuickReplyIndex(raw: string | undefined, commandName: string): number {
  const normalized = (raw || "").trim();
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`/${commandName} invalid quick reply index: ${raw || ""}`);
  }
  return parsed;
}

function normalizeSetName(raw: string | undefined, commandName: string): string {
  const setName = (raw || "").trim();
  if (!setName) {
    throw new Error(`/${commandName} requires quick reply set name`);
  }
  return setName;
}

function parseOptionalBoolean(raw: string | undefined, commandName: string, argName: string): boolean | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const parsed = parseBoolean(raw, undefined);
  if (parsed === undefined) {
    throw new Error(`/${commandName} invalid ${argName} value: ${raw}`);
  }
  return parsed;
}

function resolveQuickReplyLookup(
  namedArgs: Record<string, string>,
  fallbackLabel: string,
  commandName: string,
): QuickReplyLookup {
  const rawId = namedArgs.id;
  if (rawId !== undefined) {
    const id = Number.parseInt(rawId.trim(), 10);
    if (!Number.isInteger(id) || id < 0) {
      throw new Error(`/${commandName} invalid id value: ${rawId}`);
    }
    return { id };
  }

  const label = (namedArgs.label || fallbackLabel || "").trim();
  if (!label) {
    throw new Error(`/${commandName} requires quick reply label or id`);
  }

  return { label };
}

function normalizeQuickReplyExecutionResult(commandName: string, value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`/${commandName} host returned invalid value`);
  }
  return String(value);
}

function normalizeQuickReplyList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("/qr-list host returned non-array quick replies");
  }

  return value.map((item) => {
    if (typeof item === "string") {
      return item;
    }

    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("/qr-list host returned invalid quick reply entry");
    }

    const snapshot = item as QuickReplySnapshot;
    if (typeof snapshot.label !== "string" || snapshot.label.trim().length === 0) {
      throw new Error("/qr-list host returned quick reply without label");
    }

    return snapshot.label;
  });
}

function normalizeQuickReplyRecord(commandName: string, value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`/${commandName} host returned invalid quick reply`);
  }

  return JSON.stringify(value);
}

function buildCreateQuickReplyOptions(namedArgs: Record<string, string>): QuickReplyCreateOptions {
  return {
    icon: namedArgs.icon,
    showLabel: parseOptionalBoolean(namedArgs.showlabel, "qr-create", "showlabel"),
    title: namedArgs.title,
    hidden: parseOptionalBoolean(namedArgs.hidden, "qr-create", "hidden"),
    startup: parseOptionalBoolean(namedArgs.startup, "qr-create", "startup"),
    user: parseOptionalBoolean(namedArgs.user, "qr-create", "user"),
    bot: parseOptionalBoolean(namedArgs.bot, "qr-create", "bot"),
    load: parseOptionalBoolean(namedArgs.load, "qr-create", "load"),
    new: parseOptionalBoolean(namedArgs.new, "qr-create", "new"),
    group: parseOptionalBoolean(namedArgs.group, "qr-create", "group"),
    generation: parseOptionalBoolean(namedArgs.generation, "qr-create", "generation"),
    automationId: namedArgs.automationId,
  };
}

/**
 * /qr [index] - 执行指定索引的 Quick Reply
 */
export const handleQr: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const executeQuickReplyByIndex = ensureHostCallback(ctx.executeQuickReplyByIndex, "qr");
  const index = parseQuickReplyIndex(args[0] || namedArgs.id || namedArgs.index || pipe, "qr");
  const result = await Promise.resolve(executeQuickReplyByIndex(index));
  return normalizeQuickReplyExecutionResult("qr", result);
};

/**
 * /qr-list [set] - 获取指定集合下的 Quick Reply 标签列表
 */
export const handleQrList: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const listQuickReplies = ensureHostCallback(ctx.listQuickReplies, "qr-list");
  const setName = normalizeSetName(namedArgs.set || args[0] || pipe, "qr-list");
  const list = await Promise.resolve(listQuickReplies(setName));
  return JSON.stringify(normalizeQuickReplyList(list));
};

/**
 * /qr-get set=<set> [label=<label>|id=<id>] - 获取单条 Quick Reply
 */
export const handleQrGet: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const getQuickReply = ensureHostCallback(ctx.getQuickReply, "qr-get");
  const hasNamedSet = typeof namedArgs.set === "string";
  const setName = normalizeSetName(hasNamedSet ? namedArgs.set : args[0], "qr-get");
  const positionalLabel = hasNamedSet ? args.join(" ") : args.slice(1).join(" ");
  const target = resolveQuickReplyLookup(namedArgs, positionalLabel || pipe, "qr-get");
  const quickReply = await Promise.resolve(getQuickReply(setName, target));
  return normalizeQuickReplyRecord("qr-get", quickReply);
};

/**
 * /qr-create set=<set> label=<label> <message> - 创建 Quick Reply
 */
export const handleQrCreate: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const createQuickReply = ensureHostCallback(ctx.createQuickReply, "qr-create");
  const setName = normalizeSetName(namedArgs.set, "qr-create");
  const label = (namedArgs.label || "").trim();
  if (!label) {
    throw new Error("/qr-create requires quick reply label");
  }

  const message = (args.join(" ") || namedArgs.message || pipe || "").trim();
  if (!message) {
    throw new Error("/qr-create requires quick reply message");
  }

  const options = buildCreateQuickReplyOptions(namedArgs);
  await Promise.resolve(createQuickReply(setName, label, message, options));
  return "";
};

/**
 * /qr-delete set=<set> [label=<label>|id=<id>] - 删除 Quick Reply
 */
export const handleQrDelete: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const deleteQuickReply = ensureHostCallback(ctx.deleteQuickReply, "qr-delete");
  const hasNamedSet = typeof namedArgs.set === "string";
  const setName = normalizeSetName(hasNamedSet ? namedArgs.set : args[0], "qr-delete");
  const positionalLabel = hasNamedSet ? args.join(" ") : args.slice(1).join(" ");
  const target = resolveQuickReplyLookup(namedArgs, positionalLabel || pipe, "qr-delete");
  await Promise.resolve(deleteQuickReply(setName, target));
  return "";
};
