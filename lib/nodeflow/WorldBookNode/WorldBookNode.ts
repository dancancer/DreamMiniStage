/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          WorldBookNode                                     ║
 * ║                                                                            ║
 * ║  世界书注入节点 - 对 messages[] 进行结构化修改                               ║
 * ║                                                                            ║
 * ║  职责（整改后）：                                                           ║
 * ║  - 对 messages[] 进行结构化修改（深度注入/过滤）                             ║
 * ║  - 扫描 messages[] 内容，替换文本占位符                                      ║
 * ║                                                                            ║
 * ║  Requirements: 4.2, 4.3, 4.4                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { NodeBase } from "@/lib/nodeflow/NodeBase";
import { NodeConfig, NodeInput, NodeOutput, NodeCategory } from "@/lib/nodeflow/types";
import { WorldBookNodeTools } from "./WorldBookNodeTools";
import { NodeToolRegistry } from "../NodeTool";
import type { ChatMessage } from "@/lib/core/st-preset-types";

export class WorldBookNode extends NodeBase {
  static readonly nodeName = "worldBook";
  static readonly description = "Modifies messages[] with world book content";
  static readonly version = "2.0.0"; // 版本升级：messages-only 架构

  constructor(config: NodeConfig) {
    NodeToolRegistry.register(WorldBookNodeTools);
    super(config);
    this.toolClass = WorldBookNodeTools;
  }
  
  protected getDefaultCategory(): NodeCategory {
    return NodeCategory.MIDDLE;
  }

  protected async _call(input: NodeInput): Promise<NodeOutput> {
    /* ═══════════════════════════════════════════════════════════════════════
       提取输入参数
       ═══════════════════════════════════════════════════════════════════════ */

    const inputMessages = input.messages as ChatMessage[] | undefined;
    const dialogueKey = input.dialogueKey as string | undefined;
    const characterId = input.characterId as string | undefined;
    const currentUserInput = (input.currentUserInput || "") as string;

    if (!characterId) {
      throw new Error("Character ID is required for WorldBookNode");
    }

    /* ═══════════════════════════════════════════════════════════════════════
       Requirements 4.2, 4.4: 对 messages[] 进行结构化修改
       ═══════════════════════════════════════════════════════════════════════ */

    let outputMessages = inputMessages;

    if (inputMessages && inputMessages.length > 0) {
      // 调用 modifyMessages 进行结构化修改和占位符替换
      outputMessages = await this.executeTool(
        "modifyMessages",
        characterId,
        inputMessages,
        currentUserInput,
        dialogueKey,
      ) as ChatMessage[];
    }

    return {
      messages: outputMessages,
    };
  }
}
