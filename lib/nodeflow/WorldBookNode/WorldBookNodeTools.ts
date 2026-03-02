/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       WorldBookNodeTools                                   ║
 * ║                                                                            ║
 * ║  世界书节点工具类 - 提供 messages[] 结构化修改能力                           ║
 * ║                                                                            ║
 * ║  核心方法：                                                                 ║
 * ║  - modifyMessages: 对 messages[] 进行结构化修改                             ║
 * ║  - replacePlaceholdersInMessages: 扫描并替换占位符                          ║
 * ║                                                                            ║
 * ║  Requirements: 4.2, 4.4                                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { NodeTool } from "@/lib/nodeflow/NodeTool";
import { Character } from "@/lib/core/character";
import { loadWorldBookContent } from "@/lib/core/world-book-loader";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import type { ChatMessage } from "@/lib/core/st-preset-types";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

/** 世界书占位符映射 */
interface WorldBookPlaceholders {
  wiBefore: string;
  wiAfter: string;
}

/** 支持的占位符列表 */
const WORLD_BOOK_PLACEHOLDERS = [
  "{{worldInfoBefore}}",
  "{{worldInfoAfter}}",
  "{{wiBefore}}",
  "{{wiAfter}}",
] as const;

/* ═══════════════════════════════════════════════════════════════════════════
   WorldBookNodeTools 类
   ═══════════════════════════════════════════════════════════════════════════ */

export class WorldBookNodeTools extends NodeTool {
  protected static readonly toolType: string = "worldBook";
  protected static readonly version: string = "2.0.0";

  static getToolType(): string {
    return this.toolType;
  }

  static async executeMethod(methodName: string, ...params: unknown[]): Promise<unknown> {
     
    const classObj = this as unknown as Record<string, unknown>;
    const method = classObj[methodName];
    
    if (typeof method !== "function") {
      console.error(`Method lookup failed: ${methodName} not found in WorldBookNodeTools`);
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
     核心方法：modifyMessages
     Requirements: 4.2 - 对 messages[] 进行结构化修改
     ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * 对 messages[] 进行结构化修改
   * 
   * 1. 加载世界书内容
   * 2. 扫描并替换 messages[] 中的占位符
   * 
   * @param characterId - 角色 ID
   * @param messages - 输入消息数组
   * @param currentUserInput - 当前用户输入
   * @param dialogueKey - 对话 key（用于会话隔离）
   * @returns 修改后的消息数组
   */
  static async modifyMessages(
    characterId: string,
    messages: ChatMessage[],
    currentUserInput: string,
    dialogueKey?: string,
  ): Promise<ChatMessage[]> {
    try {
      // 加载角色和世界书内容
      const placeholders = await this.loadWorldBookPlaceholders(
        characterId,
        dialogueKey || characterId,
        currentUserInput,
      );

      // 如果没有世界书内容，直接返回原数组
      if (!placeholders.wiBefore && !placeholders.wiAfter) {
        return messages;
      }

      // 扫描并替换占位符
      return this.replacePlaceholdersInMessages(messages, placeholders);
    } catch (error) {
      console.error("[WorldBookNodeTools] modifyMessages error:", error);
      return messages;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     核心方法：replacePlaceholdersInMessages
     Requirements: 4.4 - 扫描 messages[] 内容替换占位符
     ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * 扫描 messages[] 并替换世界书占位符
   * 
   * 支持的占位符：
   * - {{worldInfoBefore}} / {{wiBefore}}
   * - {{worldInfoAfter}} / {{wiAfter}}
   * 
   * @param messages - 输入消息数组
   * @param placeholders - 占位符内容映射
   * @returns 替换后的消息数组（新数组，不修改原数组）
   */
  static replacePlaceholdersInMessages(
    messages: ChatMessage[],
    placeholders: WorldBookPlaceholders,
  ): ChatMessage[] {
    // 检查是否有任何消息包含占位符
    const hasPlaceholders = messages.some(msg => 
      this.containsWorldBookPlaceholder(msg.content),
    );

    if (!hasPlaceholders) {
      return messages;
    }

    // 创建新数组，替换占位符
    return messages.map(msg => {
      if (!this.containsWorldBookPlaceholder(msg.content)) {
        return msg;
      }

      let newContent = msg.content;

      // 替换 wiBefore 占位符
      newContent = newContent
        .replace(/\{\{worldInfoBefore\}\}/g, placeholders.wiBefore)
        .replace(/\{\{wiBefore\}\}/g, placeholders.wiBefore);

      // 替换 wiAfter 占位符
      newContent = newContent
        .replace(/\{\{worldInfoAfter\}\}/g, placeholders.wiAfter)
        .replace(/\{\{wiAfter\}\}/g, placeholders.wiAfter);

      // 只有内容变化时才创建新对象
      if (newContent === msg.content) {
        return msg;
      }

      return { ...msg, content: newContent };
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     辅助方法
     ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * 检查字符串是否包含世界书占位符
   */
  static containsWorldBookPlaceholder(content: string): boolean {
    return WORLD_BOOK_PLACEHOLDERS.some(p => content.includes(p));
  }

  /**
   * 加载世界书占位符内容
   */
  private static async loadWorldBookPlaceholders(
    characterId: string,
    dialogueKey: string,
    currentUserInput: string,
  ): Promise<WorldBookPlaceholders> {
    try {
      const characterRecord = await LocalCharacterRecordOperations.getCharacterById(characterId);
      if (!characterRecord) {
        return { wiBefore: "", wiAfter: "" };
      }

      const character = new Character(characterRecord);
      return await loadWorldBookContent(character, dialogueKey, currentUserInput);
    } catch (error) {
      console.error("[WorldBookNodeTools] loadWorldBookPlaceholders error:", error);
      return { wiBefore: "", wiAfter: "" };
    }
  }
}
