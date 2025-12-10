/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     提示词构建工具                                          ║
 * ║                                                                            ║
 * ║  提供提示词数据的构建、格式化、图片提取等功能                                ║
 * ║  设计原则：纯函数、无副作用、可测试                                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { PromptData, PromptImage } from "@/types/prompt-viewer";
import { generateId } from "@/lib/prompt-viewer/constants";
import { useDialogueStore } from "@/lib/store/dialogue-store";
import { PresetNodeTools } from "@/lib/nodeflow/PresetNode/PresetNodeTools";
import { ContextNodeTools } from "@/lib/nodeflow/ContextNode/ContextNodeTools";
import { WorldBookNodeTools } from "@/lib/nodeflow/WorldBookNode/WorldBookNodeTools";

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

/** 从对话数据构建提示词（复用实际工作流节点） */
export async function buildPromptFromDialogue(
  dialogueKey: string,
  characterId: string,
): Promise<PromptData> {
  console.log("[PromptBuilder] 开始构建提示词", { dialogueKey, characterId });

  // 1. 获取对话历史
  const dialogue = useDialogueStore.getState().getDialogue(dialogueKey);
  const messages = dialogue?.messages || [];
  const lastUserMsg = messages.filter(m => m.role === "user").pop();
  const currentUserInput = lastUserMsg?.content || "";

  // 2. PresetNode: 构建基础框架
  const presetResult = await PresetNodeTools.buildPromptFramework(
    characterId, "zh", "用户", undefined, 200, false, "mirror_realm",
  );

  // 3. ContextNode: 处理对话历史
  const contextResult = await ContextNodeTools.assembleChatHistory(
    presetResult.userMessage, dialogueKey, 10,
  );

  // 4. WorldBookNode: 注入世界书
  const worldBookResult = await WorldBookNodeTools.assemblePromptWithWorldBook(
    characterId, presetResult.systemMessage, contextResult.userMessage,
    currentUserInput, "zh", 5, "用户", undefined, dialogueKey,
  );

  const { systemMessage, userMessage } = worldBookResult;
  const fullPrompt = buildFullPromptText(systemMessage, userMessage, messages);

  console.log("[PromptBuilder] 构建完成，长度:", fullPrompt.length);

  return {
    id: generateId("prompt"),
    timestamp: Date.now(),
    systemMessage,
    userMessage,
    fullPrompt,
    images: extractImages(fullPrompt),
    metadata: { characterId, dialogueKey, modelName: "unknown", temperature: 0.7 },
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
      return { ...data, images: [...data.images], metadata: { ...data.metadata } }; 
    },
  };

  return builder;
}
