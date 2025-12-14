/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         记忆检索系统                                       ║
 * ║                                                                            ║
 * ║  集成向量存储与 Extension Prompts 的 3_vectors 扩展                         ║
 * ║  实现对话历史的语义检索                                                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { Embedding } from "./embeddings";
import type { VectorDocument, SearchResult, SearchOptions } from "./search";
import type { VectorStorage } from "./storage";
import { EmbeddingManager, createEmbeddingManager } from "./embeddings";
import { createStorage } from "./storage";

// ============================================================================
//                              类型定义
// ============================================================================

/** 记忆类型 */
export type MemoryType = "message" | "summary" | "note" | "worldinfo" | "custom";

/** 记忆条目 */
export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  embedding?: Embedding;
  metadata: {
    messageId?: number;
    characterId?: string;
    sessionId?: string;
    role?: "user" | "assistant" | "system";
    timestamp: number;
    importance?: number;
    tags?: string[];
  };
}

/** 检索结果 */
export interface RetrievalResult {
  entry: MemoryEntry;
  score: number;
  relevance: "high" | "medium" | "low";
}

/** 检索配置 */
export interface RetrievalConfig {
  topK: number;
  minScore: number;
  includeTypes: MemoryType[];
  maxAge?: number;
  characterId?: string;
  sessionId?: string;
}

/** 默认检索配置 */
export const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  topK: 5,
  minScore: 0.5,
  includeTypes: ["message", "summary", "note"],
};

// ============================================================================
//                              记忆检索管理器
// ============================================================================

/** 记忆检索管理器 */
export class MemoryRetrievalManager {
  private storage: VectorStorage;
  private embeddingManager: EmbeddingManager;
  private config: RetrievalConfig;

  constructor(
    storage?: VectorStorage,
    embeddingManager?: EmbeddingManager,
    config?: Partial<RetrievalConfig>,
  ) {
    this.storage = storage || createStorage();
    this.embeddingManager = embeddingManager || createEmbeddingManager();
    this.config = { ...DEFAULT_RETRIEVAL_CONFIG, ...config };
  }

  /** 初始化 */
  async initialize(): Promise<void> {
    await this.storage.initialize();
  }

  /** 添加记忆 */
  async addMemory(entry: Omit<MemoryEntry, "embedding">): Promise<void> {
    const embedding = await this.embeddingManager.getEmbedding(entry.content);

    const doc: VectorDocument = {
      id: entry.id,
      embedding,
      content: entry.content,
      metadata: {
        ...entry.metadata,
        type: entry.type,
      },
      timestamp: entry.metadata.timestamp,
    };

    await this.storage.addDocument(doc);
  }

  /** 批量添加记忆 */
  async addMemories(entries: Omit<MemoryEntry, "embedding">[]): Promise<void> {
    const contents = entries.map((e) => e.content);
    const embeddings = await this.embeddingManager.getEmbeddings(contents);

    const docs: VectorDocument[] = entries.map((entry, i) => ({
      id: entry.id,
      embedding: embeddings[i],
      content: entry.content,
      metadata: {
        ...entry.metadata,
        type: entry.type,
      },
      timestamp: entry.metadata.timestamp,
    }));

    await this.storage.addDocuments(docs);
  }

  /** 检索相关记忆 */
  async retrieve(
    query: string,
    config?: Partial<RetrievalConfig>,
  ): Promise<RetrievalResult[]> {
    const opts = { ...this.config, ...config };
    const queryEmbedding = await this.embeddingManager.getEmbedding(query);

    const searchOptions: SearchOptions = {
      topK: opts.topK * 2,
      minScore: opts.minScore,
      filter: (doc) => this.filterDocument(doc, opts),
    };

    const results = await this.storage.search(queryEmbedding, searchOptions);
    return this.processResults(results, opts);
  }

  /** 过滤文档 */
  private filterDocument(doc: VectorDocument, config: RetrievalConfig): boolean {
    const meta = doc.metadata || {};

    if (config.includeTypes.length > 0) {
      const type = meta.type as MemoryType;
      if (!config.includeTypes.includes(type)) return false;
    }

    if (config.characterId && meta.characterId !== config.characterId) {
      return false;
    }

    if (config.sessionId && meta.sessionId !== config.sessionId) {
      return false;
    }

    if (config.maxAge) {
      const age = Date.now() - (doc.timestamp || 0);
      if (age > config.maxAge) return false;
    }

    return true;
  }

  /** 处理搜索结果 */
  private processResults(
    results: SearchResult[],
    config: RetrievalConfig,
  ): RetrievalResult[] {
    return results.slice(0, config.topK).map((result) => {
      const meta = result.document.metadata || {};

      const entry: MemoryEntry = {
        id: result.document.id,
        type: (meta.type as MemoryType) || "custom",
        content: result.document.content,
        metadata: {
          messageId: meta.messageId as number | undefined,
          characterId: meta.characterId as string | undefined,
          sessionId: meta.sessionId as string | undefined,
          role: meta.role as "user" | "assistant" | "system" | undefined,
          timestamp: result.document.timestamp || 0,
          importance: meta.importance as number | undefined,
          tags: meta.tags as string[] | undefined,
        },
      };

      const relevance = this.scoreToRelevance(result.score);

      return { entry, score: result.score, relevance };
    });
  }

  /** 分数转相关度 */
  private scoreToRelevance(score: number): "high" | "medium" | "low" {
    if (score >= 0.8) return "high";
    if (score >= 0.6) return "medium";
    return "low";
  }

  /** 删除记忆 */
  async removeMemory(id: string): Promise<boolean> {
    return this.storage.removeDocument(id);
  }

  /** 清空所有记忆 */
  async clearAll(): Promise<void> {
    await this.storage.clear();
  }

  /** 清空指定会话的记忆 */
  async clearSession(sessionId: string): Promise<number> {
    const docs = await this.storage.exportDocuments();
    let removed = 0;

    for (const doc of docs) {
      if (doc.metadata?.sessionId === sessionId) {
        await this.storage.removeDocument(doc.id);
        removed++;
      }
    }

    return removed;
  }

  /** 获取统计信息 */
  async getStats(): Promise<{
    totalMemories: number;
    byType: Record<MemoryType, number>;
    bySession: Record<string, number>;
  }> {
    const docs = await this.storage.exportDocuments();
    const byType: Record<string, number> = {};
    const bySession: Record<string, number> = {};

    for (const doc of docs) {
      const type = (doc.metadata?.type as string) || "custom";
      byType[type] = (byType[type] || 0) + 1;

      const session = (doc.metadata?.sessionId as string) || "unknown";
      bySession[session] = (bySession[session] || 0) + 1;
    }

    return {
      totalMemories: docs.length,
      byType: byType as Record<MemoryType, number>,
      bySession,
    };
  }

  /** 关闭 */
  close(): void {
    this.storage.close();
  }
}

// ============================================================================
//                              消息记忆化
// ============================================================================

/** 消息记忆化选项 */
export interface MessageMemorizationOptions {
  sessionId: string;
  characterId?: string;
  minLength?: number;
  excludeRoles?: ("user" | "assistant" | "system")[];
}

/** 将消息转换为记忆条目 */
export function messageToMemoryEntry(
  message: { role: "user" | "assistant" | "system"; content: string },
  messageId: number,
  options: MessageMemorizationOptions,
): Omit<MemoryEntry, "embedding"> | null {
  const { sessionId, characterId, minLength = 10, excludeRoles = [] } = options;

  if (excludeRoles.includes(message.role)) return null;
  if (message.content.length < minLength) return null;

  return {
    id: `msg_${sessionId}_${messageId}`,
    type: "message",
    content: message.content,
    metadata: {
      messageId,
      characterId,
      sessionId,
      role: message.role,
      timestamp: Date.now(),
    },
  };
}

/** 批量将消息转换为记忆条目 */
export function messagesToMemoryEntries(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  startMessageId: number,
  options: MessageMemorizationOptions,
): Omit<MemoryEntry, "embedding">[] {
  const entries: Omit<MemoryEntry, "embedding">[] = [];

  for (let i = 0; i < messages.length; i++) {
    const entry = messageToMemoryEntry(messages[i], startMessageId + i, options);
    if (entry) entries.push(entry);
  }

  return entries;
}

// ============================================================================
//                              便捷函数
// ============================================================================

/** 创建记忆检索管理器 */
export function createMemoryRetrievalManager(
  config?: Partial<RetrievalConfig>,
): MemoryRetrievalManager {
  return new MemoryRetrievalManager(undefined, undefined, config);
}

/** 格式化检索结果为提示词 */
export function formatRetrievalResults(
  results: RetrievalResult[],
  options: { maxLength?: number; separator?: string } = {},
): string {
  const { maxLength = 2000, separator = "\n---\n" } = options;

  const parts: string[] = [];
  let currentLength = 0;

  for (const result of results) {
    const part = `[${result.entry.type}] ${result.entry.content}`;
    if (currentLength + part.length > maxLength) break;
    parts.push(part);
    currentLength += part.length + separator.length;
  }

  return parts.join(separator);
}

/** 生成记忆 ID */
export function generateMemoryId(type: MemoryType, sessionId: string): string {
  return `${type}_${sessionId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
