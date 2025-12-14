import { NodeBase } from "@/lib/nodeflow/NodeBase";
import { NodeConfig, NodeInput, NodeOutput, NodeCategory } from "@/lib/nodeflow/types";
import { NodeToolRegistry } from "../NodeTool";
import { PluginRegistry } from "@/lib/plugins/plugin-registry";
import { MessageContext } from "@/lib/plugins/plugin-types";

export class PluginMessageNode extends NodeBase {
  static readonly nodeName = "pluginMessage";
  static readonly description = "Processes user input through plugin onMessage hooks";
  static readonly version = "1.0.0";

  private pluginRegistry: PluginRegistry;

  constructor(config: NodeConfig) {
    super(config);
    this.pluginRegistry = PluginRegistry.getInstance();
  }
  
  protected getDefaultCategory(): NodeCategory {
    return NodeCategory.MIDDLE;
  }

  protected async _call(input: NodeInput): Promise<NodeOutput> {
    const userInput = input.userInput as string | undefined;
    const characterId = input.characterId as string;

    console.log("🔌 PluginMessageNode: Processing user input", {
      userInputLength: userInput?.length || 0,
      characterId,
      userInputPreview: userInput?.substring(0, 100) + "...",
    });

    if (!userInput) {
      console.warn("⚠️ PluginMessageNode: No user input provided");
      return input;
    }

    try {
      // 初始化插件系统（如果未初始化）
      await this.initializePluginSystem();
      
      // 处理onMessage钩子（用户输入前的处理）
      const processedInput = await this.processMessageHooks(userInput, characterId);
      
      console.log("✅ PluginMessageNode: Processing complete", {
        originalLength: userInput.length,
        processedLength: processedInput.length,
        changed: userInput !== processedInput,
      });

      return {
        ...input,
        userInput: processedInput,
      };
    } catch (error) {
      console.error("❌ PluginMessageNode: Error processing user input:", error);
      return input;
    }
  }

  /**
   * 初始化插件系统
   */
  private async initializePluginSystem(): Promise<void> {
    try {
      console.log("🔌 PluginMessageNode: Initializing plugin system...");
      await this.pluginRegistry.initialize();
      console.log("✅ PluginMessageNode: Plugin system initialized");
    } catch (error) {
      console.error("❌ PluginMessageNode: Failed to initialize plugin system:", error);
    }
  }

  /**
   * 处理onMessage钩子
   */
  private async processMessageHooks(userInput: string, characterId: string): Promise<string> {
    try {
      console.log("🔌 PluginMessageNode: Processing onMessage hooks...");
      
      const messageContext: MessageContext = {
        id: `plugin-message-${Date.now()}`,
        role: "user",
        content: userInput,
        timestamp: new Date(),
        characterId,
        metadata: {
          nodeType: "pluginMessage",
          stage: "input",
        },
      };

      const processedMessage = await this.pluginRegistry.processMessage(messageContext);
      
      console.log("✅ PluginMessageNode: onMessage hooks processed", {
        originalLength: userInput.length,
        processedLength: processedMessage.content.length,
        changed: userInput !== processedMessage.content,
      });

      return processedMessage.content;
    } catch (error) {
      console.error("❌ PluginMessageNode: Error processing onMessage hooks:", error);
      return userInput;
    }
  }
} 
