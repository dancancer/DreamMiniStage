/**
 * @input  hooks/script-bridge/types, hooks/script-bridge/extension-handlers
 * @output toolHandlers, ScriptTool, getRegisteredScriptTools, invokeScriptTool, handleToolCallResponse
 * @pos    脚本工具桥接适配 - 复用 extension-handlers 的单一路径函数工具注册表
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Script Tool Bridge Adapter                        ║
 * ║                                                                           ║
 * ║  目标：消除 registerFunctionTool 双注册表                                  ║
 * ║  单一路径：extension-handlers 注册 -> invokeFunctionTool 调度             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiHandlerMap } from "./types";
import type { ToolFunction, OpenAITool } from "@/lib/mvu/function-call";
import {
  clearIframeFunctionTools,
  getRegisteredFunctionTools,
  handleFunctionToolResult,
  invokeFunctionTool,
} from "./extension-handlers";

// ============================================================================
//                              类型定义
// ============================================================================

export interface ScriptTool {
  name: string;
  description: string;
  parameters: ToolFunction["parameters"];
  iframeId?: string;
  callback?: string;
}

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

function normalizeToolParameters(
  parameters: ReturnType<typeof getRegisteredFunctionTools>[number]["parameters"],
): ToolFunction["parameters"] {
  return {
    type: "object",
    properties: parameters?.properties ?? {},
    required: parameters?.required,
  };
}

// ============================================================================
//                              工具注册表视图
// ============================================================================

/** 获取所有已注册脚本工具（单源：functionToolRegistry） */
export function getRegisteredScriptTools(): ScriptTool[] {
  return getRegisteredFunctionTools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: normalizeToolParameters(tool.parameters),
  }));
}

/** 获取 OpenAI tools 格式 */
export function getScriptToolsAsOpenAI(): OpenAITool[] {
  return getRegisteredScriptTools().map((tool) => ({
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
  return getRegisteredScriptTools().find((tool) => tool.name === name);
}

/** 清理 iframe 注册的函数工具 */
export function clearIframeTools(iframeId: string): void {
  clearIframeFunctionTools(iframeId);
}

// ============================================================================
//                              工具调用桥接
// ============================================================================

/**
 * 调用脚本工具（单源：extension-handlers.invokeFunctionTool）
 */
export async function invokeScriptTool(
  toolName: string,
  toolArgs: Record<string, unknown>,
): Promise<unknown> {
  return invokeFunctionTool(toolName, toolArgs);
}

/**
 * 兼容历史接口：统一转发到 handleFunctionToolResult
 */
export function handleToolCallResponse(response: ToolCallResponse): void {
  handleFunctionToolResult(response.callId, response.result, response.error);
}

// ============================================================================
//                              Handler 导出
// ============================================================================

/**
 * register/unregister/getRegisteredTools 由 extensionHandlers 提供。
 * 这里保留空 map，避免再次覆盖同名 handler。
 */
export const toolHandlers: ApiHandlerMap = {};
