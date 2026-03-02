/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     ContextNode                                            ║
 * ║                                                                            ║
 * ║  上下文中转节点                                                             ║
 * ║                                                                            ║
 * ║  职责（整改后）：                                                           ║
 * ║  - messages[] 原样透传，不做任何修改                                        ║
 * ║  - 不处理字符串级别占位符替换                                               ║
 * ║  - 不负责获取或展开聊天历史（由 HistoryPreNode + STPromptManager 负责）      ║
 * ║                                                                            ║
 * ║  Requirements: 5.1, 5.3                                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { NodeBase } from "@/lib/nodeflow/NodeBase";
import { NodeConfig, NodeInput, NodeOutput, NodeCategory } from "@/lib/nodeflow/types";
import { ContextNodeTools } from "./ContextNodeTools";
import { NodeToolRegistry } from "../NodeTool";

export class ContextNode extends NodeBase {
  static readonly nodeName = "context";
  static readonly description = "Pass-through node for messages[]";
  static readonly version = "3.0.0";

  constructor(config: NodeConfig) {
    NodeToolRegistry.register(ContextNodeTools);
    super(config);
    this.toolClass = ContextNodeTools;
  }

  protected getDefaultCategory(): NodeCategory {
    return NodeCategory.MIDDLE;
  }

  protected async _call(input: NodeInput): Promise<NodeOutput> {
    const inputMessages = input.messages as Array<{ role: string; content: string }> | undefined;

    console.log(
      `[ContextNode] Pass-through messages=${inputMessages?.length ?? 0}`,
    );

    return {
      messages: inputMessages,
    };
  }
}
