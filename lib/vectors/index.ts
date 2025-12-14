/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         向量系统模块入口                                   ║
 * ║                                                                            ║
 * ║  统一导出向量嵌入、搜索、存储和记忆检索功能                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              嵌入模块导出
// ============================================================================

export type {
  Embedding,
  EmbeddingResult,
  BatchEmbeddingResult,
  EmbeddingProvider,
  EmbeddingConfig,
  EmbeddingClient,
} from "./embeddings";

export {
  DEFAULT_EMBEDDING_CONFIG,
  OpenAIEmbeddingClient,
  LocalEmbeddingClient,
  EmbeddingManager,
  createEmbeddingManager,
  cosineSimilarity,
  euclideanDistance,
  normalizeEmbedding,
} from "./embeddings";

// ============================================================================
//                              搜索模块导出
// ============================================================================

export type {
  VectorDocument,
  SearchResult,
  SimilarityMetric,
  SearchOptions,
  HybridSearchResult,
  KeywordMatchOptions,
} from "./search";

export {
  DEFAULT_SEARCH_OPTIONS,
  computeSimilarity,
  VectorSearchEngine,
  computeKeywordScore,
  hybridSearch,
  multiQuerySearch,
  createSearchEngine,
  quickSearch,
} from "./search";

// ============================================================================
//                              存储模块导出
// ============================================================================

export type {
  VectorStorageConfig,
  StorageStats,
  VectorStorage,
} from "./storage";

export {
  DEFAULT_STORAGE_CONFIG,
  IndexedDBVectorStorage,
  MemoryVectorStorage,
  createIndexedDBStorage,
  createMemoryStorage,
  isIndexedDBSupported,
  createStorage,
} from "./storage";

// ============================================================================
//                              记忆检索模块导出
// ============================================================================

export type {
  MemoryType,
  MemoryEntry,
  RetrievalResult,
  RetrievalConfig,
  MessageMemorizationOptions,
} from "./memory-retrieval";

export {
  DEFAULT_RETRIEVAL_CONFIG,
  MemoryRetrievalManager,
  messageToMemoryEntry,
  messagesToMemoryEntries,
  createMemoryRetrievalManager,
  formatRetrievalResults,
  generateMemoryId,
} from "./memory-retrieval";
