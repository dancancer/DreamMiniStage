/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         useMvu Hook                                        ║
 * ║                                                                            ║
 * ║  React 组件使用 MVU 变量管理的便捷接口                                        ║
 * ║  设计原则：响应式更新，类型安全                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback, useMemo } from "react";
import {
  useMvuStore,
  getSessionKey,
  safeGetValue,
  updateVariablesFromMessage,
} from "@/lib/mvu";
import type { MvuData, StatData } from "@/lib/mvu";

// ============================================================================
//                              类型定义
// ============================================================================

interface UseMvuOptions {
  characterId: string;
  sessionId?: string;
}

interface UseMvuReturn {
  /** 当前变量状态 */
  variables: MvuData | null;

  /** 状态数据 */
  statData: StatData | null;

  /** 显示数据 */
  displayData: Record<string, unknown> | null;

  /** 增量数据 */
  deltaData: Record<string, unknown> | null;

  /** 是否已初始化 */
  isInitialized: boolean;

  /** 初始化变量 */
  init: (initialData: StatData) => void;

  /** 获取变量值（自动处理 ValueWithDescription） */
  get: <T = unknown>(path: string, defaultValue?: T) => T | null;

  /** 设置变量 */
  set: (path: string, value: unknown, reason?: string) => boolean;

  /** 批量设置变量 */
  setMany: (updates: Array<{ path: string; value: unknown; reason?: string }>) => void;

  /** 从消息内容更新变量 */
  updateFromMessage: (messageId: string, content: string) => { modified: boolean };

  /** 保存快照 */
  saveSnapshot: (messageId: string) => void;

  /** 回滚到快照 */
  rollback: (messageId: string) => boolean;

  /** 获取消息的变量快照 */
  getMessageVariables: (messageId: string) => MvuData | null;

  /** 清除会话 */
  clear: () => void;
}

// ============================================================================
//                              Hook 实现
// ============================================================================

export function useMvu(options: UseMvuOptions): UseMvuReturn {
  const { characterId, sessionId } = options;
  const sessionKey = useMemo(
    () => getSessionKey(characterId, sessionId),
    [characterId, sessionId]
  );

  // 从 store 获取状态
  const session = useMvuStore((state) => state.sessions[sessionKey]);
  const storeActions = useMvuStore((state) => ({
    initSession: state.initSession,
    isInitialized: state.isInitialized,
    setVariable: state.setVariable,
    setVariables: state.setVariables,
    updateFromMessage: state.updateFromMessage,
    saveSnapshot: state.saveSnapshot,
    rollbackToSnapshot: state.rollbackToSnapshot,
    getMessageVariables: state.getMessageVariables,
    clearSession: state.clearSession,
  }));

  // ─── 初始化 ───
  const init = useCallback(
    (initialData: StatData) => {
      storeActions.initSession(sessionKey, initialData);
    },
    [sessionKey, storeActions]
  );

  // ─── 获取变量值 ───
  const get = useCallback(
    <T = unknown>(path: string, defaultValue?: T): T | null => {
      if (!session?.current?.stat_data) return defaultValue ?? null;

      // 解析路径
      const parts = path.split(".");
      let value: unknown = session.current.stat_data;

      for (const part of parts) {
        if (value === null || value === undefined) return defaultValue ?? null;
        if (typeof value !== "object") return defaultValue ?? null;
        value = (value as Record<string, unknown>)[part];
      }

      return safeGetValue(value, defaultValue ?? null) as T | null;
    },
    [session]
  );

  // ─── 设置变量 ───
  const set = useCallback(
    (path: string, value: unknown, reason?: string): boolean => {
      return storeActions.setVariable(sessionKey, path, value, reason);
    },
    [sessionKey, storeActions]
  );

  // ─── 批量设置 ───
  const setMany = useCallback(
    (updates: Array<{ path: string; value: unknown; reason?: string }>) => {
      storeActions.setVariables(sessionKey, updates);
    },
    [sessionKey, storeActions]
  );

  // ─── 从消息更新 ───
  const updateFromMsg = useCallback(
    (messageId: string, content: string) => {
      return storeActions.updateFromMessage(sessionKey, messageId, content);
    },
    [sessionKey, storeActions]
  );

  // ─── 保存快照 ───
  const saveSnapshot = useCallback(
    (messageId: string) => {
      storeActions.saveSnapshot(sessionKey, messageId);
    },
    [sessionKey, storeActions]
  );

  // ─── 回滚 ───
  const rollback = useCallback(
    (messageId: string): boolean => {
      return storeActions.rollbackToSnapshot(sessionKey, messageId);
    },
    [sessionKey, storeActions]
  );

  // ─── 获取消息变量 ───
  const getMessageVars = useCallback(
    (messageId: string): MvuData | null => {
      return storeActions.getMessageVariables(sessionKey, messageId);
    },
    [sessionKey, storeActions]
  );

  // ─── 清除 ───
  const clear = useCallback(() => {
    storeActions.clearSession(sessionKey);
  }, [sessionKey, storeActions]);

  return {
    variables: session?.current ?? null,
    statData: session?.current?.stat_data ?? null,
    displayData: session?.current?.display_data ?? null,
    deltaData: session?.current?.delta_data ?? null,
    isInitialized: session?.initialized ?? false,
    init,
    get,
    set,
    setMany,
    updateFromMessage: updateFromMsg,
    saveSnapshot,
    rollback,
    getMessageVariables: getMessageVars,
    clear,
  };
}
