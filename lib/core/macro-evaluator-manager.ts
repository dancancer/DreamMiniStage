/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     宏评估器管理器                                          ║
 * ║                                                                            ║
 * ║  按对话隔离管理 STMacroEvaluator 实例                                       ║
 * ║  支持变量持久化和恢复                                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { STMacroEvaluator } from "./st-macro-evaluator";
import {
  getAllVariables,
  saveAllVariables,
} from "@/lib/data/roleplay/macro-variable-operation";

/* ═══════════════════════════════════════════════════════════════════════════
   评估器缓存（按对话隔离）
   ═══════════════════════════════════════════════════════════════════════════ */

const evaluatorCache = new Map<string, STMacroEvaluator>();

/* ═══════════════════════════════════════════════════════════════════════════
   公共 API
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 获取对话专属的宏评估器
 * 
 * 如果缓存中存在则直接返回，否则创建新实例并从持久化存储恢复变量
 */
export async function getEvaluatorForDialogue(
  dialogueKey: string,
): Promise<STMacroEvaluator> {
  const cached = evaluatorCache.get(dialogueKey);
  if (cached) {
    return cached;
  }

  const evaluator = new STMacroEvaluator();

  // 从持久化存储恢复变量
  const variables = await getAllVariables(dialogueKey);
  evaluator.importVariables(variables);

  evaluatorCache.set(dialogueKey, evaluator);
  return evaluator;
}

/**
 * 持久化对话的变量状态
 * 
 * 在消息发送后调用，将变量保存到 IndexedDB
 */
export async function persistVariables(dialogueKey: string): Promise<void> {
  const evaluator = evaluatorCache.get(dialogueKey);
  if (!evaluator) {
    return;
  }

  const variables = evaluator.exportVariables();
  await saveAllVariables(dialogueKey, variables);
}

/**
 * 清除对话的评估器缓存
 * 
 * 在对话删除或切换时调用
 */
export function clearEvaluatorCache(dialogueKey?: string): void {
  if (dialogueKey) {
    evaluatorCache.delete(dialogueKey);
  } else {
    evaluatorCache.clear();
  }
}

/**
 * 获取缓存的评估器（不创建新实例）
 */
export function getCachedEvaluator(dialogueKey: string): STMacroEvaluator | undefined {
  return evaluatorCache.get(dialogueKey);
}
