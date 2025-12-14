/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     宏变量持久化操作                                        ║
 * ║                                                                            ║
 * ║  按对话隔离存储 setvar/getvar/addvar 等宏变量                               ║
 * ║  支持局部变量（对话级）和全局变量（跨对话）                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import {
  getRecordByKey,
  putRecord,
  deleteRecord,
  SESSIONS_RECORD_FILE,
} from "@/lib/data/local-storage";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

export interface MacroVariableStore {
  /** 对话/会话 ID */
  dialogueKey: string;
  /** 局部变量（对话级） */
  local: Record<string, string | number>;
  /** 更新时间 */
  updatedAt: string;
}

/** 全局变量存储 key */
const GLOBAL_VARIABLES_KEY = "__macro_global_variables__";

/** 局部变量存储 key 前缀 */
const LOCAL_VARIABLES_PREFIX = "__macro_local__";

/* ═══════════════════════════════════════════════════════════════════════════
   局部变量操作（对话级隔离）
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 获取对话的局部变量
 */
export async function getLocalVariables(
  dialogueKey: string,
): Promise<Record<string, string | number>> {
  const key = `${LOCAL_VARIABLES_PREFIX}${dialogueKey}`;
  const store = await getRecordByKey<MacroVariableStore>(SESSIONS_RECORD_FILE, key);
  return store?.local || {};
}

/**
 * 保存对话的局部变量
 */
export async function saveLocalVariables(
  dialogueKey: string,
  variables: Record<string, string | number>,
): Promise<void> {
  const key = `${LOCAL_VARIABLES_PREFIX}${dialogueKey}`;
  const store: MacroVariableStore = {
    dialogueKey,
    local: variables,
    updatedAt: new Date().toISOString(),
  };
  await putRecord(SESSIONS_RECORD_FILE, key, store);
}

/**
 * 清空对话的局部变量
 */
export async function clearLocalVariables(dialogueKey: string): Promise<void> {
  const key = `${LOCAL_VARIABLES_PREFIX}${dialogueKey}`;
  await deleteRecord(SESSIONS_RECORD_FILE, key);
}

/* ═══════════════════════════════════════════════════════════════════════════
   全局变量操作（跨对话共享）
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 获取全局变量
 */
export async function getGlobalVariables(): Promise<Record<string, string | number>> {
  const store = await getRecordByKey<{ global: Record<string, string | number> }>(
    SESSIONS_RECORD_FILE,
    GLOBAL_VARIABLES_KEY,
  );
  return store?.global || {};
}

/**
 * 保存全局变量
 */
export async function saveGlobalVariables(
  variables: Record<string, string | number>,
): Promise<void> {
  await putRecord(SESSIONS_RECORD_FILE, GLOBAL_VARIABLES_KEY, {
    global: variables,
    updatedAt: new Date().toISOString(),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   组合操作
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 获取对话的所有变量（局部 + 全局）
 */
export async function getAllVariables(dialogueKey: string): Promise<{
  local: Record<string, string | number>;
  global: Record<string, string | number>;
}> {
  const [local, global] = await Promise.all([
    getLocalVariables(dialogueKey),
    getGlobalVariables(),
  ]);
  return { local, global };
}

/**
 * 保存对话的所有变量
 */
export async function saveAllVariables(
  dialogueKey: string,
  variables: {
    local: Record<string, string | number>;
    global: Record<string, string | number>;
  },
): Promise<void> {
  await Promise.all([
    saveLocalVariables(dialogueKey, variables.local),
    saveGlobalVariables(variables.global),
  ]);
}
