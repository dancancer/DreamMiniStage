/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 额外模型解析                                   ║
 * ║                                                                            ║
 * ║  使用独立模型调用解析变量更新                                                ║
 * ║  参考: MagVarUpdate/src/main.ts                                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { MvuData, CommandResult } from "./types";
import { updateVariablesFromMessage } from "./core/executor";

// ============================================================================
//                              配置类型
// ============================================================================

/** 额外模型配置 */
export interface ExtraModelConfig {
  /** 模型来源: "same" 使用主模型, "custom" 使用自定义配置 */
  source: "same" | "custom";

  /** 自定义 API 配置 (source="custom" 时使用) */
  customApi?: {
    apiUrl: string;
    apiKey: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };

  /** 是否使用函数调用模式 */
  useFunctionCall?: boolean;

  /** 最大重试次数 */
  maxRetries?: number;

  /** 是否发送预设 */
  sendPreset?: boolean;

  /** 最大聊天历史条数 */
  maxChatHistory?: number;
}

/** 额外模型请求选项 */
export interface ExtraModelRequestOptions {
  /** 当前消息内容 */
  messageContent: string;

  /** 当前变量状态 */
  variables: MvuData;

  /** 聊天历史 (最近几条) */
  chatHistory?: Array<{ role: "user" | "assistant" | "system"; content: string }>;

  /** 角色名 */
  charName?: string;

  /** 用户名 */
  userName?: string;
}

/** 额外模型响应 */
export interface ExtraModelResponse {
  success: boolean;
  updateContent?: string;
  results?: CommandResult[];
  error?: string;
  retries?: number;
}

// ============================================================================
//                              默认配置
// ============================================================================

export const DEFAULT_EXTRA_MODEL_CONFIG: ExtraModelConfig = {
  source: "same",
  useFunctionCall: false,
  maxRetries: 3,
  sendPreset: true,
  maxChatHistory: 2,
};

// ============================================================================
//                              提示词模板
// ============================================================================

/** 变量更新请求提示词 */
export const EXTRA_MODEL_PROMPT = `<must>
你是一个变量状态分析器。根据最新的对话内容，分析角色状态的变化并输出变量更新命令。

## 输出格式
使用 <UpdateVariable> 标签包裹更新命令：
<UpdateVariable>
<Analyze>简要分析状态变化的原因</Analyze>
_.set('path.to.variable', newValue);
_.add('path.to.number', delta);
_.insert('path.to.array', newItem);
_.delete('path.to.key');
</UpdateVariable>

## 命令说明
- _.set(path, value) - 设置变量值
- _.add(path, delta) - 数值增减 (默认 +1)
- _.insert(path, value) - 数组追加或对象合并
- _.insert(path, index, value) - 指定位置插入
- _.delete(path) - 删除变量
- _.delete(path, key) - 从对象/数组中删除指定项

## 注意事项
1. 只输出确实发生变化的变量
2. 路径使用点号分隔，如 'character.mood'
3. 字符串值需要用引号包裹
4. 数值不需要引号
5. 如果没有变化，输出空的 <UpdateVariable></UpdateVariable>
</must>`;

/** 构建完整的请求提示词 */
export function buildExtraModelPrompt(
  options: ExtraModelRequestOptions,
  currentVariables: string,
): string {
  const { messageContent, charName, userName } = options;

  return `${EXTRA_MODEL_PROMPT}

## 当前变量状态
\`\`\`json
${currentVariables}
\`\`\`

## 最新对话内容
${charName || "Assistant"}: ${messageContent}

请分析上述对话内容，输出需要更新的变量命令。`;
}

// ============================================================================
//                              函数调用 Schema
// ============================================================================

/** MVU 变量更新函数 Schema (用于 Tool Calling) */
export const MVU_FUNCTION_SCHEMA = {
  name: "mvu_VariableUpdate",
  description: "更新角色状态变量",
  parameters: {
    type: "object",
    properties: {
      analysis: {
        type: "string",
        description: "状态变化分析",
      },
      delta: {
        type: "string",
        description: "变量更新命令，格式如: _.set('path', value); _.add('path', 1);",
      },
    },
    required: ["analysis", "delta"],
  },
};

// ============================================================================
//                              核心类
// ============================================================================

/** 额外模型解析器 */
export class ExtraModelParser {
  private config: ExtraModelConfig;
  private generateFn?: (prompt: string, options?: GenerateOptions) => Promise<string>;

  constructor(
    config: Partial<ExtraModelConfig> = {},
    generateFn?: (prompt: string, options?: GenerateOptions) => Promise<string>,
  ) {
    this.config = { ...DEFAULT_EXTRA_MODEL_CONFIG, ...config };
    this.generateFn = generateFn;
  }

  /** 设置生成函数 */
  setGenerateFn(fn: (prompt: string, options?: GenerateOptions) => Promise<string>): void {
    this.generateFn = fn;
  }

  /** 更新配置 */
  updateConfig(config: Partial<ExtraModelConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** 获取当前配置 */
  getConfig(): ExtraModelConfig {
    return { ...this.config };
  }

  /**
   * 解析消息并更新变量
   */
  async parseAndUpdate(options: ExtraModelRequestOptions): Promise<ExtraModelResponse> {
    if (!this.generateFn) {
      return { success: false, error: "生成函数未设置" };
    }

    const { variables } = options;
    const currentVariables = JSON.stringify(variables.stat_data, null, 2);
    const prompt = buildExtraModelPrompt(options, currentVariables);

    let lastError: string | undefined;
    const maxRetries = this.config.maxRetries || 3;

    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        const generateOptions = this.buildGenerateOptions();
        const response = await this.generateFn(prompt, generateOptions);

        const updateContent = this.extractUpdateContent(response);
        if (updateContent) {
          const { results, variables: updatedVariables } = updateVariablesFromMessage(
            updateContent,
            variables,
          );

          const hasSuccessfulUpdate = results.some((r) => r.success);
          if (hasSuccessfulUpdate) {
            return {
              success: true,
              updateContent,
              results,
              retries: retry,
            };
          }
        }

        lastError = "未能提取有效的更新命令";
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    return {
      success: false,
      error: lastError || "解析失败",
      retries: maxRetries,
    };
  }

  /**
   * 从响应中提取更新内容
   */
  private extractUpdateContent(response: string): string | null {
    // 查找最后一个 <UpdateVariable> 块
    const lastIndex = response.lastIndexOf("<UpdateVariable>");
    if (lastIndex === -1) return null;

    const content = response.slice(lastIndex + 16);
    const endIndex = content.indexOf("</UpdateVariable>");

    if (endIndex === -1) {
      // 没有闭合标签，取全部内容
      return content.replace(/<\/UpdateVariable>/g, "").trim();
    }

    return content.slice(0, endIndex).trim();
  }

  /**
   * 构建生成选项
   */
  private buildGenerateOptions(): GenerateOptions {
    const options: GenerateOptions = {};

    if (this.config.source === "custom" && this.config.customApi) {
      options.customApi = this.config.customApi;
    }

    if (this.config.useFunctionCall) {
      options.tools = [MVU_FUNCTION_SCHEMA];
    }

    return options;
  }

  /**
   * 解析函数调用响应
   */
  parseFunctionCallResponse(toolCalls: ToolCallResult[]): string | null {
    const mvuCall = toolCalls.find((call) => call.function?.name === "mvu_VariableUpdate");
    if (!mvuCall?.function?.arguments) return null;

    try {
      const args = JSON.parse(mvuCall.function.arguments);
      if (args.delta && args.delta.length > 5) {
        return `<UpdateVariable><Analyze>${args.analysis || ""}</Analyze>${args.delta}</UpdateVariable>`;
      }
    } catch {
      return null;
    }

    return null;
  }
}

// ============================================================================
//                              类型定义
// ============================================================================

/** 生成选项 */
export interface GenerateOptions {
  customApi?: ExtraModelConfig["customApi"];
  tools?: Array<typeof MVU_FUNCTION_SCHEMA>;
  maxTokens?: number;
  temperature?: number;
}

/** 工具调用结果 */
export interface ToolCallResult {
  id?: string;
  type?: string;
  function?: {
    name: string;
    arguments: string;
  };
}

// ============================================================================
//                              便捷函数
// ============================================================================

/** 创建额外模型解析器实例 */
export function createExtraModelParser(
  config?: Partial<ExtraModelConfig>,
  generateFn?: (prompt: string, options?: GenerateOptions) => Promise<string>,
): ExtraModelParser {
  return new ExtraModelParser(config, generateFn);
}

/** 检查消息是否包含变量更新标记 */
export function hasVariableUpdateMarker(content: string): boolean {
  return /\[mvu_update\]/i.test(content);
}

/** 检查消息是否包含剧情标记 (不需要额外解析) */
export function hasPlotMarker(content: string): boolean {
  return /\[mvu_plot\]/i.test(content);
}

/** 判断是否应该使用额外模型解析 */
export function shouldUseExtraModel(
  messageContent: string,
  config: ExtraModelConfig,
): boolean {
  // 如果消息包含 [mvu_update] 标记，使用额外模型
  if (hasVariableUpdateMarker(messageContent)) {
    return true;
  }

  // 如果消息包含 [mvu_plot] 标记，不使用额外模型
  if (hasPlotMarker(messageContent)) {
    return false;
  }

  // 默认不使用额外模型 (随 AI 输出)
  return false;
}
