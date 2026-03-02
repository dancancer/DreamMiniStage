/**
 * @input  hooks/script-bridge/types, lib/mvu/function-call
 * @output toolHandlers, ScriptTool, getRegisteredScriptTools, invokeScriptTool, handleToolCallResponse
 * @pos    脚本工具注册 Handlers - LLM 自定义工具的注册与调用路由
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Script Tool Registration                          ║
 * ║                                                                           ║
 * ║  允许脚本注册自定义 LLM 工具                                                 ║
 * ║  工具调用时路由回 iframe 执行                                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiHandler, ApiHandlerMap, ApiCallContext } from "./types";
import type { ToolFunction, OpenAITool } from "@/lib/mvu/function-call";

// ============================================================================
//                              脚本工具注册表
// ============================================================================

export interface ScriptTool {
  name: string;
  description: string;
  parameters: ToolFunction["parameters"];
  iframeId: string;
  callback?: string;
}

/** 全局脚本工具注册表：iframeId -> tools */
const scriptToolRegistry = new Map<string, Map<string, ScriptTool>>();

/** 获取所有已注册的脚本工具 */
export function getRegisteredScriptTools(): ScriptTool[] {
  const tools: ScriptTool[] = [];
  for (const toolMap of scriptToolRegistry.values()) {
    tools.push(...toolMap.values());
  }
  return tools;
}

/** 获取 OpenAI 格式的脚本工具列表 */
export function getScriptToolsAsOpenAI(): OpenAITool[] {
  return getRegisteredScriptTools().map(tool => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/** 根据名称查找工具 */
export function findScriptTool(name: string): ScriptTool | undefined {
  for (const toolMap of scriptToolRegistry.values()) {
    const tool = toolMap.get(name);
    if (tool) return tool;
  }
  return undefined;
}

/** 清理 iframe 相关的工具注册 */
export function clearIframeTools(iframeId: string): void {
  scriptToolRegistry.delete(iframeId);
}

// ============================================================================
//                              Handler 实现
// ============================================================================

/**
 * registerFunctionTool(name, description, parameters, callback?)
 * 注册自定义 LLM 工具
 */
const registerFunctionTool: ApiHandler = (args, context) => {
  const [name, description, parameters, callback] = args as [
    string,
    string,
    ToolFunction["parameters"],
    string?,
  ];

  if (!name || typeof name !== "string") {
    console.warn("[Tool] registerFunctionTool: 缺少工具名称");
    return false;
  }

  if (!context.iframeId) {
    console.warn("[Tool] registerFunctionTool: 缺少 iframe 标识");
    return false;
  }

  // 获取或创建该 iframe 的工具集
  let toolMap = scriptToolRegistry.get(context.iframeId);
  if (!toolMap) {
    toolMap = new Map();
    scriptToolRegistry.set(context.iframeId, toolMap);
  }

  const tool: ScriptTool = {
    name,
    description: description || "",
    parameters: parameters || { type: "object", properties: {}, required: [] },
    iframeId: context.iframeId,
    callback,
  };

  toolMap.set(name, tool);
  console.log(`[Tool] 注册工具: ${name} (iframe: ${context.iframeId})`);

  return true;
};

/**
 * unregisterFunctionTool(name)
 * 取消工具注册
 */
const unregisterFunctionTool: ApiHandler = (args, context) => {
  const [name] = args as [string];

  if (!name || !context.iframeId) {
    return false;
  }

  const toolMap = scriptToolRegistry.get(context.iframeId);
  if (toolMap) {
    const deleted = toolMap.delete(name);
    if (deleted) {
      console.log(`[Tool] 取消注册工具: ${name} (iframe: ${context.iframeId})`);
    }
    return deleted;
  }

  return false;
};

/**
 * getRegisteredTools()
 * 获取当前 iframe 注册的所有工具名
 */
const getRegisteredTools: ApiHandler = (args, context) => {
  if (!context.iframeId) {
    return [];
  }

  const toolMap = scriptToolRegistry.get(context.iframeId);
  return toolMap ? Array.from(toolMap.keys()) : [];
};

// ============================================================================
//                              工具调用路由
// ============================================================================

export interface ToolCallRequest {
  toolName: string;
  arguments: Record<string, unknown>;
  callId: string;
}

export interface ToolCallResponse {
  callId: string;
  result?: unknown;
  error?: string;
}

/** 待处理的工具调用 */
const pendingToolCalls = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}>();

/**
 * 调用脚本注册的工具
 * 通过 iframe 消息机制路由到对应脚本
 */
export async function invokeScriptTool(
  toolName: string,
  toolArgs: Record<string, unknown>,
  dispatchToIframe?: (iframeId: string, type: string, payload: unknown) => void
): Promise<unknown> {
  const tool = findScriptTool(toolName);
  if (!tool) {
    throw new Error(`Tool not found: ${toolName}`);
  }

  if (!dispatchToIframe) {
    throw new Error("No iframe dispatcher available");
  }

  const callId = `tool_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    // 设置超时（30秒）
    const timeout = setTimeout(() => {
      pendingToolCalls.delete(callId);
      reject(new Error(`Tool call timeout: ${toolName}`));
    }, 30000);

    pendingToolCalls.set(callId, { resolve, reject, timeout });

    // 发送工具调用请求到 iframe
    dispatchToIframe(tool.iframeId, "tool-call", {
      callId,
      toolName,
      arguments: toolArgs,
      callback: tool.callback,
    } as ToolCallRequest & { callback?: string });
  });
}

/**
 * 处理工具调用响应
 */
export function handleToolCallResponse(response: ToolCallResponse): void {
  const pending = pendingToolCalls.get(response.callId);
  if (!pending) {
    console.warn(`[Tool] 未知的工具调用响应: ${response.callId}`);
    return;
  }

  clearTimeout(pending.timeout);
  pendingToolCalls.delete(response.callId);

  if (response.error) {
    pending.reject(new Error(response.error));
  } else {
    pending.resolve(response.result);
  }
}

// ============================================================================
//                              Handler 导出
// ============================================================================

export const toolHandlers: ApiHandlerMap = {
  registerFunctionTool,
  unregisterFunctionTool,
  getRegisteredTools,
};
