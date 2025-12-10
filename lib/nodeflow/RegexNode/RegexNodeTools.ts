import { NodeTool } from "@/lib/nodeflow/NodeTool";
import { RegexProcessor } from "@/lib/core/regex-processor";

const DEBUG = true;
function log(tag: string, ...args: unknown[]): void {
  if (DEBUG) console.log(`[RegexNodeTools][${tag}]`, ...args);
}

export class RegexNodeTools extends NodeTool {
  protected static readonly toolType: string = "regex";
  protected static readonly version: string = "1.0.0";

  static getToolType(): string {
    return this.toolType;
  }

  static async executeMethod(methodName: string, ...params: any[]): Promise<any> {
    log("EXEC", `调用方法: ${methodName}`);
    const method = (this as any)[methodName];

    if (typeof method !== "function") {
      log("ERROR", `方法不存在: ${methodName}`);
      throw new Error(`Method ${methodName} not found in ${this.getToolType()}Tool`);
    }

    try {
      this.logExecution(methodName, params);
      return await (method as Function).apply(this, params);
    } catch (error) {
      this.handleError(error as Error, methodName);
    }
  }

  static async processRegex(
    response: string,
    characterId: string,
  ): Promise<{ replacedText: string }> {
    log("PROCESS", "━━━ 开始处理 ━━━");
    log("PROCESS", `characterId=${characterId}, 输入长度=${response.length}`);

    try {
      const result = await RegexProcessor.processFullContext(response, {
        ownerId: characterId,
      });

      log("PROCESS", `处理完成，输出长度=${result.replacedText.length}`);
      return { replacedText: result.replacedText };
    } catch (error) {
      log("ERROR", `处理失败: ${error}`);
      this.handleError(error as Error, "processRegex");
      return { replacedText: response };
    }
  }
} 
