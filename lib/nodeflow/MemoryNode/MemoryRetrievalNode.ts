import { NodeBase } from "@/lib/nodeflow/NodeBase";
import { NodeConfig, NodeInput, NodeOutput, NodeCategory } from "@/lib/nodeflow/types";
import { MemoryNodeTools } from "./MemoryNodeTools";
import { NodeToolRegistry } from "../NodeTool";

export class MemoryRetrievalNode extends NodeBase {
  static readonly nodeName = "memoryRetrieval";
  static readonly description = "Retrieve relevant memories for current conversation context";
  static readonly version = "1.0.0";

  constructor(config: NodeConfig) {
    NodeToolRegistry.register(MemoryNodeTools);
    super(config);
    this.toolClass = MemoryNodeTools;
  }

  protected getDefaultCategory(): NodeCategory {
    return NodeCategory.MIDDLE;
  }

  protected async _call(input: NodeInput): Promise<NodeOutput> {
    const characterId = input.characterId;
    const userInput = input.userInput || "";
    const messages = input.messages as Array<{ role: string; content: string }> | undefined;
    const apiKey = input.apiKey;
    const baseUrl = input.baseUrl;
    const language = input.language || "zh";
    const maxMemories = input.maxMemories || 5;

    if (!characterId) {
      throw new Error("Character ID is required for MemoryRetrievalNode");
    }

    if (!apiKey) {
      throw new Error("API key is required for MemoryRetrievalNode");
    }

    if (!messages || messages.length === 0) {
      throw new Error("messages[] is required for MemoryRetrievalNode");
    }

    // Use the memory tool to retrieve memories and inject into messages[]
    const result = await this.executeTool(
      "retrieveAndInjectMemories",
      characterId,
      userInput,
      messages,
      apiKey,
      baseUrl,
      language,
      maxMemories,
    ) as {
      messages: Array<{ role: string; content: string }>;
      memoryPrompt: string;
      retrievedMemories: unknown[];
      memoryCount: number;
    };

    return {
      messages: result.messages,
      memoryPrompt: result.memoryPrompt,
      retrievedMemories: result.retrievedMemories,
      memoryCount: result.memoryCount,
      characterId,
      userInput,
      language,
      username: input.username,
    };
  }
} 
 
