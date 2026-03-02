/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     提示词构建工具                                          ║
 * ║                                                                            ║
 * ║  提供提示词数据的构建、格式化、图片提取等功能                                ║
 * ║  使用 STPromptManager 系统构建提示词                                        ║
 * ║                                                                            ║
 * ║  整改后：复用 STPromptManager 的 chatHistory 展开逻辑                       ║
 * ║  移除重复的 expandChatHistoryInMessages 实现                               ║
 * ║  Requirements: 5.1                                                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { PromptData, PromptImage, PromptMessage } from "@/types/prompt-viewer";
import { generateId } from "@/lib/prompt-viewer/constants";
import { useDialogueStore } from "@/lib/store/dialogue-store/index";
import { PresetNodeTools } from "@/lib/nodeflow/PresetNode/PresetNodeTools";
import { WorldBookNodeTools } from "@/lib/nodeflow/WorldBookNode/WorldBookNodeTools";
import { HistoryPreNodeTools } from "@/lib/nodeflow/HistoryPreNode/HistoryPreNodeTools";
import { getCurrentSystemPresetType } from "@/function/preset/download";
import type { ChatMessage } from "@/lib/core/st-preset-types";

/* ═══════════════════════════════════════════════════════════════════════════
   图片提取工具
   ═══════════════════════════════════════════════════════════════════════════ */

/** 从 data URL 中提取 MIME 类型 */
function extractMimeType(dataUrl: string): string | undefined {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match ? match[1] : undefined;
}

/** 从内容中提取所有图片信息 */
export function extractImages(content: string): PromptImage[] {
  const images: PromptImage[] = [];
  
  try {
    // 1. 提取 base64 图片
    const base64Regex = /data:image\/([a-zA-Z]*);base64,([^"'\s]+)/g;
    let match;
    while ((match = base64Regex.exec(content)) !== null) {
      images.push({
        id: generateId("img"),
        url: match[0],
        type: "base64",
        mimeType: `image/${match[1]}`,
      });
    }

    // 2. 提取图片 URL
    const urlRegex = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?[^\s"'<>]*)?/gi;
    while ((match = urlRegex.exec(content)) !== null) {
      images.push({ id: generateId("img"), url: match[0], type: "url" });
    }

    // 3. 提取 Markdown 图片
    const mdRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    while ((match = mdRegex.exec(content)) !== null) {
      const url = match[2];
      if (url.startsWith("data:image/")) {
        images.push({ id: generateId("img"), url, type: "base64", mimeType: extractMimeType(url) });
      } else if (url.startsWith("http")) {
        images.push({ id: generateId("img"), url, type: "url" });
      }
    }

    console.log(`[PromptBuilder] 提取到 ${images.length} 张图片`);
    return images;
  } catch (error) {
    console.error("[PromptBuilder] 提取图片失败:", error);
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   提示词文本格式化
   ═══════════════════════════════════════════════════════════════════════════ */

/** 构建完整的提示词文本（用于展示） */
export function buildFullPromptText(
  systemMessage: string,
  userMessage: string,
  messages: { role: string; content: string }[] = [],
): string {
  const parts: string[] = [];

  if (systemMessage.trim()) {
    parts.push("=== 系统消息 ===", systemMessage.trim(), "");
  }

  if (messages.length > 0) {
    parts.push("=== 对话历史 ===");
    for (const msg of messages.slice(-10)) {
      parts.push(`${msg.role === "user" ? "用户" : "助手"}: ${msg.content}`);
    }
    parts.push("");
  }

  if (userMessage.trim()) {
    parts.push("=== 用户消息模板 ===", userMessage.trim());
  }

  return parts.join("\n");
}

/* ═══════════════════════════════════════════════════════════════════════════
   提示词数据构建
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 从对话数据构建提示词（使用 STPromptManager 系统）
 *
 * 整改后的流程：
 * 1. HistoryPreNode: 获取结构化历史消息
 * 2. PresetNode: 使用 STPromptManager 构建消息数组（内部展开 chatHistory marker）
 * 3. WorldBookNode: 注入世界书内容
 *
 * 不再使用重复的 expandChatHistoryInMessages 实现
 */
export async function buildPromptFromDialogue(
  dialogueKey: string,
  characterId: string,
): Promise<PromptData> {
  console.log("[PromptBuilder] 开始构建提示词", { dialogueKey, characterId });

  // 1. 获取对话历史（用于推断当前输入与展示）
  const dialogue = useDialogueStore.getState().getDialogue(dialogueKey);
  const dialogueMessages = dialogue?.messages || [];
  const lastUserMsg = dialogueMessages.filter(m => m.role === "user").pop();
  const currentUserInput = lastUserMsg?.content || "";

  // 2. 获取当前系统预设类型
  const systemPresetType = getCurrentSystemPresetType();

  /* ═══════════════════════════════════════════════════════════════════════════
     Step 1: HistoryPreNode - 获取结构化历史消息
     复用 HistoryPreNodeTools，不再使用 ContextNodeTools
     Requirements: 2.2
     ═══════════════════════════════════════════════════════════════════════════ */
  const chatHistoryMessages = await HistoryPreNodeTools.getChatHistoryMessages(
    dialogueKey,
    10,
  );

  /* ═══════════════════════════════════════════════════════════════════════════
     Step 2: PresetNode - 使用 STPromptManager 构建消息数组
     传入 chatHistoryMessages，让 STPromptManager 内部展开 chatHistory marker
     Requirements: 2.6, 3.1
     ═══════════════════════════════════════════════════════════════════════════ */
  const presetResult = await PresetNodeTools.buildPromptFramework(
    characterId,
    "zh",
    "用户",
    undefined,
    200,
    false,
    systemPresetType,
    dialogueKey,
    currentUserInput,
    chatHistoryMessages,  // 传入历史消息，让 STPromptManager 展开
  );

  /* ═══════════════════════════════════════════════════════════════════════════
     Step 3: WorldBookNode - 注入世界书内容
     Requirements: 4.1
     ═══════════════════════════════════════════════════════════════════════════ */
  const baseMessages: ChatMessage[] = presetResult.messages || [];

  const worldBookMessages = baseMessages.length > 0
    ? await WorldBookNodeTools.modifyMessages(
      characterId,
      baseMessages,
      currentUserInput,
      dialogueKey,
    )
    : baseMessages;

  const systemMessage = worldBookMessages
    .filter(m => m.role === "system")
    .map(m => m.content)
    .join("\n\n");

  const lastUserMessage = [...worldBookMessages].reverse().find(m => m.role === "user")?.content;
  const userMessage = lastUserMessage || currentUserInput;

  const fullPrompt = buildFullPromptText(systemMessage, userMessage, dialogueMessages);

  /* ═══════════════════════════════════════════════════════════════════════════
     Step 4: 构建最终消息数组
     使用注入世界书后的 worldBookMessages
     若无则仅回退当前用户输入，避免再引入字符串兼容层
     Requirements: 1.1
     ═══════════════════════════════════════════════════════════════════════════ */
  const llmMessages = worldBookMessages.length > 0
    ? worldBookMessages.map(m => ({ role: m.role, content: m.content }))
    : currentUserInput
      ? [{ role: "user", content: currentUserInput }]
      : [];

  const promptMessages: PromptMessage[] = llmMessages.map(msg => ({
    id: generateId("msg"),
    role: msg.role as "system" | "user" | "assistant",
    content: msg.content,
  }));

  console.log(
    "[PromptBuilder] 构建完成，长度:",
    fullPrompt.length,
    "消息数:",
    promptMessages.length,
    "预设ID:",
    presetResult.presetId,
  );

  return {
    id: generateId("prompt"),
    timestamp: Date.now(),
    systemMessage,
    userMessage,
    fullPrompt,
    images: extractImages(fullPrompt),
    metadata: { characterId, dialogueKey, modelName: "unknown", temperature: 0.7 },
    messages: promptMessages,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   提示词数据构建器（Builder 模式）
   ═══════════════════════════════════════════════════════════════════════════ */

export function createPromptDataBuilder() {
  const data = {
    id: generateId("prompt"),
    timestamp: Date.now(),
    systemMessage: "",
    userMessage: "",
    fullPrompt: "",
    images: [] as PromptImage[],
    metadata: { characterId: "", dialogueKey: "", modelName: "" } as PromptData["metadata"],
    messages: [] as PromptData["messages"],
  };

  const builder = {
    setSystemMessage(msg: string) { data.systemMessage = msg; return builder; },
    setUserMessage(msg: string) { data.userMessage = msg; return builder; },
    setFullPrompt(prompt: string) { data.fullPrompt = prompt; return builder; },
    addImage(img: PromptImage) { data.images.push(img); return builder; },
    setMetadata(meta: Partial<PromptData["metadata"]>) { 
      Object.assign(data.metadata, meta); return builder; 
    },
    build(): PromptData { 
      // 如果没有手动设置 messages，从 systemMessage 和 userMessage 构建
      const messages = data.messages.length > 0 ? [...data.messages] : [
        { id: generateId("msg"), role: "system" as const, content: data.systemMessage },
        { id: generateId("msg"), role: "user" as const, content: data.userMessage },
      ];
      return { ...data, images: [...data.images], metadata: { ...data.metadata }, messages }; 
    },
  };

  return builder;
}
