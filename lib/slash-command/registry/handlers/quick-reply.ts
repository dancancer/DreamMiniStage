/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Quick Reply Command Handlers                           ║
 * ║                                                                          ║
 * ║  /qr + /qr-* 命令簇，统一宿主透传与 fail-fast 语义                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import type {
  QuickReplyContextOptions,
  QuickReplyCreateOptions,
  QuickReplyLookup,
  QuickReplySetOptions,
  QuickReplySetScope,
  QuickReplySetSnapshot,
  QuickReplySetVisibilityOptions,
  QuickReplySnapshot,
  QuickReplyUpdateOptions,
} from "../../types";
import { parseBoolean } from "../utils/helpers";

const QUICK_REPLY_SET_SCOPES = new Set<QuickReplySetScope>(["all", "global", "chat"]);

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

function trimToUndefined(raw: string | undefined): string | undefined {
  const normalized = (raw || "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parseOptionalBoolean(
  raw: string | undefined,
  commandName: string,
  argName: string,
): boolean | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const parsed = parseBoolean(raw, undefined);
  if (parsed === undefined) {
    throw new Error(`/${commandName} invalid ${argName} value: ${raw}`);
  }
  return parsed;
}

function parseRequiredBoolean(
  raw: string | undefined,
  commandName: string,
  argName: string,
  defaultValue: boolean,
): boolean {
  if (raw === undefined) {
    return defaultValue;
  }

  const parsed = parseBoolean(raw, undefined);
  if (parsed === undefined) {
    throw new Error(`/${commandName} invalid ${argName} value: ${raw || ""}`);
  }
  return parsed;
}

function parseQuickReplySetScope(raw: string | undefined): QuickReplySetScope {
  const normalized = (raw || "all").trim().toLowerCase();
  if (!QUICK_REPLY_SET_SCOPES.has(normalized as QuickReplySetScope)) {
    throw new Error(`/qr-set-list invalid source: ${raw || ""}`);
  }
  return normalized as QuickReplySetScope;
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

function normalizeQuickReplySetList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("/qr-set-list host returned non-array quick reply sets");
  }

  return value.map((item) => {
    if (typeof item === "string") {
      return item;
    }

    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("/qr-set-list host returned invalid quick reply set entry");
    }

    const snapshot = item as QuickReplySetSnapshot;
    if (typeof snapshot.name !== "string" || snapshot.name.trim().length === 0) {
      throw new Error("/qr-set-list host returned quick reply set without name");
    }

    return snapshot.name;
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

function resolveQuickReplyMessage(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
): string {
  return (args.join(" ") || namedArgs.message || pipe || "").trim();
}

function resolveQuickReplySetMutationName(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
  commandName: string,
): string {
  return normalizeSetName(namedArgs.name || args.join(" ") || pipe, commandName);
}

function resolveQuickReplyContextSetName(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
  commandName: string,
): string {
  const name = (namedArgs.context || namedArgs.menu || args.join(" ") || pipe || "").trim();
  if (!name) {
    throw new Error(`/${commandName} requires context quick reply set name`);
  }
  return name;
}

function buildQuickReplyCreateOptions(
  commandName: string,
  namedArgs: Record<string, string>,
): QuickReplyCreateOptions {
  return {
    icon: trimToUndefined(namedArgs.icon),
    showLabel: parseOptionalBoolean(namedArgs.showlabel, commandName, "showlabel"),
    title: trimToUndefined(namedArgs.title),
    hidden: parseOptionalBoolean(namedArgs.hidden, commandName, "hidden"),
    startup: parseOptionalBoolean(namedArgs.startup, commandName, "startup"),
    user: parseOptionalBoolean(namedArgs.user, commandName, "user"),
    bot: parseOptionalBoolean(namedArgs.bot, commandName, "bot"),
    load: parseOptionalBoolean(namedArgs.load, commandName, "load"),
    new: parseOptionalBoolean(namedArgs.new, commandName, "new"),
    group: parseOptionalBoolean(namedArgs.group, commandName, "group"),
    generation: parseOptionalBoolean(namedArgs.generation, commandName, "generation"),
    automationId: trimToUndefined(namedArgs.automationId),
  };
}

function buildQuickReplyUpdateOptions(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
): QuickReplyUpdateOptions {
  return {
    ...buildQuickReplyCreateOptions("qr-update", namedArgs),
    newLabel: trimToUndefined(namedArgs.newlabel),
    message: trimToUndefined(resolveQuickReplyMessage(args, namedArgs, pipe)),
  };
}

function buildQuickReplySetOptions(
  commandName: string,
  namedArgs: Record<string, string>,
  mode: "create" | "update",
): QuickReplySetOptions {
  const nosend = parseOptionalBoolean(namedArgs.nosend, commandName, "nosend");
  const before = parseOptionalBoolean(namedArgs.before, commandName, "before");
  const inject = parseOptionalBoolean(namedArgs.inject, commandName, "inject");

  if (mode === "create") {
    return {
      nosend: nosend ?? false,
      before: before ?? false,
      inject: inject ?? false,
    };
  }

  return { nosend, before, inject };
}

function buildQuickReplyVisibilityOptions(
  commandName: string,
  namedArgs: Record<string, string>,
): QuickReplySetVisibilityOptions {
  return {
    visible: parseRequiredBoolean(namedArgs.visible, commandName, "visible", true),
  };
}

/** /qr [index] - 执行指定索引的 Quick Reply */
export const handleQr: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const executeQuickReplyByIndex = ensureHostCallback(ctx.executeQuickReplyByIndex, "qr");
  const index = parseQuickReplyIndex(args[0] || namedArgs.id || namedArgs.index || pipe, "qr");
  const result = await Promise.resolve(executeQuickReplyByIndex(index));
  return normalizeQuickReplyExecutionResult("qr", result);
};

/** /qr-set [set] - 切换全局 Quick Reply 集合 */
export const handleQrSet: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const toggleGlobalQuickReplySet = ensureHostCallback(ctx.toggleGlobalQuickReplySet, "qr-set");
  const setName = normalizeSetName(args.join(" ") || namedArgs.name || pipe, "qr-set");
  await Promise.resolve(toggleGlobalQuickReplySet(setName, buildQuickReplyVisibilityOptions("qr-set", namedArgs)));
  return "";
};

/** /qr-set-on [set] - 启用全局 Quick Reply 集合 */
export const handleQrSetOn: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const addGlobalQuickReplySet = ensureHostCallback(ctx.addGlobalQuickReplySet, "qr-set-on");
  const setName = normalizeSetName(args.join(" ") || namedArgs.name || pipe, "qr-set-on");
  await Promise.resolve(addGlobalQuickReplySet(setName, buildQuickReplyVisibilityOptions("qr-set-on", namedArgs)));
  return "";
};

/** /qr-set-off [set] - 停用全局 Quick Reply 集合 */
export const handleQrSetOff: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const removeGlobalQuickReplySet = ensureHostCallback(ctx.removeGlobalQuickReplySet, "qr-set-off");
  const setName = normalizeSetName(args.join(" ") || namedArgs.name || pipe, "qr-set-off");
  await Promise.resolve(removeGlobalQuickReplySet(setName));
  return "";
};

/** /qr-chat-set [set] - 切换会话 Quick Reply 集合 */
export const handleQrChatSet: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const toggleChatQuickReplySet = ensureHostCallback(ctx.toggleChatQuickReplySet, "qr-chat-set");
  const setName = normalizeSetName(args.join(" ") || namedArgs.name || pipe, "qr-chat-set");
  await Promise.resolve(toggleChatQuickReplySet(setName, buildQuickReplyVisibilityOptions("qr-chat-set", namedArgs)));
  return "";
};

/** /qr-chat-set-on [set] - 启用会话 Quick Reply 集合 */
export const handleQrChatSetOn: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const addChatQuickReplySet = ensureHostCallback(ctx.addChatQuickReplySet, "qr-chat-set-on");
  const setName = normalizeSetName(args.join(" ") || namedArgs.name || pipe, "qr-chat-set-on");
  await Promise.resolve(addChatQuickReplySet(setName, buildQuickReplyVisibilityOptions("qr-chat-set-on", namedArgs)));
  return "";
};

/** /qr-chat-set-off [set] - 停用会话 Quick Reply 集合 */
export const handleQrChatSetOff: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const removeChatQuickReplySet = ensureHostCallback(ctx.removeChatQuickReplySet, "qr-chat-set-off");
  const setName = normalizeSetName(args.join(" ") || namedArgs.name || pipe, "qr-chat-set-off");
  await Promise.resolve(removeChatQuickReplySet(setName));
  return "";
};

/** /qr-set-list [all|global|chat] - 获取 Quick Reply 集合列表 */
export const handleQrSetList: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const listQuickReplySets = ensureHostCallback(ctx.listQuickReplySets, "qr-set-list");
  const scope = parseQuickReplySetScope(namedArgs.source || args[0] || pipe || undefined);
  const list = await Promise.resolve(listQuickReplySets(scope));
  return JSON.stringify(normalizeQuickReplySetList(list));
};

/** /qr-list [set] - 获取指定集合下的 Quick Reply 标签列表 */
export const handleQrList: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const listQuickReplies = ensureHostCallback(ctx.listQuickReplies, "qr-list");
  const setName = normalizeSetName(namedArgs.set || args[0] || pipe, "qr-list");
  const list = await Promise.resolve(listQuickReplies(setName));
  return JSON.stringify(normalizeQuickReplyList(list));
};

/** /qr-get set=<set> [label=<label>|id=<id>] - 获取单条 Quick Reply */
export const handleQrGet: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const getQuickReply = ensureHostCallback(ctx.getQuickReply, "qr-get");
  const hasNamedSet = typeof namedArgs.set === "string";
  const setName = normalizeSetName(hasNamedSet ? namedArgs.set : args[0], "qr-get");
  const positionalLabel = hasNamedSet ? args.join(" ") : args.slice(1).join(" ");
  const target = resolveQuickReplyLookup(namedArgs, positionalLabel || pipe, "qr-get");
  const quickReply = await Promise.resolve(getQuickReply(setName, target));
  return normalizeQuickReplyRecord("qr-get", quickReply);
};

/** /qr-create set=<set> label=<label> <message> - 创建 Quick Reply */
export const handleQrCreate: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const createQuickReply = ensureHostCallback(ctx.createQuickReply, "qr-create");
  const setName = normalizeSetName(namedArgs.set, "qr-create");
  const label = (namedArgs.label || "").trim();
  if (!label) {
    throw new Error("/qr-create requires quick reply label");
  }

  const message = resolveQuickReplyMessage(args, namedArgs, pipe);
  if (!message) {
    throw new Error("/qr-create requires quick reply message");
  }

  const options = buildQuickReplyCreateOptions("qr-create", namedArgs);
  await Promise.resolve(createQuickReply(setName, label, message, options));
  return "";
};

/** /qr-update set=<set> [label=<label>|id=<id>] - 更新 Quick Reply */
export const handleQrUpdate: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const updateQuickReply = ensureHostCallback(ctx.updateQuickReply, "qr-update");
  const setName = normalizeSetName(namedArgs.set, "qr-update");
  const target = resolveQuickReplyLookup(namedArgs, "", "qr-update");
  const options = buildQuickReplyUpdateOptions(args, namedArgs, pipe);
  await Promise.resolve(updateQuickReply(setName, target, options));
  return "";
};

/** /qr-delete set=<set> [label=<label>|id=<id>] - 删除 Quick Reply */
export const handleQrDelete: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const deleteQuickReply = ensureHostCallback(ctx.deleteQuickReply, "qr-delete");
  const hasNamedSet = typeof namedArgs.set === "string";
  const setName = normalizeSetName(hasNamedSet ? namedArgs.set : args[0], "qr-delete");
  const positionalLabel = hasNamedSet ? args.join(" ") : args.slice(1).join(" ");
  const target = resolveQuickReplyLookup(namedArgs, positionalLabel || pipe, "qr-delete");
  await Promise.resolve(deleteQuickReply(setName, target));
  return "";
};

/** /qr-contextadd set=<set> label=<label>|id=<id> <context-set> */
export const handleQrContextAdd: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const addQuickReplyContextSet = ensureHostCallback(ctx.addQuickReplyContextSet, "qr-contextadd");
  const setName = normalizeSetName(namedArgs.set, "qr-contextadd");
  const target = resolveQuickReplyLookup(namedArgs, "", "qr-contextadd");
  const contextSetName = resolveQuickReplyContextSetName(args, namedArgs, pipe, "qr-contextadd");
  const options: QuickReplyContextOptions = {
    chain: parseOptionalBoolean(namedArgs.chain, "qr-contextadd", "chain"),
  };
  await Promise.resolve(addQuickReplyContextSet(setName, target, contextSetName, options));
  return "";
};

/** /qr-contextdel set=<set> label=<label>|id=<id> <context-set> */
export const handleQrContextDel: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const removeQuickReplyContextSet = ensureHostCallback(ctx.removeQuickReplyContextSet, "qr-contextdel");
  const setName = normalizeSetName(namedArgs.set, "qr-contextdel");
  const target = resolveQuickReplyLookup(namedArgs, "", "qr-contextdel");
  const contextSetName = resolveQuickReplyContextSetName(args, namedArgs, pipe, "qr-contextdel");
  await Promise.resolve(removeQuickReplyContextSet(setName, target, contextSetName));
  return "";
};

/** /qr-contextclear set=<set> [label=<label>|id=<id>] */
export const handleQrContextClear: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const clearQuickReplyContextSets = ensureHostCallback(ctx.clearQuickReplyContextSets, "qr-contextclear");
  const setName = normalizeSetName(namedArgs.set, "qr-contextclear");
  const target = resolveQuickReplyLookup(namedArgs, args.join(" ") || pipe, "qr-contextclear");
  await Promise.resolve(clearQuickReplyContextSets(setName, target));
  return "";
};

/** /qr-set-create [name] - 创建 Quick Reply 集合 */
export const handleQrSetCreate: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const createQuickReplySet = ensureHostCallback(ctx.createQuickReplySet, "qr-set-create");
  const name = resolveQuickReplySetMutationName(args, namedArgs, pipe, "qr-set-create");
  const options = buildQuickReplySetOptions("qr-set-create", namedArgs, "create");
  await Promise.resolve(createQuickReplySet(name, options));
  return "";
};

/** /qr-set-update [name] - 更新 Quick Reply 集合 */
export const handleQrSetUpdate: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const updateQuickReplySet = ensureHostCallback(ctx.updateQuickReplySet, "qr-set-update");
  const name = resolveQuickReplySetMutationName(args, namedArgs, pipe, "qr-set-update");
  const options = buildQuickReplySetOptions("qr-set-update", namedArgs, "update");
  await Promise.resolve(updateQuickReplySet(name, options));
  return "";
};

/** /qr-set-delete [name] - 删除 Quick Reply 集合 */
export const handleQrSetDelete: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const deleteQuickReplySet = ensureHostCallback(ctx.deleteQuickReplySet, "qr-set-delete");
  const name = resolveQuickReplySetMutationName(args, namedArgs, pipe, "qr-set-delete");
  await Promise.resolve(deleteQuickReplySet(name));
  return "";
};
