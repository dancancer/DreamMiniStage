/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     HistoryPreNode                                         ║
 * ║                                                                            ║
 * ║  历史数据前置提供节点                                                       ║
 * ║  职责：在 PresetNode 之前提供结构化的聊天历史数据                           ║
 * ║                                                                            ║
 * ║  输出：                                                                     ║
 * ║  - chatHistoryMessages: 结构化历史消息数组（用于 chatHistory marker 展开）  ║
 * ║  - conversationContext: 短上下文（用于 memory/RAG 子系统）                  ║
 * ║                                                                            ║
 * ║  Requirements: 2.1, 2.2, 2.4, 2.5                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { NodeBase } from "@/lib/nodeflow/NodeBase";
import { NodeConfig, NodeInput, NodeOutput, NodeCategory } from "@/lib/nodeflow/types";
import { HistoryPreNodeTools, ChatHistoryMessage } from "./HistoryPreNodeTools";
import { NodeToolRegistry } from "../NodeTool";

export class HistoryPreNode extends NodeBase {
  static readonly nodeName = "historyPre";
  static readonly description = "Provides structured chat history data before PresetNode";
  static readonly version = "1.0.0";

  constructor(config: NodeConfig) {
    NodeToolRegistry.register(HistoryPreNodeTools);
    super(config);
    this.toolClass = HistoryPreNodeTools;
  }

  protected getDefaultCategory(): NodeCategory {
    return NodeCategory.MIDDLE;
  }

  protected async _call(input: NodeInput): Promise<NodeOutput> {
    const dialogueKey = input.dialogueKey;
    const characterId = input.characterId;
    const memoryLength = input.memoryLength || 10;
    const userInput = input.userInput;

    // 优先使用 dialogueKey（会话隔离），回退到 characterId
    const historyKey = dialogueKey || characterId;
    if (!historyKey) {
      throw new Error("dialogueKey or characterId is required for HistoryPreNode");
    }

    /* ═══════════════════════════════════════════════════════════════════════
       获取历史数据格式
       Requirements: 2.2, 2.4
       ═══════════════════════════════════════════════════════════════════════ */

    // 1. 结构化历史消息数组（用于 chatHistory marker 展开）
    const chatHistoryMessages = await this.executeTool(
      "getChatHistoryMessages",
      historyKey,
      memoryLength,
    ) as ChatHistoryMessage[];

    // 2. 短上下文（用于 memory/RAG 子系统）
    const conversationContext = await this.executeTool(
      "getConversationContext",
      historyKey,
      3, // 短上下文只需要最近 3 轮
    ) as string;

    console.log(
      `[HistoryPreNode] Prepared history for ${historyKey}: ` +
      `${chatHistoryMessages.length} messages`,
    );

    /* ═══════════════════════════════════════════════════════════════════════
       输出：不修改 userInput，只提供历史数据
       Requirements: 2.5
       ═══════════════════════════════════════════════════════════════════════ */

    return {
      chatHistoryMessages,
      conversationContext,
      // 透传 userInput，不做任何修改
      userInput,
    };
  }
}
