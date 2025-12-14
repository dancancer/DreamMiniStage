/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     ContextNode                                            ║
 * ║                                                                            ║
 * ║  上下文组装节点 - UI/兼容层                                                 ║
 * ║                                                                            ║
 * ║  职责（整改后）：                                                           ║
 * ║  - 只处理 userMessage 中的 {{chatHistory}} 文本替换（使用 chatHistoryText） ║
 * ║  - messages[] 原样透传，不做任何修改                                        ║
 * ║  - 不再负责获取或展开聊天历史（已迁移到 HistoryPreNode + STPromptManager）  ║
 * ║                                                                            ║
 * ║  Requirements: 5.1, 5.2, 5.3, 5.4                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { NodeBase } from "@/lib/nodeflow/NodeBase";
import { NodeConfig, NodeInput, NodeOutput, NodeCategory } from "@/lib/nodeflow/types";
import { ContextNodeTools } from "./ContextNodeTools";
import { NodeToolRegistry } from "../NodeTool";

export class ContextNode extends NodeBase {
  static readonly nodeName = "context";
  static readonly description = "UI/compatibility layer for userMessage text replacement";
  static readonly version = "2.0.0";

  constructor(config: NodeConfig) {
    NodeToolRegistry.register(ContextNodeTools);
    super(config);
    this.toolClass = ContextNodeTools;
  }

  protected getDefaultCategory(): NodeCategory {
    return NodeCategory.MIDDLE;
  }

  protected async _call(input: NodeInput): Promise<NodeOutput> {
    const userMessage = input.userMessage as string | undefined;
    const chatHistoryText = input.chatHistoryText as string | undefined;
    const inputMessages = input.messages as Array<{ role: string; content: string }> | undefined;

    /* ═══════════════════════════════════════════════════════════════════════
       Requirements 5.1, 5.3: messages[] 原样透传
       ContextNode 不再修改 messages[]，历史展开已由 STPromptManager 完成
       ═══════════════════════════════════════════════════════════════════════ */

    /* ═══════════════════════════════════════════════════════════════════════
       Requirements 5.2, 5.4: userMessage 文本替换（仅用于 UI/legacy 兼容）
       只在 userMessage 字符串中替换 {{chatHistory}} 占位符
       ═══════════════════════════════════════════════════════════════════════ */
    let outputUserMessage = userMessage || "";

    if (outputUserMessage.includes("{{chatHistory}}") && chatHistoryText) {
      outputUserMessage = outputUserMessage.replace("{{chatHistory}}", chatHistoryText);
      console.log(
        `[ContextNode] Replaced {{chatHistory}} in userMessage with ${chatHistoryText.length} chars`,
      );
    }

    console.log(
      `[ContextNode] Pass-through: messages=${inputMessages?.length ?? 0}, ` +
      `userMessage=${outputUserMessage.length} chars`,
    );

    return {
      userMessage: outputUserMessage,
      messages: inputMessages,
    };
  }
}
