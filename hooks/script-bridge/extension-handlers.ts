/**
 * @input  hooks/script-bridge/types, lib/slash-command/registry
 * @output extensionHandlers, registerIframeDispatcher, getRegisteredFunctionTools, invokeFunctionTool
 * @pos    扩展 API Handlers - 函数工具注册与自定义斜杠命令管理
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         扩展 API Handlers                                  ║
 * ║                                                                            ║
 * ║  实现 SillyTavern 兼容的扩展 API：                                          ║
 * ║  • registerFunctionTool - 注册函数工具供 LLM 调用                          ║
 * ║  • registerSlashCommand - 注册自定义斜杠命令                               ║
 * ║  • getApiUrl - 获取 LLM API 地址                                          ║
 * ║  • getRequestHeaders - 获取 LLM 请求头                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiHandlerMap, ApiCallContext } from "./types";
import { registerCommand } from "@/lib/slash-command/registry/index";
import type { CommandHandler, ExecutionContext } from "@/lib/slash-command/types";

// ============================================================================
//                              iframe 派发函数注册表
// ============================================================================

type IframeDispatcher = (type: string, payload: unknown) => void;
const iframeDispatchers = new Map<string, IframeDispatcher>();

/**
 * 注册 iframe 派发函数
 * 由 ScriptSandbox 组件挂载时调用
 */
export function registerIframeDispatcher(iframeId: string, dispatcher: IframeDispatcher): void {
  iframeDispatchers.set(iframeId, dispatcher);
}

/**
 * 注销 iframe 派发函数
 * 由 ScriptSandbox 组件卸载时调用
 */
export function unregisterIframeDispatcher(iframeId: string): void {
  iframeDispatchers.delete(iframeId);
}

/**
 * 向指定 iframe 派发消息
 */
function dispatchToIframe(iframeId: string, type: string, payload: unknown): void {
  const dispatcher = iframeDispatchers.get(iframeId);
  if (dispatcher) {
    dispatcher(type, payload);
  } else {
    console.warn("[dispatchToIframe] No dispatcher for iframe:", iframeId);
  }
}

// ============================================================================
//                              函数工具注册表
// ============================================================================

/**
 * 函数工具定义
 * 遵循 OpenAI function calling 规范
 */
export interface FunctionToolDefinition {
  name: string;
  description: string;
  parameters?: {
    type: "object";
    properties?: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

/**
 * 已注册的函数工具
 * Key: tool name, Value: { definition, handler, sourceIframe }
 */
interface RegisteredTool {
  definition: FunctionToolDefinition;
  handler: (args: Record<string, unknown>) => unknown | Promise<unknown>;
  sourceIframe?: string;
}

const functionToolRegistry = new Map<string, RegisteredTool>();

// ============================================================================
//                              函数工具调用等待机制
// ============================================================================

/**
 * 等待 iframe 返回函数工具调用结果
 * Key: callbackId, Value: { resolve, reject, timeout }
 */
interface PendingToolCall {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const pendingToolCalls = new Map<string, PendingToolCall>();

/**
 * 生成唯一的回调 ID
 */
function generateCallbackId(): string {
  return `ftc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 处理 iframe 返回的函数工具结果
 * 供消息监听器调用
 */
export function handleFunctionToolResult(callbackId: string, result: unknown, error?: string): void {
  const pending = pendingToolCalls.get(callbackId);
  if (!pending) {
    console.warn("[handleFunctionToolResult] Unknown callbackId:", callbackId);
    return;
  }

  clearTimeout(pending.timeout);
  pendingToolCalls.delete(callbackId);

  if (error) {
    pending.reject(new Error(error));
  } else {
    pending.resolve(result);
  }
}

/**
 * 获取所有已注册的函数工具定义
 * 供 LLM 请求构建时使用
 */
export function getRegisteredFunctionTools(): FunctionToolDefinition[] {
  return Array.from(functionToolRegistry.values()).map(t => t.definition);
}

/**
 * 调用已注册的函数工具
 * 供 LLM 响应解析时使用
 *
 * @param name 工具名称
 * @param args 工具参数
 */
export async function invokeFunctionTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const tool = functionToolRegistry.get(name);
  if (!tool) {
    throw new Error(`Function tool not found: ${name}`);
  }

  // 如果工具来自 iframe，通过消息机制调用
  if (tool.sourceIframe) {
    const callbackId = generateCallbackId();
    const timeout = 30000;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pendingToolCalls.delete(callbackId);
        reject(new Error(`Function tool timeout: ${name}`));
      }, timeout);

      pendingToolCalls.set(callbackId, { resolve, reject, timeout: timeoutId });

      dispatchToIframe(tool.sourceIframe!, "FUNCTION_TOOL_CALL", {
        name,
        args,
        callbackId,
      });
    });
  }

  return tool.handler(args);
}

/**
 * 清理指定 iframe 注册的所有工具
 */
export function clearIframeFunctionTools(iframeId: string): void {
  for (const [name, tool] of functionToolRegistry.entries()) {
    if (tool.sourceIframe === iframeId) {
      functionToolRegistry.delete(name);
    }
  }
}

// ============================================================================
//                              自定义斜杠命令注册
// ============================================================================

/**
 * 斜杠命令定义
 */
interface SlashCommandDefinition {
  name: string;
  callback: (...args: unknown[]) => unknown | Promise<unknown>;
  aliases?: string[];
  namedArgumentList?: Array<{
    name: string;
    description?: string;
    isRequired?: boolean;
  }>;
  unnamedArgumentList?: Array<{
    description?: string;
    isRequired?: boolean;
  }>;
  helpString?: string;
}

/**
 * 已注册的自定义斜杠命令（用于追踪清理）
 */
const customSlashCommands = new Map<string, { iframeId: string }>();

/**
 * 清理指定 iframe 注册的所有斜杠命令
 */
export function clearIframeSlashCommands(iframeId: string): void {
  for (const [name, info] of customSlashCommands.entries()) {
    if (info.iframeId === iframeId) {
      customSlashCommands.delete(name);
      // 注意：当前 registry 不支持 unregister，命令会保留但标记为已清理
    }
  }
}

// ============================================================================
//                              Handler 实现
// ============================================================================

export const extensionHandlers: ApiHandlerMap = {
  /**
   * registerFunctionTool - 注册函数工具供 LLM 调用
   * Requirements: SillyTavern.registerFunctionTool 兼容
   *
   * @param args [name, description, parameters, required, iframeId]
   */
  "registerFunctionTool": (args: unknown[], ctx: ApiCallContext): boolean => {
    const [name, description, parameters, _required, explicitIframeId] = args as [
      string,
      string,
      FunctionToolDefinition["parameters"],
      boolean?,
      string?
    ];

    if (!name || typeof name !== "string") {
      console.warn("[registerFunctionTool] Invalid name:", name);
      return false;
    }

    // 获取 iframeId：优先使用显式传入的，否则从 context 获取
    const iframeId = explicitIframeId || ctx.iframeId;

    // 构建工具定义
    const definition: FunctionToolDefinition = {
      name,
      description: description || "",
      parameters: parameters || { type: "object", properties: {} },
    };

    // 注册工具
    // handler 为占位实现，实际调用通过 invokeFunctionTool 走 iframe 消息机制
    functionToolRegistry.set(name, {
      definition,
      handler: async (toolArgs) => {
        console.log(`[registerFunctionTool] Tool called: ${name}`, toolArgs);
        return { success: true, args: toolArgs };
      },
      sourceIframe: iframeId,
    });

    console.log("[registerFunctionTool] Registered:", name, "iframeId:", iframeId);
    return true;
  },

  /**
   * registerSlashCommand - 注册自定义斜杠命令
   * Requirements: SillyTavern.registerSlashCommand 兼容
   *
   * @param args [definition: SlashCommandDefinition]
   */
  "registerSlashCommand": (args: unknown[], ctx: ApiCallContext): boolean => {
    const [definition] = args as [SlashCommandDefinition];

    if (!definition || !definition.name) {
      console.warn("[registerSlashCommand] Invalid definition:", definition);
      return false;
    }

    const { name, callback, aliases } = definition;

    // 创建命令处理器
    const handler: CommandHandler = async (
      cmdArgs: string[],
      namedArgs: Record<string, string>,
      execCtx: ExecutionContext,
      pipe: string
    ): Promise<string> => {
      try {
        // 调用注册的回调
        const result = await callback(cmdArgs.join(" "), namedArgs, execCtx);
        return result !== undefined ? String(result) : pipe;
      } catch (err) {
        console.error(`[registerSlashCommand] Error in /${name}:`, err);
        return pipe;
      }
    };

    // 注册主命令
    registerCommand(name, handler);
    customSlashCommands.set(name, {
      iframeId: (ctx as ApiCallContext & { iframeId?: string }).iframeId || "unknown",
    });

    // 注册别名
    if (aliases && Array.isArray(aliases)) {
      for (const alias of aliases) {
        registerCommand(alias, handler);
        customSlashCommands.set(alias, {
          iframeId: (ctx as ApiCallContext & { iframeId?: string }).iframeId || "unknown",
        });
      }
    }

    console.log("[registerSlashCommand] Registered:", name, aliases ? `(aliases: ${aliases.join(", ")})` : "");
    return true;
  },

  /**
   * getApiUrl - 获取当前 LLM API 地址
   * Requirements: SillyTavern.getApiUrl 兼容
   */
  "getApiUrl": (_args: unknown[], _ctx: ApiCallContext): string => {
    // 从环境变量或配置获取 API URL
    // 优先级：NEXT_PUBLIC_OPENAI_BASE_URL > 默认值
    const baseUrl = typeof window !== "undefined"
      ? (window as unknown as { __DREAM_API_URL__?: string }).__DREAM_API_URL__
      : undefined;

    return baseUrl || process.env.NEXT_PUBLIC_OPENAI_BASE_URL || "https://api.openai.com/v1";
  },

  /**
   * getRequestHeaders - 获取 LLM 请求头
   * Requirements: SillyTavern.getRequestHeaders 兼容
   *
   * 注意：出于安全考虑，不直接暴露 API Key
   * 返回的是通用请求头，实际认证在服务端完成
   */
  "getRequestHeaders": (_args: unknown[], _ctx: ApiCallContext): Record<string, string> => {
    return {
      "Content-Type": "application/json",
      // 不暴露实际的 API Key，脚本应通过服务端代理发送请求
    };
  },
};
