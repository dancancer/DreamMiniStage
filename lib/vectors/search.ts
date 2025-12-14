/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         向量搜索系统                                       ║
 * ║                                                                            ║
 * ║  实现相似度计算和 Top-K 检索                                                ║
 * ║  支持过滤条件和多种相似度算法                                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { Embedding } from "./embeddings";
import { cosineSimilarity, euclideanDistance } from "./embeddings";

// ============================================================================
//                              最小堆 (Top-K 优化)
// ============================================================================

/** 最小堆实现，用于高效 Top-K 查询 */
class MinHeap<T> {
  private heap: Array<{ item: T; score: number }> = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get size(): number {
    return this.heap.length;
  }

  get minScore(): number {
    return this.heap.length > 0 ? this.heap[0].score : -Infinity;
  }

  push(item: T, score: number): boolean {
    if (this.heap.length < this.maxSize) {
      this.heap.push({ item, score });
      this.bubbleUp(this.heap.length - 1);
      return true;
    } else if (score > this.heap[0].score) {
      this.heap[0] = { item, score };
      this.bubbleDown(0);
      return true;
    }
    return false;
  }

  getItems(): Array<{ item: T; score: number }> {
    return [...this.heap].sort((a, b) => b.score - a.score);
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.heap[parent].score <= this.heap[idx].score) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }

  private bubbleDown(idx: number): void {
    while (true) {
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      let smallest = idx;

      if (left < this.heap.length && this.heap[left].score < this.heap[smallest].score) {
        smallest = left;
      }
      if (right < this.heap.length && this.heap[right].score < this.heap[smallest].score) {
        smallest = right;
      }
      if (smallest === idx) break;

      [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
      idx = smallest;
    }
  }
}

// ============================================================================
//                              类型定义
// ============================================================================

/** 向量文档 */
export interface VectorDocument {
  id: string;
  embedding: Embedding;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

/** 搜索结果 */
export interface SearchResult {
  document: VectorDocument;
  score: number;
  distance?: number;
}

/** 相似度算法 */
export type SimilarityMetric = "cosine" | "euclidean" | "dot";

/** 搜索选项 */
export interface SearchOptions {
  topK?: number;
  minScore?: number;
  maxDistance?: number;
  metric?: SimilarityMetric;
  filter?: (doc: VectorDocument) => boolean;
}

/** 默认搜索选项 */
export const DEFAULT_SEARCH_OPTIONS: Required<Omit<SearchOptions, "filter">> = {
  topK: 10,
  minScore: 0,
  maxDistance: Infinity,
  metric: "cosine",
};

// ============================================================================
//                              相似度计算
// ============================================================================

/** 计算相似度 */
export function computeSimilarity(
  a: Embedding,
  b: Embedding,
  metric: SimilarityMetric = "cosine",
): number {
  switch (metric) {
  case "cosine":
    return cosineSimilarity(a, b);
  case "euclidean":
    return 1 / (1 + euclideanDistance(a, b));
  case "dot":
    return dotProduct(a, b);
  default:
    return cosineSimilarity(a, b);
  }
}

/** 点积 */
function dotProduct(a: Embedding, b: Embedding): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

// ============================================================================
//                              向量搜索引擎
// ============================================================================

/** 向量搜索引擎 */
export class VectorSearchEngine {
  private documents: Map<string, VectorDocument> = new Map();

  /** 添加文档 */
  addDocument(doc: VectorDocument): void {
    this.documents.set(doc.id, doc);
  }

  /** 批量添加文档 */
  addDocuments(docs: VectorDocument[]): void {
    for (const doc of docs) {
      this.addDocument(doc);
    }
  }

  /** 获取文档 */
  getDocument(id: string): VectorDocument | undefined {
    return this.documents.get(id);
  }

  /** 删除文档 */
  removeDocument(id: string): boolean {
    return this.documents.delete(id);
  }

  /** 更新文档 */
  updateDocument(id: string, updates: Partial<VectorDocument>): boolean {
    const doc = this.documents.get(id);
    if (!doc) return false;
    this.documents.set(id, { ...doc, ...updates });
    return true;
  }

  /** 搜索相似文档 (堆优化 Top-K) */
  search(queryEmbedding: Embedding, options: SearchOptions = {}): SearchResult[] {
    const opts = { ...DEFAULT_SEARCH_OPTIONS, ...options };
    const heap = new MinHeap<{ doc: VectorDocument; distance?: number }>(opts.topK);

    for (const doc of this.documents.values()) {
      if (opts.filter && !opts.filter(doc)) continue;

      const score = computeSimilarity(queryEmbedding, doc.embedding, opts.metric);

      if (score < opts.minScore) continue;

      const distance = opts.metric === "euclidean"
        ? euclideanDistance(queryEmbedding, doc.embedding)
        : undefined;

      if (distance !== undefined && distance > opts.maxDistance) continue;

      heap.push({ doc, distance }, score);
    }

    return heap.getItems().map(({ item, score }) => ({
      document: item.doc,
      score,
      distance: item.distance,
    }));
  }

  /** 按 ID 列表搜索 */
  searchByIds(ids: string[]): VectorDocument[] {
    return ids
      .map((id) => this.documents.get(id))
      .filter((doc): doc is VectorDocument => doc !== undefined);
  }

  /** 获取所有文档 */
  getAllDocuments(): VectorDocument[] {
    return Array.from(this.documents.values());
  }

  /** 获取文档数量 */
  getDocumentCount(): number {
    return this.documents.size;
  }

  /** 清空所有文档 */
  clear(): void {
    this.documents.clear();
  }

  /** 按条件过滤文档 */
  filterDocuments(predicate: (doc: VectorDocument) => boolean): VectorDocument[] {
    return Array.from(this.documents.values()).filter(predicate);
  }
}

// ============================================================================
//                              高级搜索功能
// ============================================================================

/** 混合搜索结果 */
export interface HybridSearchResult extends SearchResult {
  vectorScore: number;
  keywordScore: number;
}

/** 关键词匹配选项 */
export interface KeywordMatchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

/** 计算关键词匹配分数 */
export function computeKeywordScore(
  content: string,
  keywords: string[],
  options: KeywordMatchOptions = {},
): number {
  const { caseSensitive = false, wholeWord = false } = options;
  const text = caseSensitive ? content : content.toLowerCase();
  let matchCount = 0;

  for (const keyword of keywords) {
    const kw = caseSensitive ? keyword : keyword.toLowerCase();
    if (wholeWord) {
      const regex = new RegExp(`\\b${escapeRegex(kw)}\\b`, "g");
      const matches = text.match(regex);
      matchCount += matches ? matches.length : 0;
    } else {
      let idx = 0;
      while ((idx = text.indexOf(kw, idx)) !== -1) {
        matchCount++;
        idx += kw.length;
      }
    }
  }

  return matchCount / Math.max(keywords.length, 1);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 混合搜索 (向量 + 关键词) */
export function hybridSearch(
  engine: VectorSearchEngine,
  queryEmbedding: Embedding,
  keywords: string[],
  options: SearchOptions & {
    vectorWeight?: number;
    keywordWeight?: number;
    keywordOptions?: KeywordMatchOptions;
  } = {},
): HybridSearchResult[] {
  const {
    vectorWeight = 0.7,
    keywordWeight = 0.3,
    keywordOptions,
    ...searchOptions
  } = options;

  const vectorResults = engine.search(queryEmbedding, { ...searchOptions, topK: 100 });
  const results: HybridSearchResult[] = [];

  for (const result of vectorResults) {
    const keywordScore = computeKeywordScore(
      result.document.content,
      keywords,
      keywordOptions,
    );

    const combinedScore = vectorWeight * result.score + keywordWeight * keywordScore;

    results.push({
      ...result,
      score: combinedScore,
      vectorScore: result.score,
      keywordScore,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, options.topK || DEFAULT_SEARCH_OPTIONS.topK);
}

/** 多查询搜索 (融合多个查询结果) */
export function multiQuerySearch(
  engine: VectorSearchEngine,
  queryEmbeddings: Embedding[],
  options: SearchOptions & { fusionMethod?: "rrf" | "average" } = {},
): SearchResult[] {
  const { fusionMethod = "rrf", ...searchOptions } = options;
  const allResults = queryEmbeddings.map((emb) =>
    engine.search(emb, { ...searchOptions, topK: 50 }),
  );

  const scoreMap = new Map<string, { doc: VectorDocument; scores: number[] }>();

  for (const results of allResults) {
    for (let rank = 0; rank < results.length; rank++) {
      const { document, score } = results[rank];
      if (!scoreMap.has(document.id)) {
        scoreMap.set(document.id, { doc: document, scores: [] });
      }
      const entry = scoreMap.get(document.id)!;

      if (fusionMethod === "rrf") {
        entry.scores.push(1 / (60 + rank + 1));
      } else {
        entry.scores.push(score);
      }
    }
  }

  const fusedResults: SearchResult[] = [];
  for (const { doc, scores } of scoreMap.values()) {
    const finalScore = scores.reduce((a, b) => a + b, 0) / queryEmbeddings.length;
    fusedResults.push({ document: doc, score: finalScore });
  }

  fusedResults.sort((a, b) => b.score - a.score);
  return fusedResults.slice(0, options.topK || DEFAULT_SEARCH_OPTIONS.topK);
}

// ============================================================================
//                              便捷函数
// ============================================================================

/** 创建搜索引擎 */
export function createSearchEngine(): VectorSearchEngine {
  return new VectorSearchEngine();
}

/** 快速搜索 */
export async function quickSearch(
  documents: VectorDocument[],
  queryEmbedding: Embedding,
  topK = 5,
): Promise<SearchResult[]> {
  const engine = new VectorSearchEngine();
  engine.addDocuments(documents);
  return engine.search(queryEmbedding, { topK });
}
