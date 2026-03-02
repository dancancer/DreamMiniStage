import { NodeTool } from "@/lib/nodeflow/NodeTool";
import { MemoryManager } from "@/lib/core/memory-manager";
import { MemoryType } from "@/lib/models/memory-model";
import { LocalMemoryOperations } from "@/lib/data/roleplay/memory-operation";

export class MemoryNodeTools extends NodeTool {
  protected static readonly toolType: string = "memory";
  protected static readonly version: string = "1.0.0";

  static getToolType(): string {
    return this.toolType;
  }

  static async executeMethod(methodName: string, ...params: unknown[]): Promise<unknown> {
    const classObj = this as unknown as Record<string, unknown>;
    const method = classObj[methodName];
    
    if (typeof method !== "function") {
      console.error(`Method lookup failed: ${methodName} not found in MemoryNodeTools`);
      console.log("Available methods:", Object.getOwnPropertyNames(this).filter(name => 
        typeof classObj[name] === "function" && !name.startsWith("_"),
      ));
      throw new Error(`Method ${methodName} not found in ${this.getToolType()}Tool`);
    }

    try {
      this.logExecution(methodName, params);
      return await (method as (...args: unknown[]) => Promise<unknown>).apply(this, params);
    } catch (error) {
      this.handleError(error as Error, methodName);
    }
  }

  /**
   * Search memories based on query
   */
  static async searchMemories(
    characterId: string,
    query: string,
    apiKey: string,
    baseUrl?: string,
    topK: number = 5,
    includeTypes?: MemoryType[],
    useSemanticSearch: boolean = true,
  ): Promise<{ success: boolean; results: unknown[]; count: number; error?: string }> {
    try {
      const memoryManager = new MemoryManager(apiKey, baseUrl);

      if (useSemanticSearch) {
        const results = await memoryManager.hybridSearch(characterId, query, {
          topK,
          includeTypes,
          similarityThreshold: 0.6,
        });

        return {
          success: true,
          results: results.map(r => ({
            id: r.entry.id,
            type: r.entry.type,
            content: r.entry.content,
            tags: r.entry.tags,
            importance: r.entry.importance,
            score: r.score,
            reasoning: r.reasoning,
          })),
          count: results.length,
        };
      } else {
        // Use basic text search
        const entries = await LocalMemoryOperations.searchMemoriesByText({
          query,
          characterId,
          types: includeTypes,
          maxResults: topK,
        });

        return {
          success: true,
          results: entries.map(entry => ({
            id: entry.id,
            type: entry.type,
            content: entry.content,
            tags: entry.tags,
            importance: entry.importance,
            score: 1.0, // No similarity score for text search
            reasoning: "Text search match",
          })),
          count: entries.length,
        };
      }
    } catch (error) {
      this.handleError(error as Error, "searchMemories");
      return {
        success: false,
        error: error instanceof Error ? (error as Error).message : "Unknown error",
        results: [],
        count: 0,
      };
    }
  }

  /**
   * Create a new memory entry
   */
  static async createMemory(
    characterId: string,
    type: MemoryType,
    content: string,
    apiKey: string,
    baseUrl?: string,
    tags: string[] = [],
    importance: number = 0.5,
    metadata: Record<string, unknown> = {},
  ): Promise<{ success: boolean; memory?: unknown; error?: string }> {
    try {
      const memoryManager = new MemoryManager(apiKey, baseUrl);
      
      const memoryEntry = await memoryManager.createMemory(
        characterId,
        type,
        content,
        metadata,
        tags,
        importance,
      );

      return {
        success: true,
        memory: {
          id: memoryEntry.id,
          type: memoryEntry.type,
          content: memoryEntry.content,
          tags: memoryEntry.tags,
          importance: memoryEntry.importance,
          created_at: memoryEntry.created_at,
        },
      };
    } catch (error) {
      this.handleError(error as Error, "createMemory");
      return {
        success: false,
        error: error instanceof Error ? (error as Error).message : "Unknown error",
      };
    }
  }

  /**
   * Clear all memories for a character
   */
  static async clearMemories(characterId: string): Promise<unknown> {
    try {
      await LocalMemoryOperations.clearCharacterMemories(characterId);
      
      return {
        success: true,
        message: `All memories cleared for character ${characterId}`,
      };
    } catch (error) {
      this.handleError(error as Error, "clearMemories");
      return {
        success: false,
        error: error instanceof Error ? (error as Error).message : "Unknown error",
      };
    }
  }

  /**
   * Retrieve memories and inject them into messages[] for MemoryRetrievalNode
   */
  static async retrieveAndInjectMemories(
    characterId: string,
    userInput: string,
    messages: Array<{ role: string; content: string }>,
    apiKey: string,
    baseUrl?: string,
    language: "zh" | "en" = "zh",
    maxMemories: number = 5,
  ): Promise<{
    messages: Array<{ role: string; content: string }>;
    memoryPrompt: string;
    retrievedMemories: unknown[];
    memoryCount: number;
  }> {
    try {
      const searchResult = await this.searchMemories(
        characterId,
        userInput,
        apiKey,
        baseUrl,
        maxMemories,
        undefined,
        true,
      );

      if (!searchResult.success) {
        return this.createFallbackMessagesResult(messages, language);
      }

      const memoryPrompt = this.formatMemoriesForPrompt(searchResult.results, language);
      const memoryCount = searchResult.count;

      // 无命中时不修改消息，仅返回提示信息用于调试展示
      if (memoryCount === 0) {
        return {
          messages,
          memoryPrompt,
          retrievedMemories: [],
          memoryCount: 0,
        };
      }

      const enhancedMessages = this.injectMemoriesIntoMessages(messages, memoryPrompt);
      console.log(`Retrieved ${memoryCount} memories for character ${characterId}`);

      return {
        messages: enhancedMessages,
        memoryPrompt,
        retrievedMemories: searchResult.results,
        memoryCount,
      };
    } catch (error) {
      this.handleError(error as Error, "retrieveAndInjectMemories");
      return this.createFallbackMessagesResult(messages, language);
    }
  }

  /**
   * Extract and store memories from conversation for MemoryStorageNode
   */
  static async extractAndStoreMemories(
    characterId: string,
    userInput: string,
    assistantResponse: string,
    conversationContext: string,
    apiKey: string,
    baseUrl?: string,
    language: "zh" | "en" = "zh",
  ): Promise<{
    success: boolean;
    extractedCount: number;
    extractedMemories?: unknown[];
    confidence?: number;
    reasoning?: string;
    error?: string;
  }> {
    try {
      const memories = [];
      let extractedCount = 0;

      // Check if user mentioned their name
      const nameMatch = userInput.match(/我叫(.+)|my name is (.+)|I'm (.+)/i);
      if (nameMatch) {
        const name = nameMatch[1] || nameMatch[2] || nameMatch[3];
        const result = await this.createMemory(
          characterId,
          MemoryType.FACT,
          `用户的名字是 ${name.trim()}`,
          apiKey,
          baseUrl,
          ["name", "user", "identity"],
          0.9,
          {
            source: "conversation_extraction",
            context: conversationContext,
          },
        );
        
        if (result.success) {
          memories.push(result.memory);
          extractedCount++;
        }
      }

      // Check for preferences mentioned in conversation
      const preferenceKeywords = ["喜欢", "不喜欢", "爱好", "兴趣", "prefer", "like", "dislike", "hobby"];
      const hasPreference = preferenceKeywords.some(keyword => 
        userInput.toLowerCase().includes(keyword) || assistantResponse.toLowerCase().includes(keyword),
      );

      if (hasPreference) {
        const result = await this.createMemory(
          characterId,
          MemoryType.PREFERENCE,
          `对话中提到了用户偏好相关内容: ${userInput.substring(0, 100)}...`,
          apiKey,
          baseUrl,
          ["preference", "likes", "interests"],
          0.7,
          {
            source: "conversation_extraction",
            context: conversationContext,
          },
        );
        
        if (result.success) {
          memories.push(result.memory);
          extractedCount++;
        }
      }

      return {
        success: true,
        extractedCount,
        extractedMemories: memories,
        confidence: extractedCount > 0 ? 0.8 : 0,
        reasoning: `Extracted ${extractedCount} memories using basic pattern matching`,
      };

    } catch (error) {
      this.handleError(error as Error, "extractAndStoreMemories");
      return {
        success: false,
        extractedCount: 0,
        error: error instanceof Error ? (error as Error).message : "Unknown error",
      };
    }
  }

  /**
   * Private helper: Format retrieved memories for prompt injection
   */
  private static formatMemoriesForPrompt(memories: unknown[], language: "zh" | "en"): string {
    if (!memories || memories.length === 0) {
      return language === "zh" ? "无相关记忆" : "No relevant memories";
    }

    const header = language === "zh" ? "相关记忆：" : "Relevant memories:";
    const memoryTexts = memories.map((memory, index) => {
      const m = memory as { type?: string; content?: string };
      const typeLabel = language === "zh" ? this.getChineseTypeLabel(m.type || "") : (m.type || "");
      return `${index + 1}. [${typeLabel}] ${m.content || ""}`;
    });

    return `${header}\n${memoryTexts.join("\n")}`;
  }

  /**
   * Private helper: Inject memory prompt into messages[]
   */
  private static injectMemoriesIntoMessages(
    messages: Array<{ role: string; content: string }>,
    memoryPrompt: string,
  ): Array<{ role: string; content: string }> {
    const nextMessages = messages.map((msg) => ({ ...msg }));
    const firstSystemIndex = nextMessages.findIndex((msg) => msg.role === "system");
    const memoryBlock = `<memory>\n${memoryPrompt}\n</memory>`;

    if (firstSystemIndex === -1) {
      return [{ role: "system", content: memoryBlock }, ...nextMessages];
    }

    const currentContent = nextMessages[firstSystemIndex].content || "";
    if (currentContent.includes("{{memory}}")) {
      nextMessages[firstSystemIndex] = {
        ...nextMessages[firstSystemIndex],
        content: currentContent.replace("{{memory}}", memoryPrompt),
      };
      return nextMessages;
    }

    nextMessages[firstSystemIndex] = {
      ...nextMessages[firstSystemIndex],
      content: currentContent
        ? `${currentContent}\n\n${memoryBlock}`
        : memoryBlock,
    };

    return nextMessages;
  }

  /**
   * Private helper: Get Chinese labels for memory types
   */
  private static getChineseTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      "fact": "事实",
      "relationship": "关系",
      "event": "事件",
      "preference": "偏好",
      "emotion": "情感",
      "geography": "地理",
      "concept": "概念",
      "dialogue": "对话",
    };
    return labels[type] || type;
  }

  /**
   * Private helper: Create fallback result for memory retrieval
   */
  private static createFallbackMessagesResult(
    messages: Array<{ role: string; content: string }>,
    language: "zh" | "en",
  ) {
    return {
      messages,
      memoryPrompt: language === "zh" ? "无相关记忆" : "No relevant memories",
      retrievedMemories: [],
      memoryCount: 0,
    };
  }
}
