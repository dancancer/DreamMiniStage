/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║          Instruction Mode 应用逻辑                                       ║
 * ║                                                                          ║
 * ║  将 messages[] 按模板格式包裹，用于不自动应用 chat template 的推理后端      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { InstructTemplate } from "./templates";

type ChatMessage = { role: string; content: string; name?: string };

/* ═══════════════════════════════════════════════════════════════════════════
   核心：将单条消息用模板标记包裹
   ═══════════════════════════════════════════════════════════════════════════ */

function wrapMessage(
  msg: ChatMessage,
  template: InstructTemplate,
  isLast: boolean,
): string {
  const content = msg.content || "";

  switch (msg.role) {
  case "system":
    return `${template.systemPrefix}${content}${template.systemSuffix}`;

  case "user":
    return `${template.userPrefix}${content}${template.userSuffix}`;

  case "assistant":
    if (isLast) {
      // 最后一条助手消息不加后缀（待续写）
      return `${template.assistantPrefix}${content}`;
    }
    return `${template.assistantPrefix}${content}${template.assistantSuffix}`;

  default:
    // 未知角色当作 user 处理
    return `${template.userPrefix}${content}${template.userSuffix}`;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   formatMessagesWithTemplate - 将 messages 数组格式化为带模板标记的文本

   用途：发送到不支持 chat format 的推理后端（如原始 completion API）
   ═══════════════════════════════════════════════════════════════════════════ */

export function formatMessagesAsPrompt(
  messages: ChatMessage[],
  template: InstructTemplate,
): string {
  const parts: string[] = [];

  if (template.wrapWithBos) {
    parts.push(template.wrapWithBos);
  }

  for (let i = 0; i < messages.length; i++) {
    parts.push(wrapMessage(messages[i], template, false));
  }

  // 添加最终输出前缀，引导模型开始生成
  parts.push(template.lastOutputPrefix);

  return parts.join("");
}

/* ═══════════════════════════════════════════════════════════════════════════
   applyTemplateToMessages - 为 chat completions API 包裹每条消息

   保留 messages[] 结构但在 content 中嵌入模板标记，
   适用于支持 messages 但不自动应用 chat template 的后端
   ═══════════════════════════════════════════════════════════════════════════ */

export function applyTemplateToMessages(
  messages: ChatMessage[],
  template: InstructTemplate,
): ChatMessage[] {
  // 合并连续的同角色消息为单条，避免模板标记碎片化
  const merged = mergeConsecutiveSameRole(messages);

  // 将系统消息合并到第一条，其余消息交替排列
  const systemMessages: string[] = [];
  const chatMessages: ChatMessage[] = [];

  for (const msg of merged) {
    if (msg.role === "system" && chatMessages.length === 0) {
      // 开头的连续 system 消息合并
      systemMessages.push(msg.content);
    } else {
      chatMessages.push(msg);
    }
  }

  const result: ChatMessage[] = [];

  // 系统消息作为第一条
  if (systemMessages.length > 0) {
    const combinedSystem = systemMessages.join("\n\n");
    result.push({
      role: "system",
      content: `${template.systemPrefix}${combinedSystem}${template.systemSuffix}`,
    });
  }

  // 其余消息保持原角色，content 加模板标记
  for (let i = 0; i < chatMessages.length; i++) {
    const msg = chatMessages[i];
    const isLastAssistant = msg.role === "assistant" && i === chatMessages.length - 1;

    if (msg.role === "system") {
      // 中间出现的 system 消息
      result.push({
        role: "system",
        content: `${template.systemPrefix}${msg.content}${template.systemSuffix}`,
      });
    } else if (msg.role === "user") {
      result.push({
        role: "user",
        content: `${template.userPrefix}${msg.content}${template.userSuffix}`,
      });
    } else if (msg.role === "assistant") {
      result.push({
        role: "assistant",
        content: isLastAssistant
          ? `${template.assistantPrefix}${msg.content}`
          : `${template.assistantPrefix}${msg.content}${template.assistantSuffix}`,
      });
    } else {
      result.push(msg);
    }
  }

  return result;
}

/* ═══════════════════════════════════════════════════════════════════════════
   辅助：合并连续同角色消息
   ═══════════════════════════════════════════════════════════════════════════ */

function mergeConsecutiveSameRole(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length === 0) return [];

  const result: ChatMessage[] = [{ ...messages[0] }];

  for (let i = 1; i < messages.length; i++) {
    const prev = result[result.length - 1];
    const curr = messages[i];

    if (curr.role === prev.role) {
      prev.content = `${prev.content}\n\n${curr.content}`;
    } else {
      result.push({ ...curr });
    }
  }

  return result;
}
