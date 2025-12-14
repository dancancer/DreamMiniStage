/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 函数调用模式                                   ║
 * ║                                                                            ║
 * ║  支持 OpenAI Tool Calling 格式的变量更新                                    ║
 * ║  参考: MagVarUpdate/src/function_call.ts                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { MvuData, CommandResult } from "./types";
import { updateVariablesFromMessage } from "./core/executor";

// ============================================================================
//                              常量定义
// ============================================================================

export const MVU_FUNCTION_NAME = "mvu_VariableUpdate";

// ============================================================================
//                              函数 Schema 定义
// ============================================================================

/** OpenAI Tool 格式的函数定义 */
export interface ToolFunction {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, PropertySchema>;
    required?: string[];
  };
}

interface PropertySchema {
  type: string;
  description?: string;
  enum?: string[];
  items?: PropertySchema;
}

/** MVU 变量更新函数定义 */
export const MVU_VARIABLE_UPDATE_FUNCTION: ToolFunction = {
  name: MVU_FUNCTION_NAME,
  description: "更新角色状态变量。根据对话内容分析状态变化，执行变量更新命令。",
  parameters: {
    type: "object",
    properties: {
      analysis: {
        type: "string",
        description: "状态变化分析：简要说明为什么需要更新这些变量",
      },
      delta: {
        type: "string",
        description: `变量更新命令，支持以下格式：
- _.set('path.to.var', value) - 设置变量值
- _.add('path.to.num', delta) - 数值增减
- _.insert('path.to.arr', item) - 数组追加
- _.delete('path.to.key') - 删除变量
多条命令用分号分隔，如: _.set('mood', 'happy'); _.add('trust', 5);`,
      },
    },
    required: ["analysis", "delta"],
  },
};

/** OpenAI Tool 格式 */
export interface OpenAITool {
  type: "function";
  function: ToolFunction;
}

/** 获取 MVU 工具定义 (OpenAI 格式) */
export function getMvuTool(): OpenAITool {
  return {
    type: "function",
    function: MVU_VARIABLE_UPDATE_FUNCTION,
  };
}

// ============================================================================
//                              Tool Call 解析
// ============================================================================

/** Tool Call 结构 */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/** Tool Call 批次 */
export type ToolCallBatch = ToolCall[];
export type ToolCallBatches = ToolCallBatch[];

/** 解析后的 MVU 函数调用参数 */
export interface MvuFunctionCallArgs {
  analysis: string;
  delta: string;
}

/**
 * 从 Tool Calls 中提取 MVU 函数调用
 */
export function extractMvuToolCall(toolCalls: ToolCallBatches): MvuFunctionCallArgs | null {
  for (const batch of toolCalls) {
    const mvuCall = batch.find((call) => call.function?.name === MVU_FUNCTION_NAME);
    if (mvuCall?.function?.arguments) {
      try {
        const args = JSON.parse(mvuCall.function.arguments) as MvuFunctionCallArgs;
        if (args.delta && args.delta.length > 5) {
          return args;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * 将 MVU 函数调用参数转换为更新内容
 */
export function functionCallToUpdateContent(args: MvuFunctionCallArgs): string {
  return `<UpdateVariable><Analyze>${args.analysis}</Analyze>${args.delta}</UpdateVariable>`;
}

// ============================================================================
//                              函数调用执行器
// ============================================================================

/** 函数调用执行结果 */
export interface FunctionCallResult {
  success: boolean;
  results?: CommandResult[];
  updatedVariables?: MvuData;
  error?: string;
}

/**
 * 执行 MVU 函数调用
 */
export function executeMvuFunctionCall(
  args: MvuFunctionCallArgs,
  variables: MvuData,
): FunctionCallResult {
  if (!args.delta || args.delta.length < 5) {
    return { success: false, error: "delta 内容为空或过短" };
  }

  const updateContent = functionCallToUpdateContent(args);
  const { modified, results, variables: updatedVariables } = updateVariablesFromMessage(
    updateContent,
    variables,
  );

  if (!modified) {
    return { success: false, error: "没有变量被更新", results };
  }

  return {
    success: true,
    results,
    updatedVariables,
  };
}

// ============================================================================
//                              函数调用管理器
// ============================================================================

/** 函数调用管理器配置 */
export interface FunctionCallManagerConfig {
  enabled: boolean;
  autoExecute: boolean;
}

/** 函数调用管理器 */
export class FunctionCallManager {
  private enabled = false;
  private autoExecute = true;
  private pendingCalls: MvuFunctionCallArgs[] = [];

  /** 启用函数调用 */
  enable(): void {
    this.enabled = true;
  }

  /** 禁用函数调用 */
  disable(): void {
    this.enabled = false;
    this.pendingCalls = [];
  }

  /** 检查是否启用 */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** 设置自动执行 */
  setAutoExecute(value: boolean): void {
    this.autoExecute = value;
  }

  /** 添加待处理的函数调用 */
  addPendingCall(args: MvuFunctionCallArgs): void {
    this.pendingCalls.push(args);
  }

  /** 获取并清空待处理的函数调用 */
  consumePendingCalls(): MvuFunctionCallArgs[] {
    const calls = [...this.pendingCalls];
    this.pendingCalls = [];
    return calls;
  }

  /** 处理 Tool Calls 响应 */
  processToolCalls(
    toolCalls: ToolCallBatches,
    variables: MvuData,
  ): FunctionCallResult {
    if (!this.enabled) {
      return { success: false, error: "函数调用未启用" };
    }

    const args = extractMvuToolCall(toolCalls);
    if (!args) {
      return { success: false, error: "未找到 MVU 函数调用" };
    }

    if (this.autoExecute) {
      return executeMvuFunctionCall(args, variables);
    }

    this.addPendingCall(args);
    return { success: true };
  }
}

// ============================================================================
//                              便捷函数
// ============================================================================

/** 创建函数调用管理器 */
export function createFunctionCallManager(): FunctionCallManager {
  return new FunctionCallManager();
}

/** 检查 API 是否支持函数调用 */
export function isFunctionCallingSupported(apiType: string): boolean {
  const supportedApis = ["openai", "azure", "anthropic", "gemini"];
  return supportedApis.includes(apiType.toLowerCase());
}

/** 构建带函数调用的请求参数 */
export function buildFunctionCallRequest(
  messages: Array<{ role: string; content: string }>,
  includeTools = true,
): {
  messages: Array<{ role: string; content: string }>;
  tools?: OpenAITool[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
} {
  const request: ReturnType<typeof buildFunctionCallRequest> = { messages };

  if (includeTools) {
    request.tools = [getMvuTool()];
    request.tool_choice = "auto";
  }

  return request;
}
