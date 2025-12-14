/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Google 模型转换器                                       ║
 * ║                                                                            ║
 * ║  职责：                                                                     ║
 * ║  1. 提取前置 system 消息到 system_instruction                               ║
 * ║  2. 转换剩余 system 消息为 user 角色                                         ║
 * ║  3. 转换 assistant 角色为 model 角色                                        ║
 * ║  4. 转换 content 为 parts 数组格式                                          ║
 * ║  5. 合并连续同角色消息                                                       ║
 * ║                                                                            ║
 * ║  Requirements: 8.1, 8.2, 8.3, 8.4, 8.5                                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  ExtendedChatMessage,
  ContentPart,
} from "../../st-preset-types";
import { getTextContent } from "../post-processor";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Google 转换结果
 *
 * Gemini API 要求：
 * - system 消息通过 system_instruction 参数传递
 * - contents 数组只能包含 user/model 角色
 * - 消息必须 user/model 交替
 * - content 必须是 parts 数组格式
 */
export interface GoogleConversionResult {
  /** 处理后的消息数组（仅 user/model） */
  contents: GoogleMessage[];
  /** 提取的系统指令 */
  systemInstruction: GoogleSystemInstruction | null;
}

/**
 * Google 系统指令格式
 */
export interface GoogleSystemInstruction {
  parts: GooglePart[];
}

/**
 * Google 消息格式
 */
export interface GoogleMessage {
  role: "user" | "model";
  parts: GooglePart[];
}

/**
 * Google 内容片段类型
 */
export type GooglePart =
  | { text: string }
  | { inlineData: GoogleInlineData }
  | { fileData: GoogleFileData };

/**
 * Google 内联数据格式（图片等）
 */
export interface GoogleInlineData {
  mimeType: string;
  data: string;
}

/**
 * Google 文件数据格式
 */
export interface GoogleFileData {
  mimeType: string;
  fileUri: string;
}

/** 默认占位符 */
const DEFAULT_PLACEHOLDER = "Let's get started.";

/* ═══════════════════════════════════════════════════════════════════════════
   主转换函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 转换消息为 Google Gemini API 格式
 *
 * 设计哲学：
 * - 管线化处理：提取 system → 转换角色 → 转换格式 → 合并 → 兜底
 * - 消除特殊情况：通过统一的数据结构减少分支判断
 * - 保持幂等性：多次转换结果一致
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 *
 * @param messages - 输入消息数组
 * @param options - 转换选项
 * @returns Google 格式的转换结果
 */
export function convertForGoogle(
  messages: ExtendedChatMessage[],
  options: GoogleConvertOptions = {},
): GoogleConversionResult {
  const { placeholder = DEFAULT_PLACEHOLDER } = options;

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: 提取前置 system 消息
  // Gemini 要求 system 通过 system_instruction 参数传递
  // ─────────────────────────────────────────────────────────────────────────
  const { systemInstruction, remaining } = extractLeadingSystem(messages);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: 转换角色
  // system → user, assistant → model
  // ─────────────────────────────────────────────────────────────────────────
  let result = convertRoles(remaining);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: 转换为 Google parts 格式
  // ─────────────────────────────────────────────────────────────────────────
  let googleMessages = convertToGoogleFormat(result);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: 合并连续同角色消息
  // Gemini 要求 user/model 严格交替
  // ─────────────────────────────────────────────────────────────────────────
  googleMessages = mergeConsecutiveSameRole(googleMessages);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5: 空消息兜底
  // 确保至少有一条消息，避免 API 请求失败
  // ─────────────────────────────────────────────────────────────────────────
  if (googleMessages.length === 0) {
    googleMessages = [{ role: "user", parts: [{ text: placeholder }] }];
  }

  return {
    contents: googleMessages,
    systemInstruction,
  };
}

/**
 * Google 转换选项
 */
export interface GoogleConvertOptions {
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
 * - 合并所有 system 内容为单个 system_instruction
 *
 * Requirements: 8.1
 */
function extractLeadingSystem(messages: ExtendedChatMessage[]): {
  systemInstruction: GoogleSystemInstruction | null;
  remaining: ExtendedChatMessage[];
} {
  const systemParts: GooglePart[] = [];
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
      systemParts.push({ text });
    }
    firstNonSystemIndex = i + 1;
  }

  return {
    systemInstruction: systemParts.length > 0 ? { parts: systemParts } : null,
    remaining: messages.slice(firstNonSystemIndex),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   子函数：转换角色
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 转换消息角色
 *
 * - system → user (Requirements: 8.2)
 * - assistant → model (Requirements: 8.3)
 * - tool → user (降级处理)
 */
function convertRoles(
  messages: ExtendedChatMessage[],
): Array<{ role: "user" | "model"; content: string | ContentPart[] }> {
  return messages.map((msg) => {
    let role: "user" | "model";

    if (msg.role === "assistant") {
      role = "model";
    } else {
      // system, user, tool 都转为 user
      role = "user";
    }

    return { role, content: msg.content };
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   子函数：转换为 Google 格式
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 转换为 Google parts 格式
 *
 * Requirements: 8.5
 */
function convertToGoogleFormat(
  messages: Array<{ role: "user" | "model"; content: string | ContentPart[] }>,
): GoogleMessage[] {
  return messages.map((msg) => ({
    role: msg.role,
    parts: contentToParts(msg.content),
  }));
}

/**
 * 将 content 转换为 Google parts 数组
 */
function contentToParts(content: string | ContentPart[]): GooglePart[] {
  if (typeof content === "string") {
    return content.trim() ? [{ text: content }] : [];
  }

  const parts: GooglePart[] = [];

  for (const part of content) {
    switch (part.type) {
    case "text":
      if (part.text.trim()) {
        parts.push({ text: part.text });
      }
      break;

    case "image_url":
      // 转换 image_url 为 Google 格式
      parts.push(convertImageUrl(part.image_url.url));
      break;

    case "video_url":
      // 视频作为文件数据处理
      parts.push({
        fileData: {
          mimeType: "video/*",
          fileUri: part.video_url.url,
        },
      });
      break;

    case "audio_url":
      // 音频作为文件数据处理
      parts.push({
        fileData: {
          mimeType: "audio/*",
          fileUri: part.audio_url.url,
        },
      });
      break;

      // tool_use 和 tool_result 在 Google 格式中不直接支持
      // 转换为文本描述
    case "tool_use":
      parts.push({
        text: `[Tool Call: ${part.name}(${JSON.stringify(part.input)})]`,
      });
      break;

    case "tool_result":
      parts.push({ text: `[Tool Result: ${part.content}]` });
      break;
    }
  }

  return parts.length > 0 ? parts : [{ text: "" }];
}

/**
 * 转换图片 URL 为 Google 格式
 */
function convertImageUrl(url: string): GooglePart {
  // 检查是否为 base64 数据 URL
  const base64Match = url.match(/^data:([^;]+);base64,(.+)$/);

  if (base64Match) {
    return {
      inlineData: {
        mimeType: base64Match[1],
        data: base64Match[2],
      },
    };
  }

  // 普通 URL 作为文件数据
  return {
    fileData: {
      mimeType: "image/*",
      fileUri: url,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   子函数：合并连续同角色
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 合并连续同角色消息
 *
 * 设计哲学：
 * - Gemini 要求 user/model 严格交替
 * - 通过合并消除连续同角色
 * - 保持内容完整性
 *
 * Requirements: 8.4
 */
function mergeConsecutiveSameRole(messages: GoogleMessage[]): GoogleMessage[] {
  if (messages.length === 0) return [];

  const result: GoogleMessage[] = [];

  for (const msg of messages) {
    const last = result[result.length - 1];

    if (last && last.role === msg.role) {
      // 合并 parts 数组
      last.parts = [...last.parts, ...msg.parts];
    } else {
      result.push({ ...msg, parts: [...msg.parts] });
    }
  }

  return result;
}
