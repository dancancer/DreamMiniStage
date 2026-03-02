/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     ContextNodeTools                                       ║
 * ║                                                                            ║
 * ║  上下文节点工具类 - 透传辅助                                                ║
 * ║                                                                            ║
 * ║  职责（整改后）：                                                           ║
 * ║  - 仅保留通用 NodeTool 调度能力                                             ║
 * ║                                                                            ║
 * ║  Requirements: 5.1, 5.3                                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { NodeTool } from "@/lib/nodeflow/NodeTool";

export class ContextNodeTools extends NodeTool {
  protected static readonly toolType: string = "context";
  protected static readonly version: string = "3.0.0";

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

}
