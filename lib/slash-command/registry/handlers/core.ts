/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Core Command Handlers                                  ║
 * ║                                                                           ║
 * ║  核心命令 - send / trigger / checkpoint / branch / echo / pass / return 等 ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import { normalizeIndex, parseNumber, parseBoolean, buildSendReturn } from "../utils/helpers";
import { emitSystemMessage, readSystemNarratorNameFromStorage } from "../utils/system-message";

/* ═══════════════════════════════════════════════════════════════════════════
   消息发送命令
   ═══════════════════════════════════════════════════════════════════════════ */

/** /send <text> - 发送消息（支持 at/name/compact/return） */
export const handleSend: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const text = (args.join(" ") || pipe || "").toString();
  const at = normalizeIndex(parseNumber(namedArgs.at), ctx.messages?.length ?? 0);
  const name = namedArgs.name;
  const compact = parseBoolean(namedArgs.compact);
  const returnType = namedArgs["return"];

  await ctx.onSend(text, { at, name, compact, returnType });
  return buildSendReturn(returnType, text, pipe, at);
};

/** /trigger - 触发 AI 生成，支持 await 与群组成员选择 */
const TRIGGER_LOCKS: Map<string, Promise<void>> = new Map();

export const handleTrigger: CommandHandler = async (args, namedArgs, ctx, _pipe) => {
  const member = args[0] ?? namedArgs.member;
  const shouldAwait = parseBoolean(namedArgs["await"], true);
  const lockKey = ctx.characterId || "__default__";

  const pending = TRIGGER_LOCKS.get(lockKey);
  if (pending) {
    await pending.catch(() => {});
  }

  const triggerPromise = (async () => {
    await ctx.onTrigger(member);
  })();

  TRIGGER_LOCKS.set(lockKey, triggerPromise);

  try {
    if (shouldAwait) {
      await triggerPromise;
    } else {
      triggerPromise.catch(() => {});
    }
    return "";
  } finally {
    triggerPromise.finally(() => {
      if (TRIGGER_LOCKS.get(lockKey) === triggerPromise) {
        TRIGGER_LOCKS.delete(lockKey);
      }
    });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   角色扮演命令
   ═══════════════════════════════════════════════════════════════════════════ */

/** /sendas <role> <text> - 以指定角色发送 */
export const handleSendAs: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  const [role, ...rest] = args;
  const text = rest.join(" ") || pipe;
  if (!text) return pipe;

  if (ctx.onSendAs) {
    await ctx.onSendAs(role, text);
    return text;
  }

  await ctx.onSend(`[${role}] ${text}`);
  return text;
};

function buildSystemSendOptions(namedArgs: Record<string, string>) {
  const name = (namedArgs.name || "").trim() || readSystemNarratorNameFromStorage() || undefined;
  const compact = parseBoolean(namedArgs.compact, undefined);
  const at = parseNumber(namedArgs.at);

  if (name === undefined && compact === undefined && at === undefined) {
    return undefined;
  }

  return {
    ...(name !== undefined ? { name } : {}),
    ...(compact !== undefined ? { compact } : {}),
    ...(at !== undefined ? { at } : {}),
  };
}

/** /sys <text> - 发送系统/旁白消息 */
export const handleSys: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const text = args.join(" ") || pipe;
  if (!text) return pipe;

  const options = buildSystemSendOptions(namedArgs);
  await emitSystemMessage(ctx, text, options);
  return buildSendReturn(namedArgs.return, text, pipe, options?.at);
};

/** /narrate [text] - 旁白播报（优先走宿主 narrate 回调） */
export const handleNarrate: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const text = args.join(" ") || pipe;
  if (!text) return pipe;

  if (ctx.narrateText) {
    await Promise.resolve(ctx.narrateText(text, { voice: namedArgs.voice }));
    return "";
  }

  return handleSys(args, namedArgs, ctx, pipe);
};

/** /impersonate <text> - AI 扮演用户回复 */
export const handleImpersonate: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  const text = args.join(" ") || pipe;
  if (!text) return pipe;
  if (ctx.onImpersonate) {
    await ctx.onImpersonate(text);
  } else {
    await ctx.onSend(`[impersonate] ${text}`);
    await ctx.onTrigger();
  }
  return text;
};

/** /continue - 继续生成 */
export const handleContinue: CommandHandler = async (_args, _namedArgs, ctx, pipe) => {
  if (ctx.onContinue) {
    await ctx.onContinue();
  } else {
    await ctx.onTrigger();
  }
  return pipe;
};

/** /swipe - 切换回复 swipe（占位实现） */
export const handleSwipe: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (ctx.onSwipe) {
    await ctx.onSwipe(args[0]);
  }
  return pipe;
};

/* ═══════════════════════════════════════════════════════════════════════════
   Checkpoint 命令（P2 高频缺口）
   ═══════════════════════════════════════════════════════════════════════════ */

interface CheckpointSessionState {
  autoSeed: number;
  currentCheckpoint: string | null;
  parentChatName: string;
  messageToCheckpoint: Map<string, string>;
}

const CHECKPOINT_SESSIONS: Map<string, CheckpointSessionState> = new Map();

function getCheckpointSessionKey(ctx: Parameters<CommandHandler>[2]): string {
  return ctx.characterId || "__global__";
}

function getCheckpointSession(ctx: Parameters<CommandHandler>[2]): CheckpointSessionState {
  const key = getCheckpointSessionKey(ctx);
  const existing = CHECKPOINT_SESSIONS.get(key);
  if (existing) {
    return existing;
  }

  const created: CheckpointSessionState = {
    autoSeed: 0,
    currentCheckpoint: null,
    parentChatName: ctx.characterId || "",
    messageToCheckpoint: new Map(),
  };
  CHECKPOINT_SESSIONS.set(key, created);
  return created;
}

function parseMessageIndex(raw: string, length: number, commandName: string): number {
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${commandName} invalid message index: ${raw}`);
  }

  const normalized = parsed < 0 ? length + parsed : parsed;
  if (normalized < 0 || normalized >= length) {
    throw new Error(`${commandName} message index out of range: ${raw}`);
  }

  return normalized;
}

function resolveCheckpointMessage(
  ctx: Parameters<CommandHandler>[2],
  rawIndex: string | undefined,
  commandName: string,
): { index: number; messageId: string } {
  const messages = ctx.messages ?? [];
  if (messages.length === 0) {
    throw new Error(`${commandName} requires at least one message`);
  }

  const fallbackIndex = String(messages.length - 1);
  const indexSource = (rawIndex ?? fallbackIndex).trim();
  const index = parseMessageIndex(indexSource, messages.length, commandName);
  const message = messages[index];
  if (!message?.id) {
    throw new Error(`${commandName} target message has no id`);
  }

  return { index, messageId: message.id };
}

function pickMessageIndexSource(...sources: Array<string | undefined>): string | undefined {
  for (const source of sources) {
    if (typeof source === "string" && source.trim().length > 0) {
      return source;
    }
  }
  return undefined;
}

function nextLinkName(session: CheckpointSessionState, prefix: "checkpoint" | "branch"): string {
  const existed = new Set(session.messageToCheckpoint.values());
  while (true) {
    session.autoSeed += 1;
    const candidate = `${prefix}-${session.autoSeed}`;
    if (!existed.has(candidate)) {
      return candidate;
    }
  }
}

/** /checkpoint-create [name] - 在目标消息上创建 checkpoint */
export const handleCheckpointCreate: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const rawIndex = namedArgs.mesId ?? namedArgs.mes;
  const { messageId } = resolveCheckpointMessage(ctx, rawIndex, "/checkpoint-create");
  const requestedName = (args.join(" ") || pipe || "").trim() || undefined;

  if (ctx.createCheckpoint) {
    return Promise.resolve(ctx.createCheckpoint(messageId, requestedName));
  }

  const session = getCheckpointSession(ctx);
  const checkpointName = requestedName || nextLinkName(session, "checkpoint");
  session.messageToCheckpoint.set(messageId, checkpointName);
  return checkpointName;
};

/** /branch-create [mesId] - 在目标消息创建分支并进入分支会话 */
export const handleBranchCreate: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const rawIndex = pickMessageIndexSource(namedArgs.mesId, namedArgs.mes, args[0], pipe);
  const { messageId } = resolveCheckpointMessage(ctx, rawIndex, "/branch-create");

  if (ctx.createBranch) {
    return Promise.resolve(ctx.createBranch(messageId));
  }

  const session = getCheckpointSession(ctx);
  const branchName = nextLinkName(session, "branch");
  session.messageToCheckpoint.set(messageId, branchName);
  session.currentCheckpoint = branchName;
  session.parentChatName = ctx.characterId || session.parentChatName;
  return branchName;
};

/** /checkpoint-get [mesId] - 获取目标消息关联的 checkpoint 名称 */
export const handleCheckpointGet: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const rawIndex = pickMessageIndexSource(namedArgs.mesId, namedArgs.mes, args[0], pipe);
  const { messageId } = resolveCheckpointMessage(ctx, rawIndex, "/checkpoint-get");
  if (ctx.getCheckpoint) {
    return Promise.resolve(ctx.getCheckpoint(messageId));
  }
  const session = getCheckpointSession(ctx);
  return session.messageToCheckpoint.get(messageId) ?? "";
};

/** /checkpoint-list [links=true|false] - 列出当前会话的 checkpoint */
export const handleCheckpointList: CommandHandler = async (_args, namedArgs, ctx, _pipe) => {
  const links = parseBoolean(namedArgs.links, false) ?? false;
  if (ctx.listCheckpoints) {
    return JSON.stringify(await Promise.resolve(ctx.listCheckpoints({ links })));
  }

  const session = getCheckpointSession(ctx);
  const result: Array<number | string> = [];
  const messages = ctx.messages ?? [];
  messages.forEach((message, index) => {
    const checkpointName = session.messageToCheckpoint.get(message.id);
    if (!checkpointName) {
      return;
    }
    result.push(links ? checkpointName : index);
  });

  return JSON.stringify(result);
};

/** /checkpoint-go [mesId] - 进入目标消息关联的 checkpoint */
export const handleCheckpointGo: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const rawIndex = pickMessageIndexSource(namedArgs.mesId, namedArgs.mes, args[0], pipe);
  const { messageId } = resolveCheckpointMessage(ctx, rawIndex, "/checkpoint-go");

  if (ctx.goCheckpoint) {
    return Promise.resolve(ctx.goCheckpoint(messageId));
  }

  const session = getCheckpointSession(ctx);
  const checkpointName = session.messageToCheckpoint.get(messageId);
  if (!checkpointName) {
    return "";
  }

  session.currentCheckpoint = checkpointName;
  session.parentChatName = ctx.characterId || session.parentChatName;
  return checkpointName;
};

/** /checkpoint-exit - 退出当前 checkpoint，会返回父会话名 */
export const handleCheckpointExit: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (ctx.exitCheckpoint) {
    return Promise.resolve(ctx.exitCheckpoint());
  }

  const session = getCheckpointSession(ctx);
  if (!session.currentCheckpoint) {
    return "";
  }

  session.currentCheckpoint = null;
  return session.parentChatName;
};

/** /checkpoint-parent - 返回当前 checkpoint 的父会话名 */
export const handleCheckpointParent: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (ctx.getCheckpointParent) {
    return Promise.resolve(ctx.getCheckpointParent());
  }

  const session = getCheckpointSession(ctx);
  if (!session.currentCheckpoint) {
    return "";
  }

  return session.parentChatName;
};

/* ═══════════════════════════════════════════════════════════════════════════
   工具命令
   ═══════════════════════════════════════════════════════════════════════════ */

/** /echo <text> - 回显文本（用于调试） */
export const handleEcho: CommandHandler = async (args, _namedArgs, _ctx, pipe) => {
  return args.length > 0 ? args.join(" ") : pipe;
};

/** /? - 返回最小可用帮助文本 */
export const handleHelp: CommandHandler = async (_args, _namedArgs, _ctx, _pipe) => {
  return "Use /send, /trigger, /setvar, /run, /checkpoint-create, /branch-create for host-mode scripts.";
};

/** /pass - 透传 pipe 值 */
export const handlePass: CommandHandler = async (_args, _namedArgs, _ctx, pipe) => {
  return pipe;
};

/** /return <value?> - 返回一个值并中止执行链 */
export const handleReturn: CommandHandler = async (args, _namedArgs, _ctx, pipe) => {
  return args[0] ?? pipe;
};
