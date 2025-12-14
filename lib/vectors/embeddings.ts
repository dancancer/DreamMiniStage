/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         向量嵌入系统                                       ║
 * ║                                                                            ║
 * ║  支持多种 Embedding API 的文本向量化                                        ║
 * ║  包括 OpenAI、本地模型等                                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              类型定义
// ============================================================================

/** 嵌入向量 */
export type Embedding = number[];

/** 嵌入结果 */
export interface EmbeddingResult {
  embedding: Embedding;
  text: string;
  tokenCount?: number;
}

/** 批量嵌入结果 */
export interface BatchEmbeddingResult {
  embeddings: EmbeddingResult[];
  totalTokens?: number;
}

/** 嵌入提供者类型 */
export type EmbeddingProvider = "openai" | "local" | "transformers" | "custom";

/** 嵌入配置 */
export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  apiKey?: string;
  apiUrl?: string;
  dimensions?: number;
  maxTokens?: number;
  batchSize?: number;
}

/** 默认配置 */
export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  provider: "openai",
  model: "text-embedding-3-small",
  dimensions: 1536,
  maxTokens: 8191,
  batchSize: 100,
};

// ============================================================================
//                              嵌入客户端基类
// ============================================================================

/** 嵌入客户端接口 */
export interface EmbeddingClient {
  embed(text: string): Promise<EmbeddingResult>;
  embedBatch(texts: string[]): Promise<BatchEmbeddingResult>;
  getDimensions(): number;
}

// ============================================================================
//                              OpenAI 嵌入客户端
// ============================================================================

/** OpenAI 嵌入客户端 */
export class OpenAIEmbeddingClient implements EmbeddingClient {
  private config: EmbeddingConfig;

  constructor(config: Partial<EmbeddingConfig> = {}) {
    this.config = { ...DEFAULT_EMBEDDING_CONFIG, ...config, provider: "openai" };
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const result = await this.embedBatch([text]);
    return result.embeddings[0];
  }

  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    const apiUrl = this.config.apiUrl || "https://api.openai.com/v1/embeddings";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: texts,
        dimensions: this.config.dimensions,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI Embedding API error: ${error}`);
    }

    const data = await response.json() as OpenAIEmbeddingResponse;

    return {
      embeddings: data.data.map((item, index) => ({
        embedding: item.embedding,
        text: texts[index],
        tokenCount: data.usage?.prompt_tokens,
      })),
      totalTokens: data.usage?.total_tokens,
    };
  }

  getDimensions(): number {
    return this.config.dimensions || 1536;
  }
}

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { prompt_tokens: number; total_tokens: number };
}

// ============================================================================
//                              本地嵌入客户端 (简单实现)
// ============================================================================

/** 本地嵌入客户端 (使用简单的词袋模型) */
export class LocalEmbeddingClient implements EmbeddingClient {
  private dimensions: number;
  private vocabulary: Map<string, number> = new Map();
  private vocabSize = 0;

  constructor(dimensions = 384) {
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const embedding = this.computeEmbedding(text);
    return { embedding, text };
  }

  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    const embeddings = texts.map((text) => ({
      embedding: this.computeEmbedding(text),
      text,
    }));
    return { embeddings };
  }

  getDimensions(): number {
    return this.dimensions;
  }

  private computeEmbedding(text: string): Embedding {
    const tokens = this.tokenize(text);
    const embedding = new Array(this.dimensions).fill(0);

    for (const token of tokens) {
      const hash = this.hashToken(token);
      const index = Math.abs(hash) % this.dimensions;
      embedding[index] += 1;
    }

    return this.normalize(embedding);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }

  private hashToken(token: string): number {
    if (this.vocabulary.has(token)) {
      return this.vocabulary.get(token)!;
    }
    const hash = this.simpleHash(token);
    this.vocabulary.set(token, hash);
    this.vocabSize++;
    return hash;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  private normalize(vec: number[]): number[] {
    const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (magnitude === 0) return vec;
    return vec.map((v) => v / magnitude);
  }
}

// ============================================================================
//                              嵌入管理器
// ============================================================================

/** 嵌入管理器 */
export class EmbeddingManager {
  private client: EmbeddingClient;
  private cache: Map<string, Embedding> = new Map();
  private config: EmbeddingConfig;

  constructor(config: Partial<EmbeddingConfig> = {}) {
    this.config = { ...DEFAULT_EMBEDDING_CONFIG, ...config };
    this.client = this.createClient();
  }

  private createClient(): EmbeddingClient {
    switch (this.config.provider) {
    case "openai":
      return new OpenAIEmbeddingClient(this.config);
    case "local":
    case "transformers":
      return new LocalEmbeddingClient(this.config.dimensions);
    default:
      return new LocalEmbeddingClient(this.config.dimensions);
    }
  }

  /** 获取文本嵌入 (带缓存) */
  async getEmbedding(text: string, useCache = true): Promise<Embedding> {
    const cacheKey = this.getCacheKey(text);

    if (useCache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const result = await this.client.embed(text);
    this.cache.set(cacheKey, result.embedding);
    return result.embedding;
  }

  /** 批量获取嵌入 */
  async getEmbeddings(texts: string[], useCache = true): Promise<Embedding[]> {
    const results: Embedding[] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    for (let i = 0; i < texts.length; i++) {
      const cacheKey = this.getCacheKey(texts[i]);
      if (useCache && this.cache.has(cacheKey)) {
        results[i] = this.cache.get(cacheKey)!;
      } else {
        uncachedTexts.push(texts[i]);
        uncachedIndices.push(i);
      }
    }

    if (uncachedTexts.length > 0) {
      const batchResults = await this.embedInBatches(uncachedTexts);
      for (let i = 0; i < batchResults.length; i++) {
        const index = uncachedIndices[i];
        results[index] = batchResults[i];
        this.cache.set(this.getCacheKey(texts[index]), batchResults[i]);
      }
    }

    return results;
  }

  /** 分批嵌入 */
  private async embedInBatches(texts: string[]): Promise<Embedding[]> {
    const batchSize = this.config.batchSize || 100;
    const results: Embedding[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResult = await this.client.embedBatch(batch);
      results.push(...batchResult.embeddings.map((e) => e.embedding));
    }

    return results;
  }

  /** 获取缓存键 */
  private getCacheKey(text: string): string {
    return `${this.config.provider}:${this.config.model}:${text.slice(0, 100)}`;
  }

  /** 获取向量维度 */
  getDimensions(): number {
    return this.client.getDimensions();
  }

  /** 清空缓存 */
  clearCache(): void {
    this.cache.clear();
  }

  /** 获取缓存大小 */
  getCacheSize(): number {
    return this.cache.size;
  }

  /** 更新配置 */
  updateConfig(config: Partial<EmbeddingConfig>): void {
    this.config = { ...this.config, ...config };
    this.client = this.createClient();
  }
}

// ============================================================================
//                              便捷函数
// ============================================================================

/** 创建嵌入管理器 */
export function createEmbeddingManager(config?: Partial<EmbeddingConfig>): EmbeddingManager {
  return new EmbeddingManager(config);
}

/** 计算余弦相似度 */
export function cosineSimilarity(a: Embedding, b: Embedding): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have same dimensions");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/** 计算欧几里得距离 */
export function euclideanDistance(a: Embedding, b: Embedding): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have same dimensions");
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/** 归一化向量 */
export function normalizeEmbedding(embedding: Embedding): Embedding {
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return embedding;
  return embedding.map((v) => v / magnitude);
}
