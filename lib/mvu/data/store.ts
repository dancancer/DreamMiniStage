/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 状态存储                                       ║
 * ║                                                                            ║
 * ║  管理角色/会话级别的变量状态                                                  ║
 * ║  设计原则：按会话隔离，支持快照与回滚                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { create } from "zustand";
import type { MvuData, StatData } from "../types";
import { updateVariablesFromMessage, updateSingleVariable } from "../core/executor";

// ============================================================================
//                              工具函数
// ============================================================================

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ============================================================================
//                              类型定义
// ============================================================================

interface MessageVariables {
  messageId: string;
  variables: MvuData;
  timestamp: number;
}

interface SessionState {
  current: MvuData;
  snapshots: MessageVariables[];
  initialized: boolean;
}

interface MvuStoreState {
  sessions: Record<string, SessionState>;
  initSession: (sessionKey: string, initialData: StatData) => void;
  isInitialized: (sessionKey: string) => boolean;
  getVariables: (sessionKey: string) => MvuData | null;
  updateFromMessage: (
    sessionKey: string,
    messageId: string,
    messageContent: string
  ) => { modified: boolean; results: unknown[] };
  setVariable: (sessionKey: string, path: string, value: unknown, reason?: string) => boolean;
  setVariables: (sessionKey: string, updates: Array<{ path: string; value: unknown; reason?: string }>) => void;
  saveSnapshot: (sessionKey: string, messageId: string) => void;
  rollbackToSnapshot: (sessionKey: string, messageId: string) => boolean;
  getMessageVariables: (sessionKey: string, messageId: string) => MvuData | null;
  cleanupSnapshots: (sessionKey: string, keepCount: number) => void;
  clearSession: (sessionKey: string) => void;
  clearAll: () => void;
}

// ============================================================================
//                              默认状态
// ============================================================================

const createDefaultMvuData = (statData: StatData = {}): MvuData => ({
  stat_data: statData,
  display_data: deepClone(statData),
  delta_data: {},
  initialized_lorebooks: {},
});

// ============================================================================
//                              Store 实现
// ============================================================================

export const useMvuStore = create<MvuStoreState>((set, get) => ({
  sessions: {},

  initSession: (sessionKey, initialData) => {
    set((state) => ({
      sessions: {
        ...state.sessions,
        [sessionKey]: {
          current: createDefaultMvuData(initialData),
          snapshots: [],
          initialized: true,
        },
      },
    }));
  },

  isInitialized: (sessionKey) => get().sessions[sessionKey]?.initialized ?? false,

  getVariables: (sessionKey) => get().sessions[sessionKey]?.current ?? null,

  updateFromMessage: (sessionKey, messageId, messageContent) => {
    const session = get().sessions[sessionKey];
    if (!session) return { modified: false, results: [] };

    const result = updateVariablesFromMessage(messageContent, session.current);

    if (result.modified) {
      set((state) => ({
        sessions: {
          ...state.sessions,
          [sessionKey]: {
            ...state.sessions[sessionKey],
            current: result.variables,
            snapshots: [
              ...state.sessions[sessionKey].snapshots,
              { messageId, variables: deepClone(result.variables), timestamp: Date.now() },
            ],
          },
        },
      }));
    }

    return { modified: result.modified, results: result.results };
  },

  setVariable: (sessionKey, path, value, reason = "") => {
    const session = get().sessions[sessionKey];
    if (!session) return false;

    const variables = deepClone(session.current);
    const result = updateSingleVariable(variables, path, value, reason);

    if (result.success) {
      set((state) => ({
        sessions: {
          ...state.sessions,
          [sessionKey]: { ...state.sessions[sessionKey], current: variables },
        },
      }));
    }

    return result.success;
  },

  setVariables: (sessionKey, updates) => {
    const session = get().sessions[sessionKey];
    if (!session) return;

    const variables = deepClone(session.current);
    for (const { path, value, reason } of updates) {
      updateSingleVariable(variables, path, value, reason);
    }

    set((state) => ({
      sessions: {
        ...state.sessions,
        [sessionKey]: { ...state.sessions[sessionKey], current: variables },
      },
    }));
  },

  saveSnapshot: (sessionKey, messageId) => {
    const session = get().sessions[sessionKey];
    if (!session) return;

    set((state) => ({
      sessions: {
        ...state.sessions,
        [sessionKey]: {
          ...state.sessions[sessionKey],
          snapshots: [
            ...state.sessions[sessionKey].snapshots,
            { messageId, variables: deepClone(session.current), timestamp: Date.now() },
          ],
        },
      },
    }));
  },

  rollbackToSnapshot: (sessionKey, messageId) => {
    const session = get().sessions[sessionKey];
    if (!session) return false;

    const snapshotIndex = session.snapshots.findIndex((s) => s.messageId === messageId);
    if (snapshotIndex === -1) return false;

    const snapshot = session.snapshots[snapshotIndex];

    set((state) => ({
      sessions: {
        ...state.sessions,
        [sessionKey]: {
          ...state.sessions[sessionKey],
          current: deepClone(snapshot.variables),
          snapshots: state.sessions[sessionKey].snapshots.slice(0, snapshotIndex + 1),
        },
      },
    }));

    return true;
  },

  getMessageVariables: (sessionKey, messageId) => {
    const session = get().sessions[sessionKey];
    if (!session) return null;
    const snapshot = session.snapshots.find((s) => s.messageId === messageId);
    return snapshot?.variables ?? null;
  },

  cleanupSnapshots: (sessionKey, keepCount) => {
    const session = get().sessions[sessionKey];
    if (!session || session.snapshots.length <= keepCount) return;

    set((state) => ({
      sessions: {
        ...state.sessions,
        [sessionKey]: {
          ...state.sessions[sessionKey],
          snapshots: state.sessions[sessionKey].snapshots.slice(-keepCount),
        },
      },
    }));
  },

  clearSession: (sessionKey) => {
    set((state) => {
      const newSessions = { ...state.sessions };
      delete newSessions[sessionKey];
      return { sessions: newSessions };
    });
  },

  clearAll: () => set({ sessions: {} }),
}));

// ============================================================================
//                              导出工具函数
// ============================================================================

export function getSessionKey(characterId: string, sessionId?: string): string {
  return sessionId ? `${characterId}:${sessionId}` : characterId;
}

export function safeGetValue<T = unknown>(value: unknown, defaultValue: T | null = null): T | null {
  if (value === undefined || value === null) return defaultValue;
  if (Array.isArray(value) && value.length === 2 && typeof value[1] === "string") {
    return value[0] as T;
  }
  return value as T;
}
