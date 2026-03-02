/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          PresetNode                                        ║
 * ║                                                                            ║
 * ║  预设提示词构建节点                                                         ║
 * ║  职责：根据 preset 配置构建 messages[] 数组                                 ║
 * ║                                                                            ║
 * ║  输入：                                                                     ║
 * ║  - chatHistoryMessages: 来自 HistoryPreNode 的结构化历史消息                ║
 * ║  - characterId, language, username 等基础配置                              ║
 * ║                                                                            ║
 * ║  输出：                                                                     ║
 * ║  - messages[]: 最终发送给 LLM 的消息数组                                    ║
 * ║                                                                            ║
 * ║  Requirements: 2.6                                                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { NodeBase } from "@/lib/nodeflow/NodeBase";
import { NodeConfig, NodeInput, NodeOutput, NodeCategory } from "@/lib/nodeflow/types";
import { PresetNodeTools } from "./PresetNodeTools";
import { NodeToolRegistry } from "../NodeTool";
import type { ChatMessage } from "@/lib/core/st-preset-types";

export class PresetNode extends NodeBase {
  static readonly nodeName = "preset";
  static readonly description = "Applies preset prompts to the conversation";
  static readonly version = "1.1.0"; // 版本升级：支持 chatHistoryMessages 输入

  constructor(config: NodeConfig) {
    NodeToolRegistry.register(PresetNodeTools);
    super(config);
    this.toolClass = PresetNodeTools;
  }

  protected getDefaultCategory(): NodeCategory {
    return NodeCategory.MIDDLE;
  }

  protected async _call(input: NodeInput): Promise<NodeOutput> {
    /* ═══════════════════════════════════════════════════════════════════════
       提取输入参数
       ═══════════════════════════════════════════════════════════════════════ */

    const characterId = input.characterId;
    const language = input.language || "zh";
    const username = input.username;
    const charName = input.charName;
    const number = input.number;
    const fastModel = input.fastModel;
    const systemPresetType = input.systemPresetType || "mirror_realm";
    const dialogueKey = input.dialogueKey;
    const currentUserInput = input.currentUserInput;

    // 新增：从 HistoryPreNode 接收结构化历史消息
    // Requirements: 2.6
    const chatHistoryMessages = input.chatHistoryMessages as ChatMessage[] | undefined;

    if (!characterId) {
      throw new Error("Character ID is required for PresetNode");
    }

    /* ═══════════════════════════════════════════════════════════════════════
       调用 buildPromptFramework 构建消息
       ═══════════════════════════════════════════════════════════════════════ */

    const result = await this.executeTool(
      "buildPromptFramework",
      characterId,
      language,
      username,
      charName,
      number,
      fastModel,
      systemPresetType,
      dialogueKey,
      currentUserInput,
      chatHistoryMessages, // 传递历史消息给 Tools
    ) as { messages: ChatMessage[]; presetId?: string };

    return {
      messages: result.messages,
      presetId: result.presetId,
    };
  }
}
 
