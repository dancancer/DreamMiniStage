/**
 * @input  hooks/script-bridge/types, lib/mvu
 * @output mvuHandlers
 * @pos    MVU API Handlers - 脚本沙箱的变量管理与快照控制
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU API Handlers                                   ║
 * ║                                                                            ║
 * ║  为脚本沙箱提供 MVU 变量管理 API                                             ║
 * ║  兼容 SillyTavern 的 TavernHelper API 风格                                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiCallContext, ApiHandlerMap } from "./types";
import {
  useMvuStore,
  getSessionKey,
  safeGetValue,
  getCharacterVariables,
  getNodeVariables,
} from "@/lib/mvu";
import type { MvuData, StatData } from "@/lib/mvu";

// ============================================================================
//                              变量获取
// ============================================================================

type MvuScope = "chat" | "message" | "global" | "character" | "script";
type MvuCategory = "stat" | "display" | "delta";
type MessageRef = number | string | "latest";

interface MvuVariableOptions {
  type?: string;
  scope?: string;
  message_id?: MessageRef;
  messageId?: MessageRef;
  category?: string;
}

const MVU_SCOPE_ALIASES: Record<string, MvuScope> = {
  chat: "chat",
  message: "message",
  global: "global",
  character: "character",
  script: "script",
  local: "chat",
  cache: "script",
};

function resolveDialogueKey(ctx: ApiCallContext): string | undefined {
  return ctx.chatId ?? ctx.dialogueId ?? ctx.characterId;
}

function resolveSessionKey(ctx: ApiCallContext): string {
  return getSessionKey(resolveDialogueKey(ctx) || "global");
}

function parseScope(rawScope: unknown): MvuScope {
  if (typeof rawScope !== "string") {
    return "chat";
  }
  return MVU_SCOPE_ALIASES[rawScope.trim().toLowerCase()] ?? "chat";
}

function parseCategory(rawCategory: unknown): MvuCategory {
  if (rawCategory === "display" || rawCategory === "delta") {
    return rawCategory;
  }
  return "stat";
}

function isScopeToken(raw: string): boolean {
  return MVU_SCOPE_ALIASES[raw.trim().toLowerCase()] !== undefined;
}

function normalizeVariableOptions(rawOption: unknown): MvuVariableOptions {
  if (rawOption === undefined || rawOption === null) {
    return {};
  }

  if (typeof rawOption === "number") {
    return { type: "message", message_id: rawOption };
  }

  if (typeof rawOption === "string") {
    if (isScopeToken(rawOption)) {
      return { type: rawOption };
    }
    return { type: "message", message_id: rawOption };
  }

  if (typeof rawOption === "object") {
    return rawOption as MvuVariableOptions;
  }

  return {};
}

function resolveMessageId(rawMessageId: unknown, ctx: ApiCallContext, scope: MvuScope): string | undefined {
  if (scope !== "message" && rawMessageId === undefined) {
    return undefined;
  }

  const messages = ctx.messages;
  const total = messages.length;

  if (rawMessageId === undefined || rawMessageId === "latest") {
    const latestId = messages[total - 1]?.id;
    if (!latestId) {
      throw new Error("message 作用域需要有效的 message_id，但当前会话没有消息");
    }
    return latestId;
  }

  if (typeof rawMessageId === "number") {
    if (!Number.isInteger(rawMessageId)) {
      throw new Error(`message_id 必须是整数，收到: ${rawMessageId}`);
    }
    if (rawMessageId < -total || rawMessageId >= total) {
      throw new Error(`message_id '${rawMessageId}' 超出范围 [${-total}, ${total})`);
    }

    const normalizedIndex = rawMessageId < 0 ? total + rawMessageId : rawMessageId;
    const resolvedId = messages[normalizedIndex]?.id;
    if (!resolvedId) {
      throw new Error(`无法解析 message_id '${rawMessageId}' 对应的消息`);
    }
    return resolvedId;
  }

  if (typeof rawMessageId === "string") {
    const matched = messages.find((message) => message.id === rawMessageId);
    if (matched?.id) {
      return matched.id;
    }

    const parsed = Number(rawMessageId);
    if (rawMessageId.trim() !== "" && Number.isInteger(parsed)) {
      return resolveMessageId(parsed, ctx, scope);
    }
    return rawMessageId;
  }

  throw new Error(`不支持的 message_id 类型: ${typeof rawMessageId}`);
}

function resolveOption(rawOption: unknown, ctx: ApiCallContext): {
  scope: MvuScope;
  category: MvuCategory;
  messageId?: string;
} {
  const option = normalizeVariableOptions(rawOption);
  const scope = parseScope(option.type ?? option.scope);
  const category = parseCategory(option.category);
  const messageId = resolveMessageId(option.message_id ?? option.messageId, ctx, scope);
  return { scope, category, messageId };
}

function pickCategoryData(variables: MvuData, category: MvuCategory): unknown {
  if (category === "display") return variables.display_data;
  if (category === "delta") return variables.delta_data;
  return variables.stat_data;
}

/** 获取变量 - 兼容 TavernHelper.getVariables */
async function getMessageVariable(args: unknown[], ctx: ApiCallContext): Promise<unknown> {
  const [rawOption] = args as [unknown];
  const { scope, category, messageId } = resolveOption(rawOption, ctx);
  const dialogueKey = resolveDialogueKey(ctx);

  // 优先从持久化层读取
  if (dialogueKey) {
    const variables = scope === "message" && messageId
      ? await getNodeVariables({ dialogueKey }, messageId)
      : await getCharacterVariables({ dialogueKey });

    if (variables) {
      return pickCategoryData(variables, category);
    }
  }

  // 回退到内存 store
  const sessionKey = resolveSessionKey(ctx);
  const store = useMvuStore.getState();
  const variables = scope === "message" && messageId
    ? store.getMessageVariables(sessionKey, messageId)
    : store.getVariables(sessionKey);
  if (!variables) return null;

  return pickCategoryData(variables, category);
}

/** 获取指定消息的变量快照 */
async function getMessageVariables(args: unknown[], ctx: ApiCallContext): Promise<MvuData | null> {
  const [rawOption] = args as [unknown];
  const option = rawOption && typeof rawOption === "object"
    ? rawOption
    : normalizeVariableOptions(rawOption);
  const { scope, messageId } = resolveOption(option, ctx);
  const dialogueKey = resolveDialogueKey(ctx);

  // 优先从持久化层读取
  if (dialogueKey) {
    if (scope === "message" && messageId) {
      return getNodeVariables({ dialogueKey }, messageId);
    }
    return getCharacterVariables({ dialogueKey });
  }

  // 回退到内存 store
  const sessionKey = resolveSessionKey(ctx);
  const store = useMvuStore.getState();
  return scope === "message" && messageId
    ? store.getMessageVariables(sessionKey, messageId)
    : store.getVariables(sessionKey);
}

/** 安全获取值 - 处理 ValueWithDescription */
function getSafeValue(args: unknown[]): unknown {
  const [value, defaultValue] = args;
  return safeGetValue(value, defaultValue ?? null);
}

// ============================================================================
//                              变量设置
// ============================================================================

/** 初始化变量 */
function initVariables(args: unknown[], ctx: ApiCallContext): boolean {
  const [initialData] = args as [StatData];
  const sessionKey = resolveSessionKey(ctx);
  const store = useMvuStore.getState();

  store.initSession(sessionKey, initialData || {});
  return true;
}

/** 设置单个变量 */
function setMvuVariable(args: unknown[], ctx: ApiCallContext): boolean {
  const [path, value, reason] = args as [string, unknown, string?];
  const sessionKey = resolveSessionKey(ctx);
  const store = useMvuStore.getState();

  return store.setVariable(sessionKey, path, value, reason);
}

/** 批量设置变量 */
function setMvuVariables(args: unknown[], ctx: ApiCallContext): void {
  const [updates] = args as [Array<{ path: string; value: unknown; reason?: string }>];
  const sessionKey = resolveSessionKey(ctx);
  const store = useMvuStore.getState();

  store.setVariables(sessionKey, updates);
}

/** 从消息内容更新变量 */
function updateFromMessage(args: unknown[], ctx: ApiCallContext): { modified: boolean } {
  const [messageId, messageContent] = args as [string, string];
  const sessionKey = resolveSessionKey(ctx);
  const store = useMvuStore.getState();

  return store.updateFromMessage(sessionKey, messageId, messageContent);
}

// ============================================================================
//                              快照管理
// ============================================================================

/** 保存变量快照 */
function saveSnapshot(args: unknown[], ctx: ApiCallContext): void {
  const [messageId] = args as [string];
  const sessionKey = resolveSessionKey(ctx);
  const store = useMvuStore.getState();

  store.saveSnapshot(sessionKey, messageId);
}

/** 回滚到快照 */
function rollbackToSnapshot(args: unknown[], ctx: ApiCallContext): boolean {
  const [messageId] = args as [string];
  const sessionKey = resolveSessionKey(ctx);
  const store = useMvuStore.getState();

  return store.rollbackToSnapshot(sessionKey, messageId);
}

/** 清理旧快照 */
function cleanupSnapshots(args: unknown[], ctx: ApiCallContext): void {
  const [keepCount = 20] = args as [number?];
  const sessionKey = resolveSessionKey(ctx);
  const store = useMvuStore.getState();

  store.cleanupSnapshots(sessionKey, keepCount);
}

// ============================================================================
//                              会话管理
// ============================================================================

/** 检查是否已初始化 */
function isInitialized(_args: unknown[], ctx: ApiCallContext): boolean {
  const sessionKey = resolveSessionKey(ctx);
  const store = useMvuStore.getState();

  return store.isInitialized(sessionKey);
}

/** 清除会话变量 */
function clearSession(_args: unknown[], ctx: ApiCallContext): void {
  const sessionKey = resolveSessionKey(ctx);
  const store = useMvuStore.getState();

  store.clearSession(sessionKey);
}

// ============================================================================
//                              兼容性 API
// ============================================================================

/** 兼容 getvar 宏 */
function getvar(args: unknown[], ctx: ApiCallContext): unknown {
  const [key] = args as [string];
  const sessionKey = resolveSessionKey(ctx);
  const store = useMvuStore.getState();
  const variables = store.getVariables(sessionKey);

  if (!variables) return undefined;

  if (key === "stat_data") return variables.stat_data;
  if (key === "display_data") return variables.display_data;
  if (key === "delta_data") return variables.delta_data;

  // 尝试从 stat_data 中获取
  const value = variables.stat_data[key];
  return safeGetValue(value);
}

// ============================================================================
//                              导出 Handler Map
// ============================================================================

export const mvuHandlers: ApiHandlerMap = {
  // 变量获取
  "mvu.getVariables": getMessageVariables,
  "mvu.getVariable": getMessageVariable,
  "mvu.getSafeValue": getSafeValue,
  "get_message_variable": getMessageVariable,

  // 变量设置
  "mvu.init": initVariables,
  "mvu.set": setMvuVariable,
  "mvu.setMany": setMvuVariables,
  "mvu.updateFromMessage": updateFromMessage,

  // 快照管理
  "mvu.saveSnapshot": saveSnapshot,
  "mvu.rollback": rollbackToSnapshot,
  "mvu.cleanup": cleanupSnapshots,

  // 会话管理
  "mvu.isInitialized": isInitialized,
  "mvu.clear": clearSession,

  // 兼容性
  "getvar": getvar,
};
