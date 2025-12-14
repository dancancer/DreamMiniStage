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
import { createGeminiRunnable } from "@/lib/core/gemini-client";
import { getTextContent } from "@/lib/core/prompt/post-processor";
import { convertForClaude, convertForGoogle } from "@/lib/core/prompt/converters";
import type { ExtendedChatMessage, ContentPart } from "@/lib/core/st-preset-types";
import type { LLMConfig } from "./LLMNodeTools";
import type { ClaudeMessage, ClaudeContentPart } from "@/lib/core/prompt/converters/claude";

type ChatMessage = { role: string; content: string };

const DEFAULT_LLM_SETTINGS = {
  temperature: 0.7,
  maxTokens: undefined,
  maxRetries: 0,
  topP: 0.7,
  topK: 40,
  streaming: false,
  streamUsage: true,
};

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
   ═══════════════════════════════════════════════════════════════════════════ */
export async function invokeClaudeModel(
  messages: ChatMessage[],
  config: LLMConfig,
): Promise<string> {
  // 转换为 ExtendedChatMessage 格式
  const extMessages = messages as ExtendedChatMessage[];
  
  // 使用 Claude 转换器
  const { messages: claudeMessages, systemPrompt } = convertForClaude(extMessages, {
    useTools: config.tools,
    placeholder: config.placeholder,
  });
  
  // 构建 system 字符串（Claude API 需要）
  const systemText = systemPrompt.map(s => s.text).join("\n\n");
  
  // 使用 OpenAI 兼容接口调用 Claude（通过 baseUrl 配置）
  const openaiLlm = new ChatOpenAI({
    modelName: config.modelName,
    openAIApiKey: config.apiKey,
    configuration: {
      baseURL: config.baseUrl?.trim() || undefined,
    },
    temperature: config.temperature ?? DEFAULT_LLM_SETTINGS.temperature,
    maxRetries: config.maxRetries ?? DEFAULT_LLM_SETTINGS.maxRetries,
    streaming: config.streaming ?? DEFAULT_LLM_SETTINGS.streaming,
    streamUsage: config.streamUsage ?? DEFAULT_LLM_SETTINGS.streamUsage,
  });

  // 将 system 作为首条消息（OpenAI 兼容格式）
  const finalMessages: ChatMessage[] = systemText
    ? [{ role: "system", content: systemText }, ...claudeMessages.map(m => ({
      role: m.role,
      content: getClaudeTextContent(m.content),
    }))]
    : claudeMessages.map(m => ({
      role: m.role,
      content: getClaudeTextContent(m.content),
    }));
  
  const aiMessage = await openaiLlm.invoke(finalMessages);
  return aiMessage.content as string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Gemini 模型调用 (Requirements: 8.1)
   
   使用 convertForGoogle 转换消息格式：
   - 提取前置 system 消息到 system_instruction
   - 转换 assistant 为 model
   - 转换 content 为 parts 格式
   ═══════════════════════════════════════════════════════════════════════════ */
export async function invokeGeminiModel(
  messages: ChatMessage[],
  config: LLMConfig,
): Promise<string> {
  // 转换为 ExtendedChatMessage 格式
  const extMessages = messages as ExtendedChatMessage[];
  
  // 使用 Google 转换器
  const { contents, systemInstruction } = convertForGoogle(extMessages, {
    placeholder: config.placeholder,
  });
  
  // 构建 system 字符串
  const systemText = systemInstruction?.parts.map(p => "text" in p ? p.text : "").join("\n\n") || "";
  
  // 使用现有的 Gemini 客户端
  const geminiRunnable = createGeminiRunnable({
    apiKey: config.apiKey,
    model: config.modelName || "gemini-1.5-flash",
    baseUrl: config.baseUrl,
    temperature: config.temperature ?? DEFAULT_LLM_SETTINGS.temperature,
    maxTokens: config.maxTokens ?? DEFAULT_LLM_SETTINGS.maxTokens,
    topP: config.topP ?? DEFAULT_LLM_SETTINGS.topP,
    topK: config.topK ?? DEFAULT_LLM_SETTINGS.topK,
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
