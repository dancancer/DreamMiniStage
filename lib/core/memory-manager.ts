/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                        Advanced Memory Manager                            ║
 * ║                                                                          ║
 * ║  RAG 内存管理器：向量嵌入、语义搜索、智能记忆检索                            ║
 * ║  重构后的简洁版本：工具函数提取到 memory-utils.ts                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import {
  MemoryEntry,
  MemoryType,
  MemorySearchResult,
  MemoryContext,
  MemoryRAGConfig,
  MemoryAnalytics,
} from "@/lib/models/memory-model";
import { LocalMemoryOperations } from "@/lib/data/roleplay/memory-operation";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import {
  cosineSimilarity,
  calculateKeywordScore,
  generateRelevanceReasoning,
  prepareTextForEmbedding,
  formatMemoryPrompt,
  combineSearchResults,
  MEMORY_EXTRACTION_PROMPT,
} from "./memory-utils";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

export interface RAGGenerationOptions {
  characterId: string;
  currentUserInput: string;
  conversationContext?: string;
  maxMemories?: number;
  includeTypes?: MemoryType[];
  language?: "zh" | "en";
}

export interface MemoryExtractionResult {
  memories: MemoryEntry[];
  confidence: number;
  reasoning: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主类
   ═══════════════════════════════════════════════════════════════════════════ */

export class MemoryManager {
  private embeddings: OpenAIEmbeddings;
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor(
    private apiKey: string,
    private baseUrl?: string,
  ) {
    this.embeddings = new OpenAIEmbeddings({
      apiKey: this.apiKey,
      modelName: "text-embedding-3-small",
      configuration: this.baseUrl ? { baseURL: this.baseUrl } : undefined,
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 512,
      chunkOverlap: 50,
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     记忆创建
     ───────────────────────────────────────────────────────────────────────── */

  async createMemory(
    characterId: string,
    type: MemoryType,
    content: string,
    metadata: any = {},
    tags: string[] = [],
    importance: number = 0.5,
  ): Promise<MemoryEntry> {
    const memoryEntry = await LocalMemoryOperations.createMemoryEntry(
      characterId, type, content, metadata, tags, importance,
    );

    try {
      await this.generateAndStoreEmbedding(memoryEntry);
    } catch (error) {
      console.warn(`Failed to generate embedding for memory ${memoryEntry.id}:`, error);
    }

    return memoryEntry;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     语义搜索
     ───────────────────────────────────────────────────────────────────────── */

  async semanticSearch(
    characterId: string,
    query: string,
    options: {
      topK?: number;
      similarityThreshold?: number;
      includeTypes?: MemoryType[];
      excludeRecent?: boolean;
    } = {},
  ): Promise<MemorySearchResult[]> {
    const { topK = 5, similarityThreshold = 0.7, includeTypes, excludeRecent = false } = options;

    try {
      const queryEmbedding = await this.embeddings.embedQuery(query);
      const characterEmbeddings = await LocalMemoryOperations.getEmbeddingsByCharacter(characterId);
      const characterMemories = await LocalMemoryOperations.getMemoryEntriesByCharacter(characterId);

      // 计算相似度并筛选
      const similarities = this.calculateSimilarities(
        queryEmbedding, characterEmbeddings, characterMemories,
        { includeTypes, excludeRecent, similarityThreshold },
      );

      // 排序：相似度 80% + 重要性 20%
      similarities.sort((a, b) => {
        const aScore = a.score * 0.8 + a.entry.importance * 0.2;
        const bScore = b.score * 0.8 + b.entry.importance * 0.2;
        return bScore - aScore;
      });

      // 取 Top K 并生成推理
      const topResults = similarities.slice(0, topK);
      return Promise.all(topResults.map(async (result) => {
        const reasoning = generateRelevanceReasoning(query, result.entry, result.score);
        await LocalMemoryOperations.incrementAccessCount(result.entry.id);
        return { entry: result.entry, score: result.score, reasoning };
      }));
    } catch (error) {
      console.error("Semantic search failed:", error);
      return this.keywordSearch(characterId, query, { topK });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     混合搜索
     ───────────────────────────────────────────────────────────────────────── */

  async hybridSearch(
    characterId: string,
    query: string,
    options: {
      topK?: number;
      similarityThreshold?: number;
      includeTypes?: MemoryType[];
      alpha?: number;
    } = {},
  ): Promise<MemorySearchResult[]> {
    const { topK = 5, similarityThreshold = 0.6, includeTypes, alpha = 0.7 } = options;

    const [semanticResults, keywordResults] = await Promise.all([
      this.semanticSearch(characterId, query, {
        topK: topK * 2,
        similarityThreshold: similarityThreshold * 0.8,
        includeTypes,
      }),
      this.keywordSearch(characterId, query, { topK: topK * 2, includeTypes }),
    ]);

    return combineSearchResults(semanticResults, keywordResults, alpha).slice(0, topK);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     对话记忆提取
     ───────────────────────────────────────────────────────────────────────── */

  async extractMemoriesFromDialogue(
    characterId: string,
    userMessage: string,
    assistantMessage: string,
    context?: string,
  ): Promise<MemoryExtractionResult> {
    const llm = new ChatOpenAI({
      apiKey: this.apiKey,
      modelName: "gpt-4o-mini",
      temperature: 0.1,
      configuration: this.baseUrl ? { baseURL: this.baseUrl } : undefined,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", MEMORY_EXTRACTION_PROMPT],
      ["human", `Context: ${context || "No additional context"}\n\nUser: ${userMessage}\nAssistant: ${assistantMessage}\n\nExtract important memories from this conversation:`],
    ]);

    try {
      const chain = prompt.pipe(llm).pipe(new StringOutputParser());
      const response = await chain.invoke({});
      const extractedMemories = JSON.parse(response);

      if (!Array.isArray(extractedMemories)) {
        return { memories: [], confidence: 0, reasoning: "Invalid response format" };
      }

      // 只存储高置信度记忆 (>= 0.6)
      const memories = await this.storeExtractedMemories(
        characterId, extractedMemories, context, userMessage, assistantMessage,
      );

      const avgConfidence = extractedMemories.length > 0
        ? extractedMemories.reduce((sum, m) => sum + m.confidence, 0) / extractedMemories.length
        : 0;

      return {
        memories,
        confidence: avgConfidence,
        reasoning: `Extracted ${memories.length} memories with avg confidence ${avgConfidence.toFixed(2)}`,
      };
    } catch (error) {
      console.error("Memory extraction failed:", error);
      return {
        memories: [],
        confidence: 0,
        reasoning: `Memory extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     记忆上下文生成
     ───────────────────────────────────────────────────────────────────────── */

  async generateMemoryContext(options: RAGGenerationOptions): Promise<MemoryContext> {
    const { characterId, currentUserInput, maxMemories = 5, includeTypes, language = "zh" } = options;

    const searchResults = await this.hybridSearch(characterId, currentUserInput, {
      topK: maxMemories,
      includeTypes,
      similarityThreshold: 0.6,
    });

    const memoryPrompt = formatMemoryPrompt(searchResults, language);
    const totalMemoryCount = (await LocalMemoryOperations.getMemoryEntriesByCharacter(characterId)).length;
    const config = await LocalMemoryOperations.getRAGConfig(characterId);

    return {
      activeMemories: searchResults.map(r => r.entry),
      searchResults,
      memoryPrompt,
      totalMemoryCount,
      config,
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────
     配置与分析
     ───────────────────────────────────────────────────────────────────────── */

  async getAnalytics(characterId: string): Promise<MemoryAnalytics> {
    return LocalMemoryOperations.getMemoryAnalytics(characterId);
  }

  async updateRAGConfig(characterId: string, config: Partial<MemoryRAGConfig>): Promise<MemoryRAGConfig> {
    return LocalMemoryOperations.updateRAGConfig(characterId, config);
  }

  async rebuildEmbeddings(characterId: string): Promise<{ success: number; failed: number }> {
    const memories = await LocalMemoryOperations.getMemoryEntriesByCharacter(characterId);
    let success = 0, failed = 0;

    for (const memory of memories) {
      try {
        await this.generateAndStoreEmbedding(memory);
        success++;
      } catch (error) {
        console.error(`Failed to regenerate embedding for memory ${memory.id}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  /* ─────────────────────────────────────────────────────────────────────────
     私有方法
     ───────────────────────────────────────────────────────────────────────── */

  private async generateAndStoreEmbedding(memoryEntry: MemoryEntry): Promise<void> {
    const embeddingText = prepareTextForEmbedding(memoryEntry);
    const embedding = await this.embeddings.embedQuery(embeddingText);
    await LocalMemoryOperations.storeEmbedding(
      memoryEntry.id, memoryEntry.characterId, embedding, "text-embedding-3-small",
    );
  }

  private calculateSimilarities(
    queryEmbedding: number[],
    embeddings: Array<{ id: string; embedding: number[] }>,
    memories: MemoryEntry[],
    options: { includeTypes?: MemoryType[]; excludeRecent: boolean; similarityThreshold: number },
  ): Array<{ entry: MemoryEntry; score: number }> {
    const { includeTypes, excludeRecent, similarityThreshold } = options;
    const results: Array<{ entry: MemoryEntry; score: number }> = [];

    // 获取最近 2 条记忆用于排除
    const recentIds = excludeRecent
      ? new Set(memories.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 2).map(m => m.id))
      : new Set<string>();

    for (const embeddingRecord of embeddings) {
      const memory = memories.find(m => m.id === embeddingRecord.id);
      if (!memory) continue;
      if (includeTypes && !includeTypes.includes(memory.type)) continue;
      if (recentIds.has(memory.id)) continue;

      const similarity = cosineSimilarity(queryEmbedding, embeddingRecord.embedding);
      if (similarity >= similarityThreshold) {
        results.push({ entry: memory, score: similarity });
      }
    }

    return results;
  }

  private async keywordSearch(
    characterId: string,
    query: string,
    options: { topK?: number; includeTypes?: MemoryType[] } = {},
  ): Promise<MemorySearchResult[]> {
    const entries = await LocalMemoryOperations.searchMemoriesByText({
      query,
      characterId,
      types: options.includeTypes,
      maxResults: options.topK || 5,
    });

    return entries.map(entry => ({
      entry,
      score: calculateKeywordScore(query, entry),
      reasoning: "Keyword match",
    }));
  }

  private async storeExtractedMemories(
    characterId: string,
    extractedMemories: any[],
    context: string | undefined,
    userMessage: string,
    assistantMessage: string,
  ): Promise<MemoryEntry[]> {
    const memories: MemoryEntry[] = [];

    for (const memoryData of extractedMemories) {
      if (memoryData.confidence >= 0.6) {
        const memory = await this.createMemory(
          characterId,
          memoryData.type,
          memoryData.content,
          {
            source: "dialogue_extraction",
            confidence: memoryData.confidence,
            context,
            originalUserMessage: userMessage,
            originalAssistantMessage: assistantMessage,
          },
          memoryData.tags,
          memoryData.importance,
        );
        memories.push(memory);
      }
    }

    return memories;
  }
}
