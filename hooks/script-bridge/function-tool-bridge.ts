/**
 * @input  hooks/script-bridge/iframe-dispatcher-registry
 * @output registerFunctionTool, invokeFunctionTool, handleFunctionToolResult
 * @pos    函数工具桥接层
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Function Tool Bridge                              ║
 * ║                                                                           ║
 * ║  单一路径：注册 -> 调用 -> 回调结果回传 -> 生命周期清理                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { dispatchToIframe } from "./iframe-dispatcher-registry";

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

interface RegisteredTool {
  definition: FunctionToolDefinition;
  handler: (args: Record<string, unknown>) => unknown | Promise<unknown>;
  sourceIframe?: string;
}

interface PendingToolCall {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const CALLBACK_TIMEOUT_MS = 30000;
const functionToolRegistry = new Map<string, RegisteredTool>();
const pendingToolCalls = new Map<string, PendingToolCall>();

function generateCallbackId(): string {
  return `ftc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function registerFunctionTool(
  name: string,
  description: string,
  parameters: FunctionToolDefinition["parameters"],
  iframeId?: string,
): boolean {
  if (!name || typeof name !== "string") {
    console.warn("[registerFunctionTool] Invalid name:", name);
    return false;
  }

  const definition: FunctionToolDefinition = {
    name,
    description: description || "",
    parameters: parameters || { type: "object", properties: {} },
  };

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
}

export function unregisterFunctionTool(name: string, iframeId?: string): boolean {
  const tool = functionToolRegistry.get(name);
  if (!tool) {
    return false;
  }

  if (iframeId && tool.sourceIframe && tool.sourceIframe !== iframeId) {
    return false;
  }

  return functionToolRegistry.delete(name);
}

export function getRegisteredFunctionTools(): FunctionToolDefinition[] {
  return Array.from(functionToolRegistry.values()).map(t => t.definition);
}

export function getRegisteredFunctionToolNames(targetIframeId?: string): string[] {
  const names: string[] = [];
  for (const [name, tool] of functionToolRegistry.entries()) {
    if (!targetIframeId || !tool.sourceIframe || tool.sourceIframe === targetIframeId) {
      names.push(name);
    }
  }
  return names;
}

export async function invokeFunctionTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = functionToolRegistry.get(name);
  if (!tool) {
    throw new Error(`Function tool not found: ${name}`);
  }

  if (tool.sourceIframe) {
    const callbackId = generateCallbackId();
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pendingToolCalls.delete(callbackId);
        reject(new Error(`Function tool timeout: ${name}`));
      }, CALLBACK_TIMEOUT_MS);

      pendingToolCalls.set(callbackId, { resolve, reject, timeout: timeoutId });

      dispatchToIframe(tool.sourceIframe as string, "FUNCTION_TOOL_CALL", {
        name,
        args,
        callbackId,
      });
    });
  }

  return tool.handler(args);
}

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
    return;
  }

  pending.resolve(result);
}

export function clearIframeFunctionTools(iframeId: string): void {
  for (const [name, tool] of functionToolRegistry.entries()) {
    if (tool.sourceIframe === iframeId) {
      functionToolRegistry.delete(name);
    }
  }
}
