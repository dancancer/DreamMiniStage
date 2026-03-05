/**
 * @input  hooks/script-bridge/types, hooks/script-bridge/slash-context-adapter, lib/slash-command/executor
 * @output slashHandlers
 * @pos    Slash Command API Handlers - iframe 到 Slash 执行器的桥接
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command API Handlers                         ║
 * ║                                                                            ║
 * ║  桥接 iframe 调用到 Slash Command 执行器                                    ║
 * ║  Requirements: 1.1, 8.1                                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiHandlerMap } from "./types";
import type { ExecutionResult } from "@/lib/slash-command/types";
import { executeSlashCommandScript } from "@/lib/slash-command/executor";
import { adaptSlashExecutionContext } from "./slash-context-adapter";

export const slashHandlers: ApiHandlerMap = {
  /**
   * triggerSlash - 执行 Slash 命令
   * @param args [command: string]
   * @returns ExecutionResult
   */
  triggerSlash: async (args, ctx): Promise<ExecutionResult> => {
    console.log("[slashHandlers.triggerSlash] 收到调用, args:", args);
    const [command] = args as [string];

    const execCtx = adaptSlashExecutionContext(ctx);
    console.log("[slashHandlers.triggerSlash] 执行上下文已构建, onSend:", !!ctx.onSend, "onTrigger:", !!ctx.onTrigger);

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
