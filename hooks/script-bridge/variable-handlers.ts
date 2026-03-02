/**
 * @input  hooks/script-bridge/types, hooks/script-bridge/scoped-variables
 * @output variableHandlers
 * @pos    变量操作 Handlers - SillyTavern 兼容的多作用域变量管理
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         变量操作 Handlers                                  ║
 * ║                                                                            ║
 * ║  SillyTavern 兼容层（支持多作用域）：                                         ║
 * ║  • getVariables(option?)     - 获取变量（默认 chat 作用域）                  ║
 * ║  • replaceVariables(vars)    - 替换变量（默认 chat 作用域）                  ║
 * ║  • insertOrAssignVariables   - 合并变量                                    ║
 * ║  • deleteVariable(key)       - 删除变量                                    ║
 * ║  • getVariable(key, option?) - 获取单个变量                                ║
 * ║  • setVariable(key, value, option?) - 设置单个变量                         ║
 * ║                                                                            ║
 * ║  作用域优先级：script > message > chat > character > preset > global        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiCallContext, ApiHandlerMap } from "./types";
import {
  scopedVariables,
  parseVariableKey,
  type VariableScope,
  type VariableContext,
} from "./scoped-variables";

// ============================================================================
//                              类型定义
// ============================================================================

type VariableValue = string | number | boolean | null | undefined;
type VariablesObject = Record<string, VariableValue>;
type VariableOptionType =
  | "global"
  | "character"
  | "chat"
  | "preset"
  | "message"
  | "script"
  | "local"
  | "cache";

interface VariableApiOptions {
  type?: VariableOptionType;
  scope?: VariableOptionType;
  message_id?: number | string | "latest";
  messageId?: number | string | "latest";
}

const DEFAULT_COLLECTION_SCOPE: VariableScope = "chat";
const SCOPE_ALIASES: Record<string, VariableScope> = {
  global: "global",
  character: "character",
  chat: "chat",
  preset: "preset",
  message: "message",
  script: "script",
  // 兼容旧命名
  local: "chat",
  cache: "script",
};

// ============================================================================
//                              辅助函数
// ============================================================================

/**
 * 从 ApiCallContext 构建 VariableContext
 */
function buildVariableContext(ctx: ApiCallContext, extraCtx?: Partial<VariableContext>): VariableContext {
  return {
    characterId: ctx.characterId,
    chatId: ctx.chatId ?? ctx.dialogueId,
    messageId: ctx.messageId,
    presetName: ctx.presetName,
    ...extraCtx,
  };
}

/**
 * 解析作用域参数
 * 支持 "global" | "character" | "chat" | "preset" | "message" | "script"
 * 兼容别名 "local" -> "chat", "cache" -> "script"
 */
function parseScope(scope: unknown, fallback: VariableScope = DEFAULT_COLLECTION_SCOPE): VariableScope {
  if (typeof scope !== "string") return fallback;
  return SCOPE_ALIASES[scope.trim().toLowerCase()] ?? fallback;
}

/**
 * 将 message_id 解析为当前系统可识别的消息 ID
 * 兼容：
 * - number（支持负索引，-1 为最后一条）
 * - "latest"
 * - 字符串消息 ID
 */
function resolveMessageId(messageId: unknown, ctx: ApiCallContext): string {
  const messages = ctx.messages;
  const total = messages.length;

  if (messageId === undefined || messageId === "latest") {
    const latestId = messages[total - 1]?.id;
    if (!latestId) {
      throw new Error("message 作用域需要有效的 message_id，但当前会话没有消息");
    }
    return latestId;
  }

  if (typeof messageId === "number") {
    if (!Number.isInteger(messageId)) {
      throw new Error(`message_id 必须是整数，收到: ${messageId}`);
    }

    if (messageId < -total || messageId >= total) {
      throw new Error(`message_id '${messageId}' 超出范围 [${-total}, ${total})`);
    }

    const normalizedIndex = messageId < 0 ? total + messageId : messageId;
    const resolvedId = messages[normalizedIndex]?.id;
    if (!resolvedId) {
      throw new Error(`无法解析 message_id '${messageId}' 对应的消息`);
    }
    return resolvedId;
  }

  if (typeof messageId === "string") {
    const matched = messages.find((message) => message.id === messageId);
    if (matched?.id) {
      return matched.id;
    }

    const numericMessageId = Number(messageId);
    if (messageId.trim() !== "" && Number.isInteger(numericMessageId)) {
      return resolveMessageId(numericMessageId, ctx);
    }

    return messageId;
  }

  throw new Error(`不支持的 message_id 类型: ${typeof messageId}`);
}

/**
 * 统一解析变量作用域选项
 * 支持：
 * - 旧语义：scope 字符串
 * - 新语义：{ type, message_id }
 */
function resolveVariableOption(
  rawOption: unknown,
  ctx: ApiCallContext,
  fallbackScope: VariableScope = DEFAULT_COLLECTION_SCOPE,
): { scope: VariableScope; varCtx: VariableContext } {
  if (rawOption === undefined || rawOption === null) {
    return {
      scope: fallbackScope,
      varCtx: buildVariableContext(ctx),
    };
  }

  if (typeof rawOption === "string") {
    return {
      scope: parseScope(rawOption, fallbackScope),
      varCtx: buildVariableContext(ctx),
    };
  }

  if (typeof rawOption !== "object") {
    return {
      scope: fallbackScope,
      varCtx: buildVariableContext(ctx),
    };
  }

  const option = rawOption as VariableApiOptions;
  const scope = parseScope(option.type ?? option.scope, fallbackScope);

  if (scope !== "message") {
    return {
      scope,
      varCtx: buildVariableContext(ctx),
    };
  }

  const resolvedMessageId = resolveMessageId(option.message_id ?? option.messageId, ctx);
  return {
    scope,
    varCtx: buildVariableContext(ctx, { messageId: resolvedMessageId }),
  };
}

// ============================================================================
//                              核心 Handler 实现
// ============================================================================

/**
 * 获取变量
 * @param args [options?: string | { type?: string; scope?: string; message_id?: string | number }]
 */
function getVariables(args: unknown[], ctx: ApiCallContext): Record<string, unknown> {
  const [options] = args as [VariableApiOptions | string | undefined];
  const { scope, varCtx } = resolveVariableOption(options, ctx, DEFAULT_COLLECTION_SCOPE);
  return scopedVariables.getAll(scope, varCtx);
}

/**
 * 替换变量
 * 清空指定作用域，用新对象替换
 * @param args [vars: object, option?: string | { type?: string; scope?: string; message_id?: string | number }]
 */
function replaceVariables(args: unknown[], ctx: ApiCallContext): boolean {
  const [vars, optionArg] = args as [VariablesObject, VariableApiOptions | string | undefined];
  if (!vars || typeof vars !== "object") return false;

  const { scope, varCtx } = resolveVariableOption(optionArg, ctx, DEFAULT_COLLECTION_SCOPE);

  // 清空作用域
  scopedVariables.clear(scope, varCtx);

  // 写入新变量
  for (const [key, value] of Object.entries(vars)) {
    scopedVariables.set(key, value, scope, varCtx);
  }

  return true;
}

/**
 * 合并变量
 * @param args [vars: object, option?: string | { type?: string; scope?: string; message_id?: string | number }]
 */
function insertOrAssignVariables(args: unknown[], ctx: ApiCallContext): boolean {
  const [vars, optionArg] = args as [VariablesObject, VariableApiOptions | string | undefined];
  if (!vars || typeof vars !== "object") return false;

  const { scope, varCtx } = resolveVariableOption(optionArg, ctx, DEFAULT_COLLECTION_SCOPE);

  for (const [key, value] of Object.entries(vars)) {
    scopedVariables.set(key, value, scope, varCtx);
  }
  return true;
}

/**
 * 设置单个变量
 * @param args [key: string, value: any, option?: string | { type?: string; scope?: string; message_id?: string | number }]
 *
 * key 支持 scope:varName 格式，如 "chat:counter"
 */
function setVariable(args: unknown[], ctx: ApiCallContext): boolean {
  const [rawKey, value, scopeArg] = args as [string, VariableValue, VariableApiOptions | string | undefined];
  if (typeof rawKey !== "string") return false;

  // 解析 key 中可能包含的作用域
  const { scope: parsedScope, key } = parseVariableKey(rawKey);
  const { scope: finalScope, varCtx } = scopeArg === undefined
    ? { scope: parsedScope, varCtx: buildVariableContext(ctx) }
    : resolveVariableOption(scopeArg, ctx, parsedScope);

  return scopedVariables.set(key, value, finalScope, varCtx);
}

/**
 * 删除单个变量
 * @param args [key: string, option?: string | { type?: string; scope?: string; message_id?: string | number }]
 */
function deleteVariable(args: unknown[], ctx: ApiCallContext): boolean {
  const [rawKey, scopeArg] = args as [string, VariableApiOptions | string | undefined];
  if (typeof rawKey !== "string") return false;

  const { scope: parsedScope, key } = parseVariableKey(rawKey);
  const { scope: finalScope, varCtx } = scopeArg === undefined
    ? { scope: parsedScope, varCtx: buildVariableContext(ctx) }
    : resolveVariableOption(scopeArg, ctx, parsedScope);

  return scopedVariables.delete(key, finalScope, varCtx);
}

/**
 * 获取单个变量值
 * @param args [key: string, option?: string | { type?: string; scope?: string; message_id?: string | number }]
 */
function getVariable(args: unknown[], ctx: ApiCallContext): VariableValue {
  const [rawKey, scopeArg] = args as [string, VariableApiOptions | string | undefined];
  if (typeof rawKey !== "string") return undefined;

  const { scope: parsedScope, key } = parseVariableKey(rawKey);
  const { scope: finalScope, varCtx } = scopeArg === undefined
    ? { scope: parsedScope, varCtx: buildVariableContext(ctx) }
    : resolveVariableOption(scopeArg, ctx, parsedScope);

  return scopedVariables.get(key, varCtx, finalScope) as VariableValue;
}

/**
 * 列出所有变量名
 * @param args [option?: string | { type?: string; scope?: string; message_id?: string | number }]
 */
function listVariables(args: unknown[], ctx: ApiCallContext): string[] {
  const [scopeArg] = args as [VariableApiOptions | string | undefined];
  const { scope, varCtx } = resolveVariableOption(scopeArg, ctx, DEFAULT_COLLECTION_SCOPE);
  return Object.keys(scopedVariables.getAll(scope, varCtx));
}

/**
 * 清空变量
 * @param args [option?: string | { type?: string; scope?: string; message_id?: string | number }]
 */
function flushVariables(args: unknown[], ctx: ApiCallContext): boolean {
  const [scopeArg] = args as [VariableApiOptions | string | undefined];
  const { scope, varCtx } = resolveVariableOption(scopeArg, ctx, DEFAULT_COLLECTION_SCOPE);

  scopedVariables.clear(scope, varCtx);

  return true;
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

  // 扩展 API
  "listVariables": listVariables,
  "flushVariables": flushVariables,
};
