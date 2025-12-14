/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Preset 兼容性检测与转换                                  ║
 * ║                                                                            ║
 * ║  职责：                                                                     ║
 * ║  1. 检测旧版 preset 格式                                                    ║
 * ║  2. 自动应用兼容层转换                                                       ║
 * ║                                                                            ║
 * ║  Requirements: 7.1, 7.4                                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { STOpenAIPreset, STPrompt, ChatMessage } from "../st-preset-types";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

/** 兼容性检测结果 */
export interface CompatibilityCheckResult {
  /** 是否为旧版 preset */
  isLegacy: boolean;
  /** 检测到的问题列表 */
  issues: LegacyIssue[];
  /** 是否缺少 chatHistory marker */
  missingChatHistoryMarker: boolean;
  /** 是否使用文本占位符而非 marker */
  usesTextPlaceholders: boolean;
}

/** 旧版 preset 问题类型 */
export interface LegacyIssue {
  type: "missing_marker" | "text_placeholder" | "deprecated_field";
  identifier?: string;
  description: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   常量定义
   ═══════════════════════════════════════════════════════════════════════════ */

/** 标准 marker 标识符 */
const STANDARD_MARKERS = new Set([
  "chatHistory",
  "worldInfoBefore",
  "worldInfoAfter",
  "charDescription",
  "charPersonality",
  "scenario",
  "personaDescription",
  "dialogueExamples",
]);

/** 文本占位符模式（旧版 preset 可能使用） */
const TEXT_PLACEHOLDER_PATTERNS = [
  /\{\{chatHistory\}\}/,
  /\{\{worldInfoBefore\}\}/,
  /\{\{worldInfoAfter\}\}/,
  /\{\{wiBefore\}\}/,
  /\{\{wiAfter\}\}/,
];

/* ═══════════════════════════════════════════════════════════════════════════
   核心检测函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 检测 preset 是否为旧版格式
 *
 * 旧版 preset 特征：
 * 1. 缺少 chatHistory marker
 * 2. 在 prompt content 中使用 {{chatHistory}} 文本占位符
 * 3. 使用已废弃的字段
 *
 * Requirements: 7.4
 */
export function isLegacyPreset(preset: STOpenAIPreset): boolean {
  const result = checkPresetCompatibility(preset);
  return result.isLegacy;
}

/**
 * 详细检测 preset 兼容性
 *
 * Requirements: 7.1, 7.4
 */
export function checkPresetCompatibility(preset: STOpenAIPreset): CompatibilityCheckResult {
  const issues: LegacyIssue[] = [];
  let missingChatHistoryMarker = true;
  let usesTextPlaceholders = false;

  /* ─────────────────────────────────────────────────────────────────────────
     检查 chatHistory marker 是否存在
     ───────────────────────────────────────────────────────────────────────── */

  const chatHistoryPrompt = preset.prompts.find(
    (p) => p.identifier === "chatHistory" && p.marker === true,
  );

  if (chatHistoryPrompt) {
    missingChatHistoryMarker = false;
  } else {
    issues.push({
      type: "missing_marker",
      identifier: "chatHistory",
      description: "缺少 chatHistory marker，历史消息可能无法正确插入",
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     检查是否在 content 中使用文本占位符
     ───────────────────────────────────────────────────────────────────────── */

  for (const prompt of preset.prompts) {
    if (!prompt.content) continue;

    for (const pattern of TEXT_PLACEHOLDER_PATTERNS) {
      if (pattern.test(prompt.content)) {
        usesTextPlaceholders = true;
        issues.push({
          type: "text_placeholder",
          identifier: prompt.identifier,
          description: `在 ${prompt.identifier} 中使用了文本占位符 ${pattern.source}`,
        });
      }
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     判定是否为旧版 preset
     ───────────────────────────────────────────────────────────────────────── */

  const isLegacy = missingChatHistoryMarker || usesTextPlaceholders;

  return {
    isLegacy,
    issues,
    missingChatHistoryMarker,
    usesTextPlaceholders,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   兼容层转换函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 应用兼容层转换
 *
 * 转换策略：
 * 1. 若缺少 chatHistory marker，自动添加
 * 2. 若使用文本占位符，保留原样（由 messages[] 内容替换处理）
 *
 * Requirements: 7.1, 7.4
 *
 * @param preset - 原始 preset
 * @returns 转换后的 preset（不修改原对象）
 */
export function applyCompatibilityLayer(preset: STOpenAIPreset): STOpenAIPreset {
  const result = checkPresetCompatibility(preset);

  if (!result.isLegacy) {
    return preset;
  }

  // 深拷贝，避免修改原对象
  const transformed: STOpenAIPreset = JSON.parse(JSON.stringify(preset));

  /* ─────────────────────────────────────────────────────────────────────────
     处理缺少 chatHistory marker 的情况
     ───────────────────────────────────────────────────────────────────────── */

  if (result.missingChatHistoryMarker) {
    // 查找合适的插入位置（在 jailbreak 之前，或末尾）
    const jailbreakIndex = transformed.prompts.findIndex(
      (p) => p.identifier === "jailbreak",
    );

    const chatHistoryMarker: STPrompt = {
      identifier: "chatHistory",
      name: "Chat History",
      system_prompt: true,
      marker: true,
    };

    if (jailbreakIndex >= 0) {
      transformed.prompts.splice(jailbreakIndex, 0, chatHistoryMarker);
    } else {
      transformed.prompts.push(chatHistoryMarker);
    }

    // 更新 prompt_order
    for (const order of transformed.prompt_order) {
      const jailbreakOrderIndex = order.order.findIndex(
        (o) => o.identifier === "jailbreak",
      );

      const chatHistoryOrder = { identifier: "chatHistory", enabled: true };

      if (jailbreakOrderIndex >= 0) {
        order.order.splice(jailbreakOrderIndex, 0, chatHistoryOrder);
      } else {
        order.order.push(chatHistoryOrder);
      }
    }

    console.log("[Compatibility] 已添加 chatHistory marker");
  }

  return transformed;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Messages 内容占位符替换
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 在 messages[] 内容中替换文本占位符
 *
 * 用于处理旧版 preset 中使用 {{chatHistory}} 等文本占位符的情况
 *
 * Requirements: 7.1
 *
 * @param messages - 消息数组
 * @param replacements - 占位符替换映射
 * @returns 替换后的消息数组（不修改原数组）
 */
export function replaceTextPlaceholdersInMessages(
  messages: ChatMessage[],
  replacements: Record<string, string>,
): ChatMessage[] {
  return messages.map((msg) => {
    let content = msg.content;

    for (const [placeholder, value] of Object.entries(replacements)) {
      // 支持 {{placeholder}} 格式
      const pattern = new RegExp(`\\{\\{${placeholder}\\}\\}`, "g");
      content = content.replace(pattern, value);
    }

    if (content === msg.content) {
      return msg;
    }

    return { ...msg, content };
  });
}

/**
 * 检查 messages[] 中是否包含未替换的占位符
 *
 * @param messages - 消息数组
 * @returns 未替换的占位符列表
 */
export function findUnreplacedPlaceholders(messages: ChatMessage[]): string[] {
  const unreplaced: string[] = [];
  const placeholderPattern = /\{\{(\w+)\}\}/g;

  for (const msg of messages) {
    let match;
    while ((match = placeholderPattern.exec(msg.content)) !== null) {
      const placeholder = match[1];
      if (!unreplaced.includes(placeholder)) {
        unreplaced.push(placeholder);
      }
    }
  }

  return unreplaced;
}
