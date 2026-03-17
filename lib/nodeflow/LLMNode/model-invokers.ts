/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     模型特定调用器                                          ║
 * ║                                                                            ║
 * ║  职责：                                                                     ║
 * ║  1. Claude 模型调用（使用 convertForClaude 转换）                            ║
 * ║  2. Gemini 模型调用（使用 convertForGoogle 转换）                            ║
 * ║                                                                            ║
 * ║  Requirements: 7.1, 8.1                                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { ChatOpenAI } from "@langchain/openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createGeminiRunnable } from "@/lib/core/gemini-client";
import { getTextContent } from "@/lib/core/prompt/post-processor";
import { convertForClaude, convertForGoogle } from "@/lib/core/prompt/converters";
import { extractTokenUsage, type TokenUsage } from "@/lib/adapters/token-usage";
import type { ExtendedChatMessage, ContentPart } from "@/lib/core/st-preset-types";
import type { LLMConfig } from "./llm-config";
import type { ClaudeContentPart } from "@/lib/core/prompt/converters/claude";
import {
  functionCallToUpdateContent,
  MVU_VARIABLE_UPDATE_FUNCTION,
  toGeminiMvuToolDeclaration,
} from "@/lib/mvu/function-call";
import { applyOpenAIToolCalls } from "./tool-call-runtime";
import { buildFunctionCallingTools, hasFunctionCalling } from "./function-calling";

type ChatMessage = { role: string; content: string };

/** 流式回调接口 */
export interface StreamingCallbacks {
  onToken?: (token: string) => void;
  onReasoning?: (reasoning: string) => void;
  onUsage?: (usage: TokenUsage) => void;
  onToolCallStart?: (toolName: string) => void;
  onToolCallResult?: (toolName: string, output: string) => void;
}

const DEFAULT_LLM_SETTINGS = {
  temperature: 0.7,
  maxTokens: undefined,
  maxRetries: 0,
  topP: 0.7,
  topK: 40,
  streaming: false,
  streamUsage: true,
};

function createOpenAICompatibleModel(
  config: LLMConfig,
  overrides: Partial<{
    streaming: boolean;
    streamUsage: boolean;
  }> = {},
): ChatOpenAI {
  return new ChatOpenAI({
    modelName: config.modelName,
    openAIApiKey: config.apiKey,
    configuration: {
      baseURL: config.baseUrl?.trim() || undefined,
    },
    temperature: config.temperature ?? DEFAULT_LLM_SETTINGS.temperature,
    maxTokens: config.maxTokens ?? DEFAULT_LLM_SETTINGS.maxTokens,
    timeout: config.timeout,
    maxRetries: config.maxRetries ?? DEFAULT_LLM_SETTINGS.maxRetries,
    topP: config.topP ?? DEFAULT_LLM_SETTINGS.topP,
    frequencyPenalty: config.frequencyPenalty,
    presencePenalty: config.presencePenalty,
    stop: config.stopStrings,
    streaming: overrides.streaming ?? config.streaming ?? DEFAULT_LLM_SETTINGS.streaming,
    streamUsage: overrides.streamUsage ?? config.streamUsage ?? DEFAULT_LLM_SETTINGS.streamUsage,
  });
}

async function streamOpenAICompatibleModel(
  openaiLlm: ChatOpenAI,
  messages: ChatMessage[],
  callbacks: StreamingCallbacks,
): Promise<string> {
  let fullContent = "";
  const stream = await openaiLlm.stream(messages);

  for await (const chunk of stream) {
    const content = chunk.content;
    if (typeof content === "string" && content) {
      fullContent += content;
      callbacks.onToken?.(content);
    }

    const additional = chunk.additional_kwargs as Record<string, unknown> | undefined;
    if (additional?.reasoning_content && typeof additional.reasoning_content === "string") {
      callbacks.onReasoning?.(additional.reasoning_content);
    }

    const usage = extractTokenUsage(chunk);
    if (usage) {
      callbacks.onUsage?.(usage);
    }
  }

  return fullContent;
}

function buildClaudeMessages(
  messages: ChatMessage[],
  config: LLMConfig,
): ChatMessage[] {
  const extMessages = messages as ExtendedChatMessage[];
  const { messages: claudeMessages, systemPrompt } = convertForClaude(extMessages, {
    useTools: config.tools,
    placeholder: config.placeholder,
  });

  const systemText = systemPrompt.map(s => s.text).join("\n\n");

  return systemText
    ? [{ role: "system", content: systemText }, ...claudeMessages.map(m => ({
      role: m.role,
      content: getClaudeTextContent(m.content),
    }))]
    : claudeMessages.map(m => ({
      role: m.role,
      content: getClaudeTextContent(m.content),
    }));
}

export async function invokeOpenAIModel(
  messages: ChatMessage[],
  config: LLMConfig,
  callbacks?: Pick<StreamingCallbacks, "onUsage">,
): Promise<string> {
  const openaiLlm = createOpenAICompatibleModel(config);
  const aiMessage = await openaiLlm.invoke(messages);
  const usage = extractTokenUsage(aiMessage);
  if (usage) {
    callbacks?.onUsage?.(usage);
  }
  return aiMessage.content as string;
}

export async function invokeOpenAIWithTools(
  messages: ChatMessage[],
  config: LLMConfig,
  callbacks?: Pick<StreamingCallbacks, "onToolCallStart" | "onToolCallResult" | "onUsage">,
): Promise<string> {
  const openaiLlm = createOpenAICompatibleModel(config, {
    streaming: false,
  });
  const { allTools, scriptTools } = buildFunctionCallingTools(config);
  const boundModel = openaiLlm.bindTools(allTools, { tool_choice: "auto" });
  const aiMessage = await boundModel.invoke(messages);

  const usage = extractTokenUsage(aiMessage);
  if (usage) {
    callbacks?.onUsage?.(usage);
  }

  return applyOpenAIToolCalls(
    aiMessage.content as string,
    {
      rawToolCalls: aiMessage.tool_calls ?? [],
      scriptTools,
      callbacks,
    },
  );
}

/**
 * 将 ClaudeContentPart 转换为文本内容
 */
function isClaudeTextPart(part: ClaudeContentPart): part is ClaudeContentPart & { text: string } {
  return part.type === "text" && "text" in part;
}

function getClaudeTextContent(content: string | ClaudeContentPart[]): string {
  if (typeof content === "string") {
    return content;
  }

  return content
    .filter(isClaudeTextPart)
    .map(part => part.text)
    .join("\n");
}

/* ═══════════════════════════════════════════════════════════════════════════
   Claude 模型调用 (Requirements: 7.1)

   使用 convertForClaude 转换消息格式：
   - 提取前置 system 消息到独立 systemPrompt
   - 转换剩余 system 为 user
   - 合并连续同角色消息
   - 支持 MVU 函数调用模式
   ═══════════════════════════════════════════════════════════════════════════ */
export async function invokeClaudeModel(
  messages: ChatMessage[],
  config: LLMConfig,
  callbacks?: Pick<StreamingCallbacks, "onToolCallStart" | "onToolCallResult">,
): Promise<string> {
  const finalMessages = buildClaudeMessages(messages, config);

  // ═══════════════════════════════════════════════════════════════════════════
  // MVU/脚本工具函数调用模式：绑定工具并处理 tool_calls
  // ═══════════════════════════════════════════════════════════════════════════
  if (hasFunctionCalling(config)) {
    return invokeOpenAIWithTools(finalMessages, config, callbacks);
  }

  // 标准调用（无工具）
  return invokeOpenAIModel(finalMessages, config);
}

export async function invokeOpenAIModelStream(
  messages: ChatMessage[],
  config: LLMConfig,
  callbacks: StreamingCallbacks,
): Promise<string> {
  const openaiLlm = createOpenAICompatibleModel(config, {
    streaming: true,
    streamUsage: true,
  });
  return streamOpenAICompatibleModel(openaiLlm, messages, callbacks);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Claude 模型流式调用

   使用 LangChain stream() 方法进行流式输出
   ═══════════════════════════════════════════════════════════════════════════ */
export async function invokeClaudeModelStream(
  messages: ChatMessage[],
  config: LLMConfig,
  callbacks: StreamingCallbacks,
): Promise<string> {
  const openaiLlm = createOpenAICompatibleModel(config, {
    streaming: true,
    streamUsage: true,
  });
  const finalMessages = buildClaudeMessages(messages, config);
  return streamOpenAICompatibleModel(openaiLlm, finalMessages, callbacks);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Gemini 模型调用 (Requirements: 8.1)

   使用 convertForGoogle 转换消息格式：
   - 提取前置 system 消息到 system_instruction
   - 转换 assistant 为 model
   - 转换 content 为 parts 格式
   - 支持 MVU 函数调用模式
   ═══════════════════════════════════════════════════════════════════════════ */
export async function invokeGeminiModel(
  messages: ChatMessage[],
  config: LLMConfig,
  callbacks?: Pick<StreamingCallbacks, "onToolCallStart" | "onToolCallResult">,
): Promise<string> {
  // 转换为 ExtendedChatMessage 格式
  const extMessages = messages as ExtendedChatMessage[];

  // 使用 Google 转换器
  const { contents, systemInstruction } = convertForGoogle(extMessages, {
    placeholder: config.placeholder,
  });

  // 构建 system 字符串
  const systemText = systemInstruction?.parts.map(p => "text" in p ? p.text : "").join("\n\n") || "";

  // ═══════════════════════════════════════════════════════════════════════════
  // MVU 函数调用模式：直接调用 SDK 并绑定工具
  // ═══════════════════════════════════════════════════════════════════════════
  if (config.mvuToolEnabled) {
    const client = new GoogleGenerativeAI(config.apiKey);
    const requestOptions = {
      ...(config.baseUrl?.trim() ? { baseUrl: config.baseUrl.trim() } : {}),
      ...(typeof config.timeout === "number" ? { timeout: config.timeout } : {}),
    };
    const resolvedRequestOptions = Object.keys(requestOptions).length > 0 ? requestOptions : undefined;

    const model = client.getGenerativeModel({
      model: config.modelName || "gemini-1.5-flash",
      systemInstruction: systemText,
      tools: toGeminiMvuToolDeclaration(),
    }, resolvedRequestOptions);

    const generationConfig: Record<string, unknown> = {};
    if (config.temperature !== undefined) generationConfig.temperature = config.temperature;
    if (config.maxTokens !== undefined) generationConfig.maxOutputTokens = config.maxTokens;
    if (config.topP !== undefined) generationConfig.topP = config.topP;
    if (config.topK !== undefined) generationConfig.topK = config.topK;
    if (Array.isArray(config.stopStrings) && config.stopStrings.length > 0) {
      generationConfig.stopSequences = config.stopStrings;
    }

    const result = await model.generateContent({
      contents,
      generationConfig,
    });

    // 解析响应
    const response = result.response;
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw new Error("Gemini 返回为空");
    }

    let textContent = "";
    const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

    for (const part of candidate.content.parts) {
      if ("text" in part && part.text) {
        textContent += part.text;
      }
      if ("functionCall" in part && part.functionCall) {
        functionCalls.push({
          name: part.functionCall.name,
          args: part.functionCall.args as Record<string, unknown>,
        });
      }
    }

    // 处理 MVU 函数调用
    if (functionCalls.length > 0) {
      const mvuCall = functionCalls.find(fc => fc.name === MVU_VARIABLE_UPDATE_FUNCTION.name);
      if (mvuCall?.args) {
        const mvuArgs = {
          analysis: String(mvuCall.args.analysis || ""),
          delta: String(mvuCall.args.delta || ""),
        };
        if (mvuArgs.delta && mvuArgs.delta.length > 5) {
          callbacks?.onToolCallStart?.(MVU_VARIABLE_UPDATE_FUNCTION.name);
          const updateContent = functionCallToUpdateContent(mvuArgs);
          callbacks?.onToolCallResult?.(MVU_VARIABLE_UPDATE_FUNCTION.name, updateContent);
          textContent = textContent ? `${textContent}\n\n${updateContent}` : updateContent;
          console.log("[Gemini] MVU 函数调用转换完成:", mvuArgs.analysis);
        }
      }
    }

    return textContent;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 标准调用（无工具）：使用现有的 Gemini 客户端
  // ═══════════════════════════════════════════════════════════════════════════
  const geminiRunnable = createGeminiRunnable({
    apiKey: config.apiKey,
    model: config.modelName || "gemini-1.5-flash",
    baseUrl: config.baseUrl,
    timeout: config.timeout,
    temperature: config.temperature ?? DEFAULT_LLM_SETTINGS.temperature,
    maxTokens: config.maxTokens ?? DEFAULT_LLM_SETTINGS.maxTokens,
    topP: config.topP ?? DEFAULT_LLM_SETTINGS.topP,
    topK: config.topK ?? DEFAULT_LLM_SETTINGS.topK,
    stopSequences: config.stopStrings,
  });

  // 将转换后的消息传递给 Gemini
  const userContent = contents
    .filter(c => c.role === "user")
    .flatMap(c => c.parts)
    .map(p => "text" in p ? p.text : "")
    .join("\n");

  const response = await geminiRunnable.invoke({
    system_message: systemText,
    user_message: userContent,
  });

  return response as string;
}
