/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     HistoryPreNodeTools                                    ║
 * ║                                                                            ║
 * ║  历史数据前置提供节点的工具类                                               ║
 * ║  职责：在 PresetNode 之前提供结构化的聊天历史数据                           ║
 * ║                                                                            ║
 * ║  Requirements: 2.2, 2.3, 2.4, 2.5                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { NodeTool } from "@/lib/nodeflow/NodeTool";
import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { DialogueStory } from "@/lib/core/character-history";

/** 聊天消息类型 */
export interface ChatHistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export class HistoryPreNodeTools extends NodeTool {
  protected static readonly toolType: string = "historyPre";
  protected static readonly version: string = "1.0.0";

  static getToolType(): string {
    return this.toolType;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     动态方法执行器

     this as Record<string, unknown>：
     - 类的静态成员在运行时是一个对象
     - 使用 Record 索引签名安全地访问动态方法名
     设计理念：消除 any，使用精确的索引类型表达动态访问
     ═══════════════════════════════════════════════════════════════════════════ */
  static async executeMethod(methodName: string, ...params: unknown[]): Promise<unknown> {
    const method = (this as unknown as Record<string, unknown>)[methodName];

    if (typeof method !== "function") {
      console.error(`Method lookup failed: ${methodName} not found in HistoryPreNodeTools`);
      throw new Error(`Method ${methodName} not found in ${this.getToolType()}Tool`);
    }

    try {
      this.logExecution(methodName, params);
      return await (method as (...args: unknown[]) => Promise<unknown>).apply(this, params);
    } catch (error) {
      this.handleError(error as Error, methodName);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     getChatHistoryMessages - 获取结构化历史消息数组
     Requirements: 2.2
     ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * 获取聊天历史消息数组（SillyTavern 风格）
   * 返回独立的 user/assistant 消息数组，用于在 chatHistory marker 位置展开插入
   *
   * 关键：不包含当前用户输入，当前输入由 PresetNode 在展开时追加
   *
   * @param dialogueKey - 对话标识符（优先）或角色 ID
   * @param memoryLength - 保留的最近对话轮数
   * @returns 结构化的历史消息数组
   */
  static async getChatHistoryMessages(
    dialogueKey: string,
    memoryLength: number = 10,
  ): Promise<ChatHistoryMessage[]> {
    try {
      const dialogueTree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueKey);
      if (!dialogueTree) {
        console.warn(`[HistoryPreNodeTools] Dialogue tree not found: ${dialogueKey}`);
        return [];
      }

      const nodePath = dialogueTree.current_nodeId !== "root"
        ? await LocalCharacterDialogueOperations.getDialoguePathToNode(
          dialogueKey,
          dialogueTree.current_nodeId,
        )
        : [];

      const messages: ChatHistoryMessage[] = [];

      for (const node of nodePath) {
        // 第一条 assistant 消息是开场白
        if (node.parentNodeId === "root" && node.assistantResponse) {
          messages.push({
            role: "assistant",
            content: node.assistantResponse,
          });
          continue;
        }

        if (node.userInput) {
          messages.push({ role: "user", content: node.userInput });
        }

        if (node.assistantResponse) {
          messages.push({ role: "assistant", content: node.assistantResponse });
        }
      }

      // 只保留最近的消息（memoryLength 轮 = memoryLength * 2 条消息）
      const recentMessages = messages.slice(-memoryLength * 2);
      console.log(
        `[HistoryPreNodeTools] Got ${recentMessages.length} chat history messages for ${dialogueKey}`,
      );

      return recentMessages;
    } catch (error) {
      this.handleError(error as Error, "getChatHistoryMessages");
      return [];
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     getChatHistoryText - 获取压缩历史文本
     Requirements: 2.3
     ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * 获取压缩的聊天历史文本（用于 UI 展示和兼容层）
   *
   * @param dialogueKey - 对话标识符
   * @param memoryLength - 保留的最近对话轮数
   * @returns 格式化的历史文本字符串
   */
  static async getChatHistoryText(
    dialogueKey: string,
    memoryLength: number = 10,
  ): Promise<string> {
    try {
      const historyData = await this.loadHistoryData(dialogueKey);
      return this.formatHistoryText(historyData, memoryLength);
    } catch (error) {
      this.handleError(error as Error, "getChatHistoryText");
      return "";
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     getConversationContext - 获取短上下文
     Requirements: 2.4
     ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * 生成对话上下文（用于 memory/RAG 子系统）
   * 提供简短的最近对话摘要，不包含当前用户输入
   *
   * @param dialogueKey - 对话标识符
   * @param contextLength - 上下文轮数（默认 3 轮）
   * @returns 简短的对话上下文字符串
   */
  static async getConversationContext(
    dialogueKey: string,
    contextLength: number = 3,
  ): Promise<string> {
    try {
      const historyData = await this.loadHistoryData(dialogueKey);
      const { recentDialogue } = historyData;

      // 使用 DialogueStory.getStory 获取最近对话
      const startIdx = Math.max(0, recentDialogue.userInput.length - contextLength);
      return recentDialogue.getStory(startIdx);
    } catch (error) {
      this.handleError(error as Error, "getConversationContext");
      return "";
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     内部辅助方法
     ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * 加载角色历史数据（从 ContextNodeTools 迁移）
   */
  private static async loadHistoryData(dialogueKey: string): Promise<{
    systemMessage: string;
    recentDialogue: DialogueStory;
    historyDialogue: DialogueStory;
  }> {
    const recentDialogue = new DialogueStory("en");
    const historyDialogue = new DialogueStory("en");
    let systemMessage = "";

    const dialogueTree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueKey);
    if (!dialogueTree) {
      console.warn(`[HistoryPreNodeTools] Dialogue tree not found: ${dialogueKey}`);
      return { systemMessage, recentDialogue, historyDialogue };
    }

    const nodePath = dialogueTree.current_nodeId !== "root"
      ? await LocalCharacterDialogueOperations.getDialoguePathToNode(
        dialogueKey,
        dialogueTree.current_nodeId,
      )
      : [];

    for (const node of nodePath) {
      // 第一条 assistant 消息是开场白
      if (node.parentNodeId === "root" && node.assistantResponse) {
        systemMessage = node.assistantResponse;
        continue;
      }

      if (node.userInput) {
        recentDialogue.userInput.push(node.userInput);
        historyDialogue.userInput.push(node.userInput);
      }

      if (node.assistantResponse) {
        recentDialogue.responses.push(node.assistantResponse);
        const compressedContent = node.parsedContent?.compressedContent || "";
        historyDialogue.responses.push(compressedContent);
      }
    }

    return { systemMessage, recentDialogue, historyDialogue };
  }

  /**
   * 格式化历史文本（用于 UI 展示）
   */
  private static formatHistoryText(
    historyData: {
      systemMessage: string;
      recentDialogue: DialogueStory;
      historyDialogue: DialogueStory;
    },
    memoryLength: number,
  ): string {
    const parts: string[] = [];

    if (historyData.systemMessage) {
      parts.push(`开场白：${historyData.systemMessage}`);
    }

    // 压缩历史（早期对话）
    const compressedHistory = historyData.historyDialogue.getStory(
      0,
      Math.max(0, historyData.historyDialogue.responses.length - memoryLength),
    );
    if (compressedHistory) {
      parts.push(`历史信息：${compressedHistory}`);
    }

    // 最近对话
    const recentHistory = historyData.recentDialogue.getStory(
      Math.max(0, historyData.recentDialogue.userInput.length - memoryLength),
    );
    if (recentHistory) {
      parts.push(`最近故事：${recentHistory}`);
    }

    return parts.filter(Boolean).join("\n\n");
  }
}
