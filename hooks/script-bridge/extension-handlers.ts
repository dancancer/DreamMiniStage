/**
 * @input  hooks/script-bridge/types, function-tool-bridge, slash-command-bridge
 * @output extensionHandlers + 子模块门面导出
 * @pos    扩展 API Handlers - 门面层（函数工具桥接 + slash 回调桥接）
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          Extension Handlers Facade                        ║
 * ║                                                                           ║
 * ║  责任：作为兼容 API 的单入口，复用子模块能力，不再堆积实现细节              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiHandlerMap, ApiCallContext } from "./types";
import {
  getRegisteredFunctionToolNames,
  registerFunctionTool as registerFunctionToolBridge,
  unregisterFunctionTool as unregisterFunctionToolBridge,
} from "./function-tool-bridge";
import {
  registerSlashCommandDefinition,
  type SlashCommandDefinition,
} from "./slash-command-bridge";
import type { FunctionToolDefinition } from "./function-tool-bridge";

export {
  registerIframeDispatcher,
  unregisterIframeDispatcher,
} from "./iframe-dispatcher-registry";

export {
  clearIframeFunctionTools,
  getRegisteredFunctionTools,
  handleFunctionToolResult,
  invokeFunctionTool,
  registerFunctionTool,
  unregisterFunctionTool,
} from "./function-tool-bridge";

export {
  clearIframeSlashCommands,
  handleSlashCommandResult,
} from "./slash-command-bridge";

export type {
  FunctionToolDefinition,
  SlashCommandDefinition,
};

export const extensionHandlers: ApiHandlerMap = {
  "registerFunctionTool": (args: unknown[], ctx: ApiCallContext): boolean => {
    const [name, description, parameters, _required, explicitIframeId] = args as [
      string,
      string,
      FunctionToolDefinition["parameters"],
      boolean?,
      string?
    ];

    const iframeId = explicitIframeId || ctx.iframeId;
    return registerFunctionToolBridge(name, description, parameters, iframeId);
  },

  "unregisterFunctionTool": (args: unknown[], ctx: ApiCallContext): boolean => {
    const [name, explicitIframeId] = args as [string, string?];
    if (typeof name !== "string" || name.length === 0) {
      return false;
    }
    return unregisterFunctionToolBridge(name, explicitIframeId || ctx.iframeId);
  },

  "getRegisteredTools": (_args: unknown[], ctx: ApiCallContext): string[] => {
    return getRegisteredFunctionToolNames(ctx.iframeId);
  },

  "registerSlashCommand": (args: unknown[], ctx: ApiCallContext): boolean => {
    const [definition] = args as [SlashCommandDefinition | undefined];
    return registerSlashCommandDefinition(definition, ctx.iframeId);
  },

  "getApiUrl": (_args: unknown[], _ctx: ApiCallContext): string => {
    const baseUrl = typeof window !== "undefined"
      ? (window as unknown as { __DREAM_API_URL__?: string }).__DREAM_API_URL__
      : undefined;

    return baseUrl || process.env.NEXT_PUBLIC_OPENAI_BASE_URL || "https://api.openai.com/v1";
  },

  "getRequestHeaders": (_args: unknown[], _ctx: ApiCallContext): Record<string, string> => {
    return {
      "Content-Type": "application/json",
    };
  },
};
