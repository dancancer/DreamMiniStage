/* ═══════════════════════════════════════════════════════════════════════════
   Gemini Client - Google Gemini API 适配器
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   将 Gemini API 包装成 LangChain Runnable 接口
   支持多种输入格式的统一处理
   ═══════════════════════════════════════════════════════════════════════════ */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { RunnableLambda } from "@langchain/core/runnables";
import { BaseMessage } from "@langchain/core/messages";

/* ───────────────────────────────────────────────────────────────────────────
   类型定义
   ─────────────────────────────────────────────────────────────────────────── */

export interface GeminiConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
}

/**
 * Gemini 输入可能的格式
 */
type GeminiInput =
  | string
  | { system_message?: string; user_message?: string }
  | { messages: BaseMessage[] }
  | { toChatMessages: () => BaseMessage[] }
  | BaseMessage[];

/**
 * 消息对象 - 兼容不同来源的消息格式
 */
interface MessageLike {
  _getType?: () => string;
  role?: string;
  content?: string | ContentPart[] | Record<string, unknown>;
}

/**
 * 内容部分 - 消息内容可能的结构
 */
interface ContentPart {
  text?: string;
  [key: string]: unknown;
}

/**
 * Gemini API 响应结构
 */
interface GeminiResponse {
  text?: () => string;
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        [key: string]: unknown;
      }>;
    };
    [key: string]: unknown;
  }>;
}

/* ───────────────────────────────────────────────────────────────────────────
   主要API
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * 创建 Gemini Runnable - 可与 LangChain 集成
 */
export function createGeminiRunnable(config: GeminiConfig) {
  const safeModel = config.model?.trim() || "gemini-1.5-flash";

  return RunnableLambda.from(async (input: GeminiInput) => {
    const { system, user } = normalizePrompt(input);
    const { client, requestOptions } = createClient(config.apiKey, config.baseUrl);

    const model = client.getGenerativeModel({
      model: safeModel,
      systemInstruction: system,
    }, requestOptions);

    const generationConfig = buildGenerationConfig(config);
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: user }],
        },
      ],
      generationConfig,
    });

    const text = result.response?.text?.() || extractCandidateText(result.response as unknown as GeminiResponse);
    if (!text) {
      throw new Error("Gemini 返回为空");
    }
    return text;
  });
}

export async function callGeminiOnce(input: {
  system: string;
  user: string;
  config: GeminiConfig;
}): Promise<string> {
  const { system, user, config } = input;
  const { client, requestOptions } = createClient(config.apiKey, config.baseUrl);
  const safeModel = config.model?.trim() || "gemini-1.5-flash";

  const model = client.getGenerativeModel({
    model: safeModel,
    systemInstruction: system,
  }, requestOptions);

  const generationConfig = buildGenerationConfig(config);
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: user }],
      },
    ],
    generationConfig,
  });

  const text = result.response?.text?.() || extractCandidateText(result.response as unknown as GeminiResponse);
  if (!text) {
    throw new Error("Gemini 返回为空");
  }
  return text;
}

/* ───────────────────────────────────────────────────────────────────────────
   辅助函数
   ─────────────────────────────────────────────────────────────────────────── */

function createClient(apiKey: string, baseUrl?: string) {
  const client = new GoogleGenerativeAI(apiKey);
  const trimmedBase = baseUrl?.trim();
  const requestOptions = trimmedBase ? { baseUrl: trimmedBase } : undefined;
  return { client, requestOptions };
}

function buildGenerationConfig(config: GeminiConfig) {
  const generationConfig: Record<string, number> = {};
  if (config.temperature !== undefined) generationConfig.temperature = config.temperature;
  if (config.maxTokens !== undefined) generationConfig.maxOutputTokens = config.maxTokens;
  if (config.topP !== undefined) generationConfig.topP = config.topP;
  if (config.topK !== undefined) generationConfig.topK = config.topK;
  return generationConfig;
}

/**
 * 规范化输入 - 将各种格式统一为 {system, user} 结构
 */
function normalizePrompt(input: GeminiInput): { system: string; user: string } {
  // 处理带 toChatMessages 方法的对象
  if (typeof input === "object" && input !== null && "toChatMessages" in input) {
    return pickFromMessages(input.toChatMessages());
  }

  // 处理消息数组
  if (Array.isArray(input)) {
    return pickFromMessages(input);
  }

  // 处理带 messages 字段的对象
  if (typeof input === "object" && input !== null && "messages" in input && Array.isArray(input.messages)) {
    return pickFromMessages(input.messages);
  }

  // 处理带 system_message/user_message 字段的对象
  if (typeof input === "object" && input !== null) {
    const obj = input as { system_message?: string; user_message?: string };
    if (obj.system_message || obj.user_message) {
      return {
        system: obj.system_message || "",
        user: obj.user_message || obj.system_message || "",
      };
    }
  }

  // 默认处理字符串
  return { system: "", user: typeof input === "string" ? input : "" };
}

/**
 * 从消息数组中提取 system 和 user 消息
 */
function pickFromMessages(messages: Array<BaseMessage | MessageLike>): { system: string; user: string } {
  let system = "";
  let user = "";

  messages.forEach((message) => {
    const role = getRole(message);
    const text = getText((message as MessageLike).content);
    if (!text) return;
    if (role === "system") {
      system = text;
    } else if (role === "human" || role === "user") {
      user = text;
    }
  });

  return { system, user: user || system };
}

/**
 * 获取消息角色
 */
function getRole(message: BaseMessage | MessageLike): string {
  const msg = message as MessageLike;
  if (typeof msg?._getType === "function") {
    return msg._getType();
  }
  if (msg?.role) return msg.role;
  return "";
}

/**
 * 提取文本内容 - 支持多种格式
 */
function getText(content: string | ContentPart[] | Record<string, unknown> | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => getText(part)).join(" ");
  if (typeof content === "object" && "text" in content && typeof content.text === "string") {
    return content.text;
  }
  return "";
}

/**
 * 从响应中提取文本 - 兼容不同的响应结构
 */
function extractCandidateText(response: GeminiResponse): string {
  if (!response?.candidates) return "";
  const candidate = response.candidates.find((item) => item?.content?.parts?.length);
  if (!candidate) return "";
  return candidate.content?.parts?.map((part) => part.text || "").join("") || "";
}
