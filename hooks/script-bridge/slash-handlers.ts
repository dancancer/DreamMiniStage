/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command API Handlers                         ║
 * ║                                                                            ║
 * ║  桥接 iframe 调用到 Slash Command 执行器                                    ║
 * ║  Requirements: 1.1, 8.1                                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiHandlerMap, ApiCallContext } from "./types";
import type { ExecutionContext, ExecutionResult, SendOptions } from "@/lib/slash-command/types";
import { executeSlashCommandScript } from "@/lib/slash-command/executor";

// ============================================================================
//                              上下文适配器
// ============================================================================

// ─── 回调选项类型（用于测试和向后兼容） ───
interface CallbackOptions {
  onSend?: (text: string, options?: SendOptions) => void | Promise<void>;
  onTrigger?: (member?: string) => void | Promise<void>;
  onSendAs?: (role: string, text: string) => void | Promise<void>;
  onSendSystem?: (text: string) => void | Promise<void>;
  onImpersonate?: (text: string) => void | Promise<void>;
  onContinue?: () => void | Promise<void>;
  onSwipe?: (target?: string) => void | Promise<void>;
}

/**
 * 将 ApiCallContext 适配为 ExecutionContext
 * 支持从 ctx 或 options 获取回调（options 优先，用于测试）
 */
function adaptContext(ctx: ApiCallContext, options?: CallbackOptions): ExecutionContext {
  const variables: Record<string, unknown> = Object.create(null);
  const snapshot = ctx.getVariablesSnapshot();

  // 合并全局变量和角色变量
  Object.assign(variables, snapshot.global);
  if (ctx.characterId && snapshot.character[ctx.characterId]) {
    Object.assign(variables, snapshot.character[ctx.characterId]);
  }

  // 回调优先级：options > ctx > 空函数
  const onSend = options?.onSend ?? ctx.onSend ?? (async (_text?: string, _options?: SendOptions) => { console.warn("[adaptContext] onSend 未提供"); });
  const onTrigger = options?.onTrigger ?? ctx.onTrigger ?? (async (_member?: string) => { console.warn("[adaptContext] onTrigger 未提供"); });
  const onSendAs = options?.onSendAs ?? ctx.onSendAs;
  const onSendSystem = options?.onSendSystem ?? ctx.onSendSystem;
  const onImpersonate = options?.onImpersonate ?? ctx.onImpersonate;
  const onContinue = options?.onContinue ?? ctx.onContinue;
  const onSwipe = options?.onSwipe ?? ctx.onSwipe;

  return {
    characterId: ctx.characterId,
    messages: ctx.messages,
    onSend,
    onTrigger,
    onSendAs,
    onSendSystem,
    onImpersonate,
    onContinue,
    onSwipe,
    getVariable: (key) => variables[key],
    setVariable: (key, value) => {
      variables[key] = value;
      ctx.setScriptVariable(key, value, ctx.characterId ? "character" : "global", ctx.characterId);
    },
    deleteVariable: (key) => {
      delete variables[key];
      ctx.deleteScriptVariable(key, ctx.characterId ? "character" : "global", ctx.characterId);
    },
  };
}

// ============================================================================
//                              Slash Handlers
// ============================================================================

export const slashHandlers: ApiHandlerMap = {
  /**
   * triggerSlash - 执行 Slash 命令
   * @param args [command: string, options?: { onSend?, onTrigger? }]
   * @returns ExecutionResult
   */
  triggerSlash: async (args, ctx): Promise<ExecutionResult> => {
    console.log("[slashHandlers.triggerSlash] 收到调用, args:", args);
    const [command, options] = args as [string, CallbackOptions?];

    // 构建执行上下文（options 优先用于测试，否则从 ctx 获取）
    const execCtx = adaptContext(ctx, options);
    console.log("[slashHandlers.triggerSlash] 执行上下文已构建, onSend:", !!(options?.onSend ?? ctx.onSend), "onTrigger:", !!(options?.onTrigger ?? ctx.onTrigger));

    const result = await executeSlashCommandScript(command, execCtx);
    console.log("[slashHandlers.triggerSlash] 执行完成, result:", result);
    return result;
  },

  /**
   * triggerSlashWithResult - triggerSlash 的别名
   * 保持与 SillyTavern API 的兼容性
   */
  triggerSlashWithResult: async (args, ctx): Promise<ExecutionResult> => {
    return slashHandlers.triggerSlash(args, ctx) as Promise<ExecutionResult>;
  },
};
