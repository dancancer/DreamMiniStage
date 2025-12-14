/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Claude 模型转换器                                       ║
 * ║                                                                            ║
 * ║  职责：                                                                     ║
 * ║  1. 提取前置 system 消息到独立 systemPrompt 数组                             ║
 * ║  2. 转换剩余 system 消息为 user 角色                                         ║
 * ║  3. 转换 tool_calls 为 Claude tool_use 格式                                 ║
 * ║  4. 转换 tool 消息为 Claude tool_result 格式                                ║
 * ║  5. 合并连续同角色消息                                                       ║
 * ║  6. 空消息兜底                                                              ║
 * ║                                                                            ║
 * ║  Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 4.4, 4.5                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  ExtendedChatMessage,
  ContentPart,
  ToolUseContentPart,
  ToolResultContentPart,
} from "../../st-preset-types";
import { getTextContent, mergeContent } from "../post-processor";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Claude 转换结果
 *
 * Claude API 要求：
 * - system 消息必须通过独立的 system 参数传递
 * - messages 数组只能包含 user/assistant 角色
 * - 消息必须 user/assistant 交替
 */
export interface ClaudeConversionResult {
  /** 处理后的消息数组（仅 user/assistant） */
  messages: ClaudeMessage[];
  /** 提取的系统提示词数组 */
  systemPrompt: ClaudeSystemBlock[];
}

/**
 * Claude 系统提示词块
 */
export interface ClaudeSystemBlock {
  type: "text";
  text: string;
}

/**
 * Claude 消息格式
 */
export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | ClaudeContentPart[];
}

/**
 * Claude 内容片段类型
 */
export type ClaudeContentPart =
  | { type: "text"; text: string }
  | { type: "image"; source: ClaudeImageSource }
  | ToolUseContentPart
  | ToolResultContentPart;

/**
 * Claude 图片源格式
 */
export interface ClaudeImageSource {
  type: "base64";
  media_type: string;
  data: string;
}

/** 默认占位符 */
const DEFAULT_PLACEHOLDER = "Let's get started.";

/* ═══════════════════════════════════════════════════════════════════════════
   主转换函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 转换消息为 Claude API 格式
 *
 * 设计哲学：
 * - 管线化处理：提取 system → 转换角色 → 转换工具 → 合并 → 兜底
 * - 消除特殊情况：通过统一的数据结构减少分支判断
 * - 保持幂等性：多次转换结果一致
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 *
 * @param messages - 输入消息数组
 * @param options - 转换选项
 * @returns Claude 格式的转换结果
 */
export function convertForClaude(
  messages: ExtendedChatMessage[],
  options: ClaudeConvertOptions = {},
): ClaudeConversionResult {
  const { useTools = false, placeholder = DEFAULT_PLACEHOLDER } = options;

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: 提取前置 system 消息
  // Claude 要求 system 通过独立参数传递，不能在 messages 中
  // ─────────────────────────────────────────────────────────────────────────
  const { systemPrompt, remaining } = extractLeadingSystem(messages);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: 转换剩余 system 为 user
  // 中途的 system 消息降级为 user，保持语义但符合 API 要求
  // ─────────────────────────────────────────────────────────────────────────
  let result = convertSystemToUser(remaining);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: 转换工具调用格式
  // OpenAI tool_calls → Claude tool_use
  // tool 消息 → tool_result
  // ─────────────────────────────────────────────────────────────────────────
  if (useTools) {
    result = convertToolFormat(result);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: 合并连续同角色消息
  // Claude 要求 user/assistant 严格交替
  // ─────────────────────────────────────────────────────────────────────────
  result = mergeConsecutiveSameRole(result);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5: 空消息兜底
  // 确保至少有一条消息，避免 API 请求失败
  // ─────────────────────────────────────────────────────────────────────────
  if (result.length === 0) {
    result = [{ role: "user", content: placeholder }];
  }

  return {
    messages: result as ClaudeMessage[],
    systemPrompt,
  };
}

/**
 * Claude 转换选项
 */
export interface ClaudeConvertOptions {
  /** 是否保留并转换工具调用 */
  useTools?: boolean;
  /** 占位符文本 */
  placeholder?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   子函数：提取前置 system
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 提取前置 system 消息
 *
 * 设计哲学：
 * - 只提取连续的前置 system 消息
 * - 遇到第一个非 system 消息后停止
 * - 通过索引遍历消除特殊情况
 *
 * Requirements: 7.1
 */
function extractLeadingSystem(messages: ExtendedChatMessage[]): {
  systemPrompt: ClaudeSystemBlock[];
  remaining: ExtendedChatMessage[];
} {
  const systemPrompt: ClaudeSystemBlock[] = [];
  let firstNonSystemIndex = 0;

  // 查找第一个非 system 消息的索引
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role !== "system") {
      firstNonSystemIndex = i;
      break;
    }
    // 提取 system 消息内容
    const text = getTextContent(messages[i].content);
    if (text.trim()) {
      systemPrompt.push({ type: "text", text });
    }
    firstNonSystemIndex = i + 1;
  }

  return {
    systemPrompt,
    remaining: messages.slice(firstNonSystemIndex),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   子函数：转换 system 为 user
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 将 system 消息转为 user
 *
 * Requirements: 7.2
 */
function convertSystemToUser(
  messages: ExtendedChatMessage[],
): ExtendedChatMessage[] {
  return messages.map((msg) =>
    msg.role === "system" ? { ...msg, role: "user" as const } : msg,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   子函数：转换工具格式
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 转换工具调用为 Claude 格式
 *
 * 设计哲学：
 * - tool_calls → content 中的 tool_use 块
 * - tool 消息 → user 消息 + tool_result 块
 * - 保持消息顺序不变
 *
 * Requirements: 4.4, 4.5
 */
function convertToolFormat(
  messages: ExtendedChatMessage[],
): ExtendedChatMessage[] {
  return messages.map((msg) => {
    // 转换 assistant 的 tool_calls
    if (msg.role === "assistant" && msg.tool_calls?.length) {
      const toolUseParts: ToolUseContentPart[] = msg.tool_calls.map((tc) => ({
        type: "tool_use" as const,
        id: tc.id,
        name: tc.function.name,
        input: safeParseJson(tc.function.arguments),
      }));

      // 合并原有内容和 tool_use 块
      const existingContent = msg.content;
      const newContent: ContentPart[] =
        typeof existingContent === "string"
          ? existingContent.trim()
            ? [{ type: "text", text: existingContent }, ...toolUseParts]
            : toolUseParts
          : [...existingContent, ...toolUseParts];

      return {
        ...msg,
        content: newContent,
        tool_calls: undefined, // 移除原字段
      };
    }

    // 转换 tool 消息为 user + tool_result
    if (msg.role === "tool" && msg.tool_call_id) {
      const toolResultPart: ToolResultContentPart = {
        type: "tool_result",
        tool_use_id: msg.tool_call_id,
        content: getTextContent(msg.content),
      };

      return {
        role: "user" as const,
        content: [toolResultPart],
      };
    }

    return msg;
  });
}

/**
 * 安全解析 JSON
 *
 * 解析失败时返回原始字符串，避免中断流程
 */
function safeParseJson(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   子函数：合并连续同角色
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 合并连续同角色消息
 *
 * 设计哲学：
 * - Claude 要求 user/assistant 严格交替
 * - 通过合并消除连续同角色
 * - 保持内容完整性
 *
 * Requirements: 7.3
 */
function mergeConsecutiveSameRole(
  messages: ExtendedChatMessage[],
): ExtendedChatMessage[] {
  if (messages.length === 0) return [];

  const result: ExtendedChatMessage[] = [];

  for (const msg of messages) {
    const last = result[result.length - 1];

    if (last && last.role === msg.role) {
      // 合并内容
      last.content = mergeContent(last.content, msg.content);
    } else {
      result.push({ ...msg });
    }
  }

  return result;
}
