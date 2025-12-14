/* ╔════════════════════════════════════════════════════════════════════════╗
 * ║                            向量存储封装                                 ║
 * ║          默认使用 IndexedDB，回退内存实现，避免 SQLite 依赖               ║
 * ╚════════════════════════════════════════════════════════════════════════╝ */

import type { VectorDocument, SearchResult } from "@/lib/vectors/search";
import {
  createStorage,
  createMemoryStorage,
  type VectorStorage,
} from "@/lib/vectors/storage";

export interface VectorMemoryRecord {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  source: string;
  content: string;
  embedding: number[];
  createdAt: number;
}

export class VectorMemoryStore {
  private storage: VectorStorage;

  constructor(storage?: VectorStorage) {
    // createStorage 会在浏览器端选择 IndexedDB，在无支持时回退内存
    this.storage = storage ?? createStorage();
  }

  async add(records: VectorMemoryRecord[]): Promise<void> {
    const docs: VectorDocument[] = records.map((record) => ({
      id: record.id,
      embedding: record.embedding,
      content: record.content,
      timestamp: record.createdAt,
      metadata: {
        sessionId: record.sessionId,
        role: record.role,
        source: record.source,
      },
    }));
    await this.storage.addDocuments(docs);
  }

  async search(
    queryEmbedding: number[],
    options: {
      topK: number;
      sessionId: string;
      minScore?: number;
    },
  ): Promise<SearchResult[]> {
    const { topK, sessionId, minScore } = options;
    return this.storage.search(queryEmbedding, {
      topK: topK * 2, // 冗余获取，后续再做时间 tie-break
      minScore: minScore ?? 0,
      filter: (doc) => doc.metadata?.sessionId === sessionId,
    });
  }

  async exportAll(sessionId: string): Promise<VectorMemoryRecord[]> {
    const docs = await this.storage.exportDocuments();
    return docs
      .filter((doc) => doc.metadata?.sessionId === sessionId)
      .map((doc) => ({
        id: doc.id,
        sessionId: doc.metadata?.sessionId as string,
        role: doc.metadata?.role as "user" | "assistant" | "system",
        source: doc.metadata?.source as string,
        content: doc.content,
        embedding: doc.embedding,
        createdAt: doc.timestamp || 0,
      }));
  }
}

export function createVectorMemoryStore(): VectorMemoryStore {
  try {
    return new VectorMemoryStore();
  } catch {
    return new VectorMemoryStore(createMemoryStorage());
  }
}
