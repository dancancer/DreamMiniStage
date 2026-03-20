import { NodeTool } from "@/lib/nodeflow/NodeTool";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { createGeminiRunnable } from "@/lib/core/gemini-client";
import {
  invokeClaudeModel,
  invokeGeminiModel,
  invokeClaudeModelStream,
  invokeOpenAIModel,
  invokeOpenAIModelStream,
  invokeOpenAIWithTools,
  type StreamingCallbacks,
} from "./model-invokers";
import type { LLMConfig } from "./llm-config";
import { hasFunctionCalling } from "./function-calling";
import {
  emitPromptCapturedEvent,
  normalizeMessages,
  publishTokenUsage,
} from "./runtime-helpers";
import { stripMvuProtocolBlocks } from "@/lib/mvu/protocol";

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

const DEFAULT_LLM_SETTINGS = {
  temperature: 0.7,
  maxTokens: undefined,
  timeout: undefined,
  maxRetries: 0,
  topP: 0.7,
  frequencyPenalty: 0,
  presencePenalty: 0,
  topK: 40,
  repeatPenalty: 1.1,
  streaming: false,
  streamUsage: true,
};

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

      const finalMessages = normalizeMessages(config);
      
      // ═══════════════════════════════════════════════════════════════════════
      // 广播实际发送的提示词数据，供提示词查看器捕获
      // ═══════════════════════════════════════════════════════════════════════
      emitPromptCapturedEvent(config, finalMessages);

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
        // MVU/脚本工具函数调用模式
        if (hasFunctionCalling(config)) {
          return await invokeOpenAIWithTools(
            finalMessages,
            config,
            {
              onUsage: publishTokenUsage,
            },
          );
        }

        // 标准调用（无工具）
        const response = await invokeOpenAIModel(
          finalMessages,
          config,
          {
            onUsage: publishTokenUsage,
          },
        );

        if (config.streaming && config.streamUsage && typeof window !== "undefined" && !window.lastTokenUsage) {
          console.log("📊 Token usage not found in response, this may be due to streaming mode");
        }

        return response;
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

      const finalMessages = normalizeMessages(config);

      if (config.llmType === "openai" && config.mvuToolEnabled) {
        const result = await invokeOpenAIWithTools(
          finalMessages,
          {
            ...config,
            streaming: false,
          },
          {
            ...callbacks,
            onUsage: (usage) => {
              publishTokenUsage(usage);
              callbacks.onUsage?.(usage);
            },
          },
        );
        const visibleResult = stripMvuProtocolBlocks(result);
        if (visibleResult) {
          callbacks.onToken?.(visibleResult);
        }
        return result;
      }

      if (config.llmType === "claude" && hasFunctionCalling(config)) {
        const result = await invokeClaudeModel(
          finalMessages,
          {
            ...config,
            streaming: false,
          },
          callbacks,
        );
        const visibleResult = stripMvuProtocolBlocks(result);
        if (visibleResult) {
          callbacks.onToken?.(visibleResult);
        }
        return result;
      }

      // 广播提示词事件
      emitPromptCapturedEvent(config, finalMessages);

      let streamedText = "";
      const streamingCallbacks: StreamingCallbacks = {
        ...callbacks,
        onToken: (token) => {
          streamedText += token;
          callbacks.onToken?.(token);
        },
        onUsage: (usage) => {
          publishTokenUsage(usage);
          callbacks.onUsage?.(usage);
        },
      };

      // 根据模型类型选择流式调用方式
      if (config.llmType === "claude") {
        return await invokeClaudeModelStream(finalMessages, config, streamingCallbacks);
      }

      if (config.llmType === "openai") {
        const streamedResult = await invokeOpenAIModelStream(finalMessages, config, streamingCallbacks);
        const resolvedStreamedResult = streamedResult || streamedText;
        if (
          resolvedStreamedResult.length > 0 ||
          !config.scriptTools ||
          config.scriptTools.length === 0
        ) {
          return resolvedStreamedResult;
        }

        const bufferedResult = await invokeOpenAIWithTools(
          finalMessages,
          {
            ...config,
            streaming: false,
          },
          {
            ...callbacks,
            onUsage: (usage) => {
              publishTokenUsage(usage);
              callbacks.onUsage?.(usage);
            },
          },
        );
        if (bufferedResult.length > 0) {
          callbacks.onToken?.(bufferedResult);
        }
        return bufferedResult;
      }

      if (config.llmType === "gemini") {
        console.warn("[LLMNodeTools] 流式模式不支持 gemini，回退到非流式");
        const result = await invokeGeminiModel(
          finalMessages,
          {
            ...config,
            streaming: false,
          },
          callbacks,
        );
        callbacks.onToken?.(result);
        return result;
      }

      // Ollama 暂不支持流式，回退到非流式
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
        maxTokens: config.maxTokens ?? DEFAULT_LLM_SETTINGS.maxTokens,
        timeout: config.timeout,
        maxRetries: config.maxRetries ?? DEFAULT_LLM_SETTINGS.maxRetries,
        topP: config.topP ?? DEFAULT_LLM_SETTINGS.topP,
        frequencyPenalty: config.frequencyPenalty ?? DEFAULT_LLM_SETTINGS.frequencyPenalty,
        presencePenalty: config.presencePenalty ?? DEFAULT_LLM_SETTINGS.presencePenalty,
        stop: config.stopStrings,
        streaming: config.streaming ?? DEFAULT_LLM_SETTINGS.streaming,
        streamUsage: config.streamUsage ?? DEFAULT_LLM_SETTINGS.streamUsage,
      });
    } else if (config.llmType === "ollama") {
      return new ChatOllama({
        model: safeModel,
        baseUrl: config.baseUrl?.trim() || "http://localhost:11434",
        temperature: config.temperature ?? DEFAULT_LLM_SETTINGS.temperature,
        topK: config.topK ?? DEFAULT_LLM_SETTINGS.topK,
        numCtx: config.contextWindow,
        numPredict: config.maxTokens,
        topP: config.topP ?? DEFAULT_LLM_SETTINGS.topP,
        frequencyPenalty: config.frequencyPenalty ?? DEFAULT_LLM_SETTINGS.frequencyPenalty,
        presencePenalty: config.presencePenalty ?? DEFAULT_LLM_SETTINGS.presencePenalty,
        repeatPenalty: config.repeatPenalty ?? DEFAULT_LLM_SETTINGS.repeatPenalty,
        stop: config.stopStrings,
        streaming: config.streaming ?? DEFAULT_LLM_SETTINGS.streaming,
      });
    } else if (config.llmType === "gemini") {
      return createGeminiRunnable({
        apiKey: config.apiKey,
        model: safeModel || "gemini-1.5-flash",
        baseUrl: config.baseUrl,
        timeout: config.timeout,
        temperature: config.temperature ?? DEFAULT_LLM_SETTINGS.temperature,
        maxTokens: config.maxTokens ?? DEFAULT_LLM_SETTINGS.maxTokens,
        topP: config.topP ?? DEFAULT_LLM_SETTINGS.topP,
        topK: config.topK ?? DEFAULT_LLM_SETTINGS.topK,
        stopSequences: config.stopStrings,
      });
    } else {
      throw new Error(`Unsupported LLM type: ${config.llmType}`);
    }
  }

} 
