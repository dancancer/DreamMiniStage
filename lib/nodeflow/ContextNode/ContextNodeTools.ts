/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     ContextNodeTools                                       ║
 * ║                                                                            ║
 * ║  上下文节点工具类 - UI/兼容层                                               ║
 * ║                                                                            ║
 * ║  职责（整改后）：                                                           ║
 * ║  - 提供 userMessage 中 {{chatHistory}} 文本替换的辅助方法                   ║
 * ║  - 历史数据获取已迁移到 HistoryPreNodeTools                                 ║
 * ║                                                                            ║
 * ║  Requirements: 5.1, 5.2, 5.3, 5.4                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { NodeTool } from "@/lib/nodeflow/NodeTool";

export class ContextNodeTools extends NodeTool {
  protected static readonly toolType: string = "context";
  protected static readonly version: string = "2.0.0";

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
      console.error(`Method lookup failed: ${methodName} not found in ContextNodeTools`);
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
     replaceHistoryPlaceholder - userMessage 文本替换
     Requirements: 5.2, 5.4
     ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * 在 userMessage 中替换 {{chatHistory}} 占位符
   * 仅用于 UI 展示和 legacy preset 兼容
   *
   * @param userMessage - 原始 userMessage 字符串
   * @param chatHistoryText - 压缩的历史文本（来自 HistoryPreNode）
   * @returns 替换后的 userMessage
   */
  static replaceHistoryPlaceholder(
    userMessage: string,
    chatHistoryText: string,
  ): string {
    if (!userMessage.includes("{{chatHistory}}")) {
      return userMessage;
    }
    return userMessage.replace("{{chatHistory}}", chatHistoryText);
  }
}
