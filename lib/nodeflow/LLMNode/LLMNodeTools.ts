import { NodeTool } from "@/lib/nodeflow/NodeTool";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableLike, RunnablePassthrough, RunnableLambda, type Runnable } from "@langchain/core/runnables";
import { createGeminiRunnable } from "@/lib/core/gemini-client";
import { postProcessMessages, getTextContent } from "@/lib/core/prompt/post-processor";
import { invokeClaudeModel, invokeGeminiModel } from "./model-invokers";
import { extractTokenUsage, type TokenUsage } from "@/lib/adapters/token-usage";
import type { PromptNames, ExtendedChatMessage, PostProcessingMode } from "@/lib/core/st-preset-types";

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
 * 合并相邻同角色消息（简单版本，用于回退）
 * 
 * 大多数 LLM API 要求相邻消息角色交替，连续的同角色消息会导致报错。
 * 此函数在发送请求前将相邻同角色消息合并为一条。
 */
function mergeAdjacentMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length === 0) return [];
  
  const merged: ChatMessage[] = [];
  for (const msg of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === msg.role) {
      // 相邻同角色：合并内容
      last.content = `${last.content}\n\n${msg.content}`;
    } else {
      merged.push({ role: msg.role, content: msg.content });
    }
  }
  return merged;
}

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

  static async invokeLLM(
    systemMessage: string,
    userMessage: string,
    config: LLMConfig,
  ): Promise<string> {
    try {
      console.log("invokeLLM");
      
      /* ═══════════════════════════════════════════════════════════════════════
         messages-only 架构：messages[] 是唯一事实源
         
         Requirements 1.1: 仅使用 messages[] 作为最终提示词内容
         Requirements 7.2: 若 messages[] 中无 user 消息，追加 fallback
         ═══════════════════════════════════════════════════════════════════════ */
      
      // 优先使用预设构建的完整 messages 数组，回退到简单的 system + user 结构
      let rawMessages = config.messages && config.messages.length > 0
        ? [...config.messages]  // 浅拷贝，避免修改原数组
        : [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage },
        ];
      
      /* ═══════════════════════════════════════════════════════════════════════
         用户消息存在性保证 (Requirements 7.2)
         
         大多数 LLM API 要求至少有一条 user 消息，否则会报错。
         若 messages[] 中无 user 消息，追加 fallback user 消息。
         ═══════════════════════════════════════════════════════════════════════ */
      const hasUserMessage = rawMessages.some(msg => msg.role === "user");
      if (!hasUserMessage) {
        // 使用 userMessage 作为 fallback，若也为空则使用默认占位符
        const fallbackContent = userMessage?.trim() || "[继续]";
        rawMessages.push({ role: "user", content: fallbackContent });
      }

      /* ═══════════════════════════════════════════════════════════════════════
         后处理管线 (Requirements: 7.1, 8.1)
         
         根据 promptNames 和 postProcessingMode 应用后处理：
         - 名称规范化（将 name 字段转为 content 前缀）
         - 角色合并（合并连续同角色消息）
         - 严格模式处理（确保 user 起始）
         ═══════════════════════════════════════════════════════════════════════ */
      let finalMessages: ChatMessage[];
      
      if (config.promptNames && config.postProcessingMode) {
        // 使用新的后处理管线
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
        // 回退到简单合并
        finalMessages = mergeAdjacentMessages(rawMessages);
      }
      
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
            systemMessage,
            userMessage,
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

        // 直接调用LLM获取完整的AIMessage响应
        const aiMessage = await openaiLlm.invoke(finalMessages);

        /* ─────────────────────────────────────────────────────────────────────
           使用适配器链提取 token usage
           - 统一的接口，支持多种 LLM 响应格式
           - 消除 provider-specific 的 if-else 分支
           ───────────────────────────────────────────────────────────────────── */
        const usageData = extractTokenUsage(aiMessage);

        // 转换为 snake_case 格式（保持与现有 API 的兼容性）
        const tokenUsage = usageData ? {
          prompt_tokens: usageData.promptTokens,
          completion_tokens: usageData.completionTokens,
          total_tokens: usageData.totalTokens,
        } : null;

        // 如果没有从响应中获取到token usage，尝试从流式响应中获取
        if (!tokenUsage && config.streaming && config.streamUsage) {
          console.log("📊 Token usage not found in response, this may be due to streaming mode");
        }

        // 将token usage信息存储到全局变量供插件使用
        if (tokenUsage) {
          if (typeof window !== "undefined") {
            window.lastTokenUsage = tokenUsage;
            console.log("📊 Token usage stored for plugins:", tokenUsage);

            // 触发自定义事件通知插件
            const event = new CustomEvent("llm-token-usage", {
              detail: { tokenUsage },
            });
            window.dispatchEvent(event);
          }
        }

        return aiMessage.content as string;
      }

      // 对于其他LLM类型（ollama），使用通用的 chain 方式
      const llm = this.createLLM(config);
      const dialogueChain = this.createDialogueChain(llm);
      const response = await dialogueChain.invoke({
        system_message: systemMessage,
        user_message: userMessage,
      });
      
      if (!response || typeof response !== "string") {
        throw new Error("Invalid response from LLM");
      }

      return response;
    } catch (error) {
      this.handleError(error as Error, "invokeLLM");
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

  /* ═══════════════════════════════════════════════════════════════════════════
     创建对话链

     RunnableLike 泛型：
     - 输入/输出类型未知，因为支持多种 LLM 实现
     - 使用 unknown 表达"任意类型但需要在使用时验证"

     返回值：
     - 返回 LangChain Runnable，结构复杂且动态
     - 使用 unknown 表达，调用方负责正确使用

     设计理念：LangChain 是外部库，我们只保证接口契约，不保证内部类型
     ═══════════════════════════════════════════════════════════════════════════ */
  private static createDialogueChain(llm: RunnableLike<unknown, unknown>): Runnable<{ system_message: string; user_message: string }, string> {
    const dialoguePrompt = ChatPromptTemplate.fromMessages([
      ["system", "{system_message}"],
      ["human", "{user_message}"],
    ]);

    type InputType = { system_message: string; user_message: string };

    // 使用 RunnableLambda 替代 RunnablePassthrough.assign 以避免类型问题
    const assignRunnable = RunnableLambda.from((input: InputType) => ({
      system_message: input.system_message,
      user_message: input.user_message,
    }));

    return assignRunnable
      .pipe(dialoguePrompt)
      .pipe(llm)
      .pipe(new StringOutputParser());
  }
} 
