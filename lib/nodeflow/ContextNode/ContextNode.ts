import { NodeBase } from "@/lib/nodeflow/NodeBase";
import { NodeConfig, NodeInput, NodeOutput, NodeCategory } from "@/lib/nodeflow/types";
import { DialogueMessage } from "@/lib/models/character-dialogue-model";
import { ContextNodeTools } from "./ContextNodeTools";
import { NodeToolRegistry } from "../NodeTool";

export class ContextNode extends NodeBase {
  static readonly nodeName = "context";
  static readonly description = "Assembles chat history and system messages";
  static readonly version = "1.0.0";

  constructor(config: NodeConfig) {
    NodeToolRegistry.register(ContextNodeTools);
    super(config);
    this.toolClass = ContextNodeTools;
  }

  protected getDefaultCategory(): NodeCategory {
    return NodeCategory.MIDDLE;
  }

  protected async _call(input: NodeInput): Promise<NodeOutput> {
    const userMessage = input.userMessage;
    const dialogueKey = input.dialogueKey;
    const characterId = input.characterId;
    const userInput = input.userInput;
    const memoryLength = input.memoryLength || 10;

    if (!userMessage) {
      throw new Error("User message is required for ContextNode");
    }

    // 优先使用 dialogueKey（会话隔离），回退到 characterId
    const historyKey = dialogueKey || characterId;
    if (!historyKey) {
      throw new Error("dialogueKey or characterId is required for ContextNode");
    }

    // Assemble chat history for {{chatHistory}} placeholder
    const result = await this.executeTool(
      "assembleChatHistory",
      userMessage,
      historyKey,
      memoryLength,
    ) as { userMessage: string; messages: DialogueMessage[] };

    // Generate conversation context for memory system
    const conversationContext = await this.executeTool(
      "generateConversationContext",
      historyKey,
      userInput || "",
      3, // Use shorter context for memory
    ) as string;

    return {
      userMessage: result.userMessage,
      conversationContext,
    };
  }
} 
