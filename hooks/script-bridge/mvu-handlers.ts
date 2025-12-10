/**
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

/** 获取变量 - 兼容 TavernHelper.getVariables */
async function getMessageVariable(args: unknown[], ctx: ApiCallContext): Promise<unknown> {
  const [options] = args as [{ type?: string; message_id?: string; category?: string }?];

  // 优先从持久化层读取
  if (ctx.characterId) {
    const variables = options?.message_id
      ? await getNodeVariables(ctx.characterId, options.message_id)
      : await getCharacterVariables(ctx.characterId);

    if (variables) {
      const category = options?.category || "stat";
      switch (category) {
        case "display": return variables.display_data;
        case "delta": return variables.delta_data;
        default: return variables.stat_data;
      }
    }
  }

  // 回退到内存 store
  const sessionKey = getSessionKey(ctx.characterId || "global");
  const store = useMvuStore.getState();
  const variables = store.getVariables(sessionKey);
  if (!variables) return null;

  const category = options?.category || "stat";
  switch (category) {
    case "display": return variables.display_data;
    case "delta": return variables.delta_data;
    default: return variables.stat_data;
  }
}

/** 获取指定消息的变量快照 */
async function getMessageVariables(args: unknown[], ctx: ApiCallContext): Promise<MvuData | null> {
  const [messageId] = args as [string?];

  // 优先从持久化层读取
  if (ctx.characterId) {
    if (messageId) {
      return getNodeVariables(ctx.characterId, messageId);
    }
    return getCharacterVariables(ctx.characterId);
  }

  // 回退到内存 store
  const sessionKey = getSessionKey(ctx.characterId || "global");
  const store = useMvuStore.getState();
  return messageId
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
  const sessionKey = getSessionKey(ctx.characterId || "global");
  const store = useMvuStore.getState();

  store.initSession(sessionKey, initialData || {});
  return true;
}

/** 设置单个变量 */
function setMvuVariable(args: unknown[], ctx: ApiCallContext): boolean {
  const [path, value, reason] = args as [string, unknown, string?];
  const sessionKey = getSessionKey(ctx.characterId || "global");
  const store = useMvuStore.getState();

  return store.setVariable(sessionKey, path, value, reason);
}

/** 批量设置变量 */
function setMvuVariables(args: unknown[], ctx: ApiCallContext): void {
  const [updates] = args as [Array<{ path: string; value: unknown; reason?: string }>];
  const sessionKey = getSessionKey(ctx.characterId || "global");
  const store = useMvuStore.getState();

  store.setVariables(sessionKey, updates);
}

/** 从消息内容更新变量 */
function updateFromMessage(args: unknown[], ctx: ApiCallContext): { modified: boolean } {
  const [messageId, messageContent] = args as [string, string];
  const sessionKey = getSessionKey(ctx.characterId || "global");
  const store = useMvuStore.getState();

  return store.updateFromMessage(sessionKey, messageId, messageContent);
}

// ============================================================================
//                              快照管理
// ============================================================================

/** 保存变量快照 */
function saveSnapshot(args: unknown[], ctx: ApiCallContext): void {
  const [messageId] = args as [string];
  const sessionKey = getSessionKey(ctx.characterId || "global");
  const store = useMvuStore.getState();

  store.saveSnapshot(sessionKey, messageId);
}

/** 回滚到快照 */
function rollbackToSnapshot(args: unknown[], ctx: ApiCallContext): boolean {
  const [messageId] = args as [string];
  const sessionKey = getSessionKey(ctx.characterId || "global");
  const store = useMvuStore.getState();

  return store.rollbackToSnapshot(sessionKey, messageId);
}

/** 清理旧快照 */
function cleanupSnapshots(args: unknown[], ctx: ApiCallContext): void {
  const [keepCount = 20] = args as [number?];
  const sessionKey = getSessionKey(ctx.characterId || "global");
  const store = useMvuStore.getState();

  store.cleanupSnapshots(sessionKey, keepCount);
}

// ============================================================================
//                              会话管理
// ============================================================================

/** 检查是否已初始化 */
function isInitialized(_args: unknown[], ctx: ApiCallContext): boolean {
  const sessionKey = getSessionKey(ctx.characterId || "global");
  const store = useMvuStore.getState();

  return store.isInitialized(sessionKey);
}

/** 清除会话变量 */
function clearSession(_args: unknown[], ctx: ApiCallContext): void {
  const sessionKey = getSessionKey(ctx.characterId || "global");
  const store = useMvuStore.getState();

  store.clearSession(sessionKey);
}

// ============================================================================
//                              兼容性 API
// ============================================================================

/** 兼容 getvar 宏 */
function getvar(args: unknown[], ctx: ApiCallContext): unknown {
  const [key] = args as [string];
  const sessionKey = getSessionKey(ctx.characterId || "global");
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
