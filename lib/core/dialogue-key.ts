/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       DialogueKey 解析器                                    ║
 * ║                                                                            ║
 * ║  设计原则：单一事实源                                                        ║
 * ║  - 单一入口点解析对话标识                                                    ║
 * ║  - 消除多处回退链 (dialogueKey || sessionId || characterId)                 ║
 * ║  - 通过 React Context 传递已解析的 dialogueKey                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { createContext, useContext } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

export interface DialogueKeySource {
  dialogueKey?: string | null;
  sessionId?: string | null;
  characterId?: string | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   核心解析函数

   此函数是唯一的解析入口，其他地方不应有回退逻辑
   优先级：dialogueKey > sessionId > characterId
   ═══════════════════════════════════════════════════════════════════════════ */

export function resolveDialogueKey(source: DialogueKeySource): string | null {
  return source.dialogueKey || source.sessionId || source.characterId || null;
}

/**
 * 解析对话标识，如果无法解析则抛出错误
 * 用于必须有 dialogueKey 的场景
 */
export function resolveDialogueKeyOrThrow(source: DialogueKeySource): string {
  const key = resolveDialogueKey(source);
  if (!key) {
    throw new Error("无法解析 dialogueKey：所有来源均为空");
  }
  return key;
}

/* ═══════════════════════════════════════════════════════════════════════════
   React Context

   用于在组件树中传递已解析的 dialogueKey
   避免每个组件都要重复解析逻辑
   ═══════════════════════════════════════════════════════════════════════════ */

export const DialogueKeyContext = createContext<string | null>(null);

/**
 * 获取已解析的 dialogueKey
 * 必须在 DialogueKeyContext.Provider 内使用
 */
export function useDialogueKey(): string | null {
  return useContext(DialogueKeyContext);
}

/**
 * 获取已解析的 dialogueKey，如果不存在则抛出错误
 * 用于必须有 dialogueKey 的组件
 */
export function useDialogueKeyOrThrow(): string {
  const key = useContext(DialogueKeyContext);
  if (!key) {
    throw new Error("useDialogueKeyOrThrow: DialogueKey 未提供。请确保组件在 DialogueKeyContext.Provider 内使用");
  }
  return key;
}
