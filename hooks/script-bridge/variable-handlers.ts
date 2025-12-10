/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         变量操作 Handlers                                  ║
 * ║                                                                            ║
 * ║  SillyTavern 兼容层：                                                       ║
 * ║  • getVariables()           - 获取所有变量（全局 + 角色）                    ║
 * ║  • replaceVariables(vars)   - 替换所有变量                                  ║
 * ║  • insertOrAssignVariables  - 合并变量（新值覆盖旧值）                       ║
 * ║  • deleteVariable(key)      - 删除指定变量                                  ║
 * ║                                                                            ║
 * ║  持久化：通过 Zustand persist 中间件自动同步到 localStorage                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiCallContext, ApiHandlerMap } from "./types";

// ============================================================================
//                              类型定义
// ============================================================================

type VariableValue = string | number | boolean | null | undefined;
type VariablesObject = Record<string, VariableValue>;

// ============================================================================
//                              核心 Handler 实现
// ============================================================================

/**
 * 获取所有变量
 * 返回合并后的视图：全局变量 + 当前角色变量（角色变量优先）
 * Requirements: 2.1
 */
function getVariables(_args: unknown[], ctx: ApiCallContext): Record<string, unknown> {
  const snapshot = ctx.getVariablesSnapshot();
  const characterVars = ctx.characterId
    ? (snapshot.character[ctx.characterId] ?? {})
    : {};

  // 合并：角色变量覆盖全局变量
  return { ...snapshot.global, ...characterVars };
}

/**
 * 替换所有变量
 * 清空现有变量，用新对象完全替换
 * Requirements: 2.2
 */
function replaceVariables(args: unknown[], ctx: ApiCallContext): boolean {
  const [vars] = args as [VariablesObject];
  if (!vars || typeof vars !== "object") return false;

  const snapshot = ctx.getVariablesSnapshot();

  // 清空全局变量
  for (const key of Object.keys(snapshot.global)) {
    ctx.deleteScriptVariable(key, "global");
  }

  // 清空当前角色变量
  if (ctx.characterId && snapshot.character[ctx.characterId]) {
    for (const key of Object.keys(snapshot.character[ctx.characterId])) {
      ctx.deleteScriptVariable(key, "character", ctx.characterId);
    }
  }

  // 写入新变量（全部存为全局）
  for (const [key, value] of Object.entries(vars)) {
    ctx.setScriptVariable(key, value, "global");
  }

  return true;
}

/**
 * 合并变量
 * 将新变量合并到现有变量中，新值覆盖旧值
 * Requirements: 2.3
 */
function insertOrAssignVariables(args: unknown[], ctx: ApiCallContext): boolean {
  const [vars] = args as [VariablesObject];
  if (!vars || typeof vars !== "object") return false;

  for (const [key, value] of Object.entries(vars)) {
    ctx.setScriptVariable(key, value, "global");
  }

  return true;
}

/**
 * 设置单个变量
 * Requirements: 2.3 (单值版本)
 */
function setVariable(args: unknown[], ctx: ApiCallContext): boolean {
  const [key, value, scope = "global"] = args as [string, VariableValue, "global" | "character"];
  if (typeof key !== "string") return false;

  const finalScope = scope === "character" && ctx.characterId ? "character" : "global";
  ctx.setScriptVariable(key, value, finalScope, ctx.characterId);
  return true;
}

/**
 * 删除单个变量
 * Requirements: 2.4
 */
function deleteVariable(args: unknown[], ctx: ApiCallContext): boolean {
  const [key, scope = "global"] = args as [string, "global" | "character"];
  if (typeof key !== "string") return false;

  const finalScope = scope === "character" && ctx.characterId ? "character" : "global";
  ctx.deleteScriptVariable(key, finalScope, ctx.characterId);
  return true;
}

/**
 * 获取单个变量值
 * 先查角色变量，再查全局变量
 */
function getVariable(args: unknown[], ctx: ApiCallContext): VariableValue {
  const [key] = args as [string];
  if (typeof key !== "string") return undefined;

  const snapshot = ctx.getVariablesSnapshot();

  // 优先返回角色变量
  if (ctx.characterId && snapshot.character[ctx.characterId]?.[key] !== undefined) {
    return snapshot.character[ctx.characterId][key] as VariableValue;
  }

  return snapshot.global[key] as VariableValue;
}

// ============================================================================
//                              导出 Handler Map
// ============================================================================

export const variableHandlers: ApiHandlerMap = {
  // SillyTavern 兼容 API
  "getVariables": getVariables,
  "replaceVariables": replaceVariables,
  "insertOrAssignVariables": insertOrAssignVariables,
  "deleteVariable": deleteVariable,

  // 单值操作 API
  "setVariable": setVariable,
  "getVariable": getVariable,
};
