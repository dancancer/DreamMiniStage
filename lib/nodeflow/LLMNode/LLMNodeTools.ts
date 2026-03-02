import { NodeTool } from "@/lib/nodeflow/NodeTool";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { createGeminiRunnable } from "@/lib/core/gemini-client";
import { postProcessMessages, getTextContent } from "@/lib/core/prompt/post-processor";
import { invokeClaudeModel, invokeGeminiModel, invokeClaudeModelStream, type StreamingCallbacks } from "./model-invokers";
import { extractTokenUsage, type TokenUsage } from "@/lib/adapters/token-usage";
import type { PromptNames, ExtendedChatMessage, PostProcessingMode } from "@/lib/core/st-preset-types";
import {
  getMvuTool,
  extractMvuToolCall,
  functionCallToUpdateContent,
  type ToolCallBatches,
  type OpenAITool,
} from "@/lib/mvu/function-call";

// 为window对象添加lastTokenUsage属性的类型声明
declare global {
  interface Window {
    lastTokenUsage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   LLM 配置接口
   
   Requirements: 7.1, 8.1 - 支持模型特定转换
   ═══════════════════════════════════════════════════════════════════════════ */

export interface LLMConfig {
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  llmType: "openai" | "ollama" | "gemini" | "claude";
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  topK?: number;
  repeatPenalty?: number;
  streaming?: boolean;
  streamUsage?: boolean;
  language?: "zh" | "en";
  dialogueKey?: string;
  characterId?: string;
  messages?: Array<{ role: string; content: string }>;

  /* ─────────────────────────────────────────────────────────────────────────
     后处理选项 (Requirements: 7.1, 8.1)
     ───────────────────────────────────────────────────────────────────────── */

  /** 角色名称集合，用于名称前缀规范化 */
  promptNames?: PromptNames;

  /** 后处理模式 */
  postProcessingMode?: PostProcessingMode;

  /** 是否保留工具调用字段 */
  tools?: boolean;

  /** Assistant prefill 内容 */
  prefill?: string;

  /** 占位符文本 */
  placeholder?: string;

  /* ─────────────────────────────────────────────────────────────────────────
     MVU Function Calling 选项
     ───────────────────────────────────────────────────────────────────────── */

  /** 启用 MVU 函数调用模式 */
  mvuToolEnabled?: boolean;

  /** 脚本注册的自定义工具 */
  scriptTools?: OpenAITool[];
}

const DEFAULT_LLM_SETTINGS = {
  temperature: 0.7,
  maxTokens: undefined,
  timeout: 1000000000,
  maxRetries: 0,
  topP: 0.7,
  frequencyPenalty: 0,
  presencePenalty: 0,
  topK: 40,
  repeatPenalty: 1.1,
  streaming: false,
  streamUsage: true,
};

/* ═══════════════════════════════════════════════════════════════════════════
   消息处理工具
   ═══════════════════════════════════════════════════════════════════════════ */

type ChatMessage = { role: string; content: string };

/**
 * 将 ExtendedChatMessage 转换为简单 ChatMessage 格式
 * 
 * 用于 LangChain 调用，需要将多模态内容转为纯文本
 */
function toSimpleMessages(messages: ExtendedChatMessage[]): ChatMessage[] {
  return messages.map(msg => ({
    role: msg.role,
    content: typeof msg.content === "string" ? msg.content : getTextContent(msg.content),
  }));
}
export class LLMNodeTools extends NodeTool {
  protected static readonly toolType: string = "llm";
  protected static readonly version: string = "1.0.0";

  static getToolType(): string {
    return this.toolType;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     动态方法执行器

     参数和返回值使用 unknown：
     - params: 不同方法接受不同参数，由具体方法负责类型转换
     - 返回值: 不同方法返回不同类型，调用方负责类型断言

     this 断言：
     - 类的静态成员在运行时是一个对象
     - 使用 Record<string, unknown> 安全访问动态属性

     设计理念：边界用 unknown，内部逻辑负责验证和转换
     ═══════════════════════════════════════════════════════════════════════════ */
  static async executeMethod(methodName: string, ...params: unknown[]): Promise<unknown> {
    const classObj = this as unknown as Record<string, unknown>;
    const method = classObj[methodName];

    if (typeof method !== "function") {
      console.error(`Method lookup failed: ${methodName} not found in LLMNodeTools`);
      console.log("Available methods:", Object.getOwnPropertyNames(this).filter(name =>
        typeof classObj[name] === "function" && !name.startsWith("_"),
      ));
      throw new Error(`Method ${methodName} not found in ${this.getToolType()}Tool`);
    }

    try {
      this.logExecution(methodName, params);
      const result = await (method as (...args: unknown[]) => Promise<unknown>).apply(this, params);
      return result;
    } catch (error) {
      console.error(`Method execution failed: ${methodName}`, error);
      throw error;
    }
  }

  static async invokeLLM(config: LLMConfig): Promise<string> {
    try {
      console.log("invokeLLM");
      
      /* ═══════════════════════════════════════════════════════════════════════
         messages-only 架构：messages[] 是唯一事实源
         
         Requirements 1.1: 仅使用 messages[] 作为最终提示词内容
         ═══════════════════════════════════════════════════════════════════════ */
      
      if (!config.messages || config.messages.length === 0) {
        throw new Error("messages[] is required for invokeLLM");
      }

      const rawMessages = [...config.messages];

      /* ═══════════════════════════════════════════════════════════════════════
         后处理管线 (Requirements: 7.1, 8.1)
         
         根据 promptNames 和 postProcessingMode 应用后处理：
         - 名称规范化（将 name 字段转为 content 前缀）
         - 角色合并（合并连续同角色消息）
         - 严格模式处理（确保 user 起始）
         ═══════════════════════════════════════════════════════════════════════ */
      const finalMessages: ChatMessage[] = (() => {
        // 新后处理管线：仅在明确提供模式时启用
        if (config.promptNames && config.postProcessingMode) {
          const extMessages = rawMessages as ExtendedChatMessage[];
          const processed = postProcessMessages(extMessages, {
            mode: config.postProcessingMode,
            names: config.promptNames,
            tools: config.tools,
            prefill: config.prefill,
            placeholder: config.placeholder,
          });
          return toSimpleMessages(processed);
        }

        // 默认行为：保持原始顺序与分条结构，避免合并同角色消息
        // 这样能与 SillyTavern 的多条 system/user 提示对齐
        return rawMessages;
      })();
      
      // ═══════════════════════════════════════════════════════════════════════
      // 广播实际发送的提示词数据，供提示词查看器捕获
      // ═══════════════════════════════════════════════════════════════════════
      if (typeof window !== "undefined" && config.dialogueKey) {
        console.log("[LLMNodeTools:invokeLLM] 广播 llm-prompt-captured 事件:", {
          dialogueKey: config.dialogueKey,
          characterId: config.characterId,
          messagesCount: finalMessages.length,
        });
        const promptEvent = new CustomEvent("llm-prompt-captured", {
          detail: {
            dialogueKey: config.dialogueKey,
            characterId: config.characterId,
            modelName: config.modelName,
            timestamp: Date.now(),
            messages: finalMessages,
          },
        });
        window.dispatchEvent(promptEvent);
      } else {
        console.log("[LLMNodeTools:invokeLLM] 未广播事件:", {
          hasWindow: typeof window !== "undefined",
          dialogueKey: config.dialogueKey,
        });
      }

      /* ═══════════════════════════════════════════════════════════════════════
         模型特定转换 (Requirements: 7.1, 8.1)
         
         根据 llmType 选择对应的转换器：
         - claude: 使用 convertForClaude，提取 system 到独立参数
         - gemini: 使用 convertForGoogle，转换为 parts 格式
         - openai/ollama: 直接使用处理后的消息
         ═══════════════════════════════════════════════════════════════════════ */
      
      if (config.llmType === "claude") {
        // Claude 模型：使用专用转换器 (Requirements: 7.1)
        return await invokeClaudeModel(finalMessages, config);
      }
      
      if (config.llmType === "gemini") {
        // Gemini 模型：使用专用转换器 (Requirements: 8.1)
        return await invokeGeminiModel(finalMessages, config);
      }
      
      // OpenAI 兼容模型（openai/ollama）：直接使用处理后的消息
      if (config.llmType === "openai") {
        const openaiLlm = this.createLLM(config) as ChatOpenAI;

        // MVU/脚本工具函数调用模式
        if (config.mvuToolEnabled || (config.scriptTools && config.scriptTools.length > 0)) {
          // 合并 MVU 工具和脚本工具
          const allTools: OpenAITool[] = [];
          if (config.mvuToolEnabled) {
            allTools.push(getMvuTool());
          }
          if (config.scriptTools) {
            allTools.push(...config.scriptTools);
          }

          const boundModel = openaiLlm.bindTools(allTools, { tool_choice: "auto" });
          const aiMessage = await boundModel.invoke(finalMessages);

          // 提取 token usage
          const usageData = extractTokenUsage(aiMessage);
          if (usageData && typeof window !== "undefined") {
            window.lastTokenUsage = {
              prompt_tokens: usageData.promptTokens,
              completion_tokens: usageData.completionTokens,
              total_tokens: usageData.totalTokens,
            };
          }

          // 处理工具调用
          let textContent = aiMessage.content as string;
          if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
            const toolCalls: ToolCallBatches = [aiMessage.tool_calls.map(tc => ({
              id: tc.id || "",
              type: "function" as const,
              function: {
                name: tc.name,
                arguments: typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args),
              },
            }))];

            // 处理 MVU 工具调用
            const mvuArgs = extractMvuToolCall(toolCalls);
            if (mvuArgs) {
              const updateContent = functionCallToUpdateContent(mvuArgs);
              textContent = textContent ? `${textContent}\n\n${updateContent}` : updateContent;
              console.log("[LLMNodeTools] MVU 函数调用转换完成:", mvuArgs.analysis);
            }

            // 脚本工具调用将在响应后由调用方处理（返回原始 tool_calls）
          }

          return textContent;
        }

        // 标准调用（无工具）
        const aiMessage = await openaiLlm.invoke(finalMessages);

        /* ─────────────────────────────────────────────────────────────────────
           使用适配器链提取 token usage
           ───────────────────────────────────────────────────────────────────── */
        const usageData = extractTokenUsage(aiMessage);
        const tokenUsage = usageData ? {
          prompt_tokens: usageData.promptTokens,
          completion_tokens: usageData.completionTokens,
          total_tokens: usageData.totalTokens,
        } : null;

        if (!tokenUsage && config.streaming && config.streamUsage) {
          console.log("📊 Token usage not found in response, this may be due to streaming mode");
        }

        if (tokenUsage && typeof window !== "undefined") {
          window.lastTokenUsage = tokenUsage;
          console.log("📊 Token usage stored for plugins:", tokenUsage);
          const event = new CustomEvent("llm-token-usage", { detail: { tokenUsage } });
          window.dispatchEvent(event);
        }

        return aiMessage.content as string;
      }

      // Ollama：直接使用 messages[] 调用
      const llm = this.createLLM(config);
      const aiMessage = await (llm as ChatOllama).invoke(finalMessages);
      const response = typeof aiMessage.content === "string"
        ? aiMessage.content
        : JSON.stringify(aiMessage.content);
      
      if (!response || typeof response !== "string") {
        throw new Error("Invalid response from LLM");
      }

      return response;
    } catch (error) {
      this.handleError(error as Error, "invokeLLM");
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     流式 LLM 调用

     与 invokeLLM 相同的前置处理，但使用流式回调返回内容
     ═══════════════════════════════════════════════════════════════════════════ */
  static async invokeLLMStream(
    config: LLMConfig,
    callbacks: StreamingCallbacks,
  ): Promise<string> {
    try {
      if (!config.messages || config.messages.length === 0) {
        throw new Error("messages[] is required for invokeLLMStream");
      }

      const rawMessages = [...config.messages];
      let finalMessages: ChatMessage[];

      if (config.promptNames && config.postProcessingMode) {
        const extMessages = rawMessages as ExtendedChatMessage[];
        const processed = postProcessMessages(extMessages, {
          mode: config.postProcessingMode,
          names: config.promptNames,
          tools: config.tools,
          prefill: config.prefill,
          placeholder: config.placeholder,
        });
        finalMessages = toSimpleMessages(processed);
      } else {
        finalMessages = rawMessages;
      }

      // 广播提示词事件
      if (typeof window !== "undefined" && config.dialogueKey) {
        const promptEvent = new CustomEvent("llm-prompt-captured", {
          detail: {
            dialogueKey: config.dialogueKey,
            characterId: config.characterId,
            modelName: config.modelName,
            timestamp: Date.now(),
            messages: finalMessages,
          },
        });
        window.dispatchEvent(promptEvent);
      }

      // 根据模型类型选择流式调用方式
      if (config.llmType === "claude" || config.llmType === "openai") {
        return await invokeClaudeModelStream(finalMessages, config, callbacks);
      }

      // Gemini 和 Ollama 暂不支持流式，回退到非流式
      console.warn(`[LLMNodeTools] 流式模式不支持 ${config.llmType}，回退到非流式`);
      const result = await this.invokeLLM(config);
      callbacks.onToken?.(result);
      return result;

    } catch (error) {
      this.handleError(error as Error, "invokeLLMStream");
    }
  }

  private static createLLM(config: LLMConfig): ChatOpenAI | ChatOllama | ReturnType<typeof createGeminiRunnable> {
    const safeModel = config.modelName?.trim() || "";

    if (config.llmType === "openai" || config.llmType === "claude") {
      // Claude 通过 OpenAI 兼容接口调用（使用代理服务）
      return new ChatOpenAI({
        modelName: safeModel,
        openAIApiKey: config.apiKey,
        configuration: {
          baseURL: config.baseUrl?.trim() || undefined,
        },
        temperature: config.temperature ?? DEFAULT_LLM_SETTINGS.temperature,
        maxRetries: config.maxRetries ?? DEFAULT_LLM_SETTINGS.maxRetries,
        topP: config.topP ?? DEFAULT_LLM_SETTINGS.topP,
        frequencyPenalty: config.frequencyPenalty ?? DEFAULT_LLM_SETTINGS.frequencyPenalty,
        presencePenalty: config.presencePenalty ?? DEFAULT_LLM_SETTINGS.presencePenalty,
        streaming: config.streaming ?? DEFAULT_LLM_SETTINGS.streaming,
        streamUsage: config.streamUsage ?? DEFAULT_LLM_SETTINGS.streamUsage,
      });
    } else if (config.llmType === "ollama") {
      return new ChatOllama({
        model: safeModel,
        baseUrl: config.baseUrl?.trim() || "http://localhost:11434",
        temperature: config.temperature ?? DEFAULT_LLM_SETTINGS.temperature,
        topK: config.topK ?? DEFAULT_LLM_SETTINGS.topK,
        topP: config.topP ?? DEFAULT_LLM_SETTINGS.topP,
        frequencyPenalty: config.frequencyPenalty ?? DEFAULT_LLM_SETTINGS.frequencyPenalty,
        presencePenalty: config.presencePenalty ?? DEFAULT_LLM_SETTINGS.presencePenalty,
        repeatPenalty: config.repeatPenalty ?? DEFAULT_LLM_SETTINGS.repeatPenalty,
        streaming: config.streaming ?? DEFAULT_LLM_SETTINGS.streaming,
      });
    } else if (config.llmType === "gemini") {
      return createGeminiRunnable({
        apiKey: config.apiKey,
        model: safeModel || "gemini-1.5-flash",
        baseUrl: config.baseUrl,
        temperature: config.temperature ?? DEFAULT_LLM_SETTINGS.temperature,
        maxTokens: config.maxTokens ?? DEFAULT_LLM_SETTINGS.maxTokens,
        topP: config.topP ?? DEFAULT_LLM_SETTINGS.topP,
        topK: config.topK ?? DEFAULT_LLM_SETTINGS.topK,
      });
    } else {
      throw new Error(`Unsupported LLM type: ${config.llmType}`);
    }
  }

} 
