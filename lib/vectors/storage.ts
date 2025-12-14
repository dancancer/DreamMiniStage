/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         向量存储后端                                       ║
 * ║                                                                            ║
 * ║  实现 IndexedDB 存储和向量索引                                              ║
 * ║  支持增量更新和持久化                                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { Embedding } from "./embeddings";
import type { VectorDocument, SearchResult, SearchOptions } from "./search";
import { VectorSearchEngine } from "./search";

// ============================================================================
//                              类型定义
// ============================================================================

/** 存储配置 */
export interface VectorStorageConfig {
  dbName: string;
  storeName: string;
  version: number;
}

/** 默认配置 */
export const DEFAULT_STORAGE_CONFIG: VectorStorageConfig = {
  dbName: "DreamMiniStage_Vectors",
  storeName: "documents",
  version: 1,
};

/** 存储统计 */
export interface StorageStats {
  documentCount: number;
  totalSize: number;
  lastUpdated: number;
}

// ============================================================================
//                              IndexedDB 存储
// ============================================================================

/** IndexedDB 向量存储 */
export class IndexedDBVectorStorage {
  private config: VectorStorageConfig;
  private db: IDBDatabase | null = null;
  private searchEngine: VectorSearchEngine;
  private initialized = false;

  constructor(config: Partial<VectorStorageConfig> = {}) {
    this.config = { ...DEFAULT_STORAGE_CONFIG, ...config };
    this.searchEngine = new VectorSearchEngine();
  }

  /** 初始化数据库 */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        this.loadAllDocuments().then(resolve).catch(reject);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(this.config.storeName)) {
          const store = db.createObjectStore(this.config.storeName, { keyPath: "id" });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("metadata_type", "metadata.type", { unique: false });
        }
      };
    });
  }

  /** 加载所有文档到内存 */
  private async loadAllDocuments(): Promise<void> {
    const docs = await this.getAllFromDB();
    this.searchEngine.addDocuments(docs);
  }

  /** 从数据库获取所有文档 */
  private async getAllFromDB(): Promise<VectorDocument[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, "readonly");
      const store = transaction.objectStore(this.config.storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /** 添加文档 */
  async addDocument(doc: VectorDocument): Promise<void> {
    await this.ensureInitialized();

    const docWithTimestamp = {
      ...doc,
      timestamp: doc.timestamp || Date.now(),
    };

    await this.putToDB(docWithTimestamp);
    this.searchEngine.addDocument(docWithTimestamp);
  }

  /** 批量添加文档 */
  async addDocuments(docs: VectorDocument[]): Promise<void> {
    await this.ensureInitialized();

    const docsWithTimestamp = docs.map((doc) => ({
      ...doc,
      timestamp: doc.timestamp || Date.now(),
    }));

    await this.putManyToDB(docsWithTimestamp);
    this.searchEngine.addDocuments(docsWithTimestamp);
  }

  /** 写入数据库 */
  private async putToDB(doc: VectorDocument): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, "readwrite");
      const store = transaction.objectStore(this.config.storeName);
      const request = store.put(doc);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /** 批量写入数据库 */
  private async putManyToDB(docs: VectorDocument[]): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, "readwrite");
      const store = transaction.objectStore(this.config.storeName);

      let completed = 0;
      const total = docs.length;

      for (const doc of docs) {
        const request = store.put(doc);
        request.onsuccess = () => {
          completed++;
          if (completed === total) resolve();
        };
        request.onerror = () => reject(request.error);
      }

      if (total === 0) resolve();
    });
  }

  /** 获取文档 */
  async getDocument(id: string): Promise<VectorDocument | undefined> {
    await this.ensureInitialized();
    return this.searchEngine.getDocument(id);
  }

  /** 删除文档 */
  async removeDocument(id: string): Promise<boolean> {
    await this.ensureInitialized();

    await this.deleteFromDB(id);
    return this.searchEngine.removeDocument(id);
  }

  /** 从数据库删除 */
  private async deleteFromDB(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, "readwrite");
      const store = transaction.objectStore(this.config.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /** 搜索 */
  async search(queryEmbedding: Embedding, options?: SearchOptions): Promise<SearchResult[]> {
    await this.ensureInitialized();
    return this.searchEngine.search(queryEmbedding, options);
  }

  /** 获取统计信息 */
  async getStats(): Promise<StorageStats> {
    await this.ensureInitialized();

    const docs = this.searchEngine.getAllDocuments();
    const totalSize = docs.reduce((sum, doc) => {
      return sum + JSON.stringify(doc).length;
    }, 0);

    const lastUpdated = docs.reduce((max, doc) => {
      return Math.max(max, doc.timestamp || 0);
    }, 0);

    return {
      documentCount: docs.length,
      totalSize,
      lastUpdated,
    };
  }

  /** 清空存储 */
  async clear(): Promise<void> {
    await this.ensureInitialized();

    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction(this.config.storeName, "readwrite");
        const store = transaction.objectStore(this.config.storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    this.searchEngine.clear();
  }

  /** 关闭数据库 */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  /** 确保已初始化 */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /** 导出所有文档 */
  async exportDocuments(): Promise<VectorDocument[]> {
    await this.ensureInitialized();
    return this.searchEngine.getAllDocuments();
  }

  /** 导入文档 */
  async importDocuments(docs: VectorDocument[], clearExisting = false): Promise<void> {
    if (clearExisting) {
      await this.clear();
    }
    await this.addDocuments(docs);
  }
}

// ============================================================================
//                              内存存储 (用于测试或临时使用)
// ============================================================================

/** 内存向量存储 */
export class MemoryVectorStorage {
  private searchEngine: VectorSearchEngine;

  constructor() {
    this.searchEngine = new VectorSearchEngine();
  }

  async initialize(): Promise<void> {
    // 内存存储无需初始化
  }

  async addDocument(doc: VectorDocument): Promise<void> {
    this.searchEngine.addDocument({
      ...doc,
      timestamp: doc.timestamp || Date.now(),
    });
  }

  async addDocuments(docs: VectorDocument[]): Promise<void> {
    for (const doc of docs) {
      await this.addDocument(doc);
    }
  }

  async getDocument(id: string): Promise<VectorDocument | undefined> {
    return this.searchEngine.getDocument(id);
  }

  async removeDocument(id: string): Promise<boolean> {
    return this.searchEngine.removeDocument(id);
  }

  async search(queryEmbedding: Embedding, options?: SearchOptions): Promise<SearchResult[]> {
    return this.searchEngine.search(queryEmbedding, options);
  }

  async getStats(): Promise<StorageStats> {
    const docs = this.searchEngine.getAllDocuments();
    return {
      documentCount: docs.length,
      totalSize: docs.reduce((sum, doc) => sum + JSON.stringify(doc).length, 0),
      lastUpdated: docs.reduce((max, doc) => Math.max(max, doc.timestamp || 0), 0),
    };
  }

  async clear(): Promise<void> {
    this.searchEngine.clear();
  }

  close(): void {
    // 内存存储无需关闭
  }

  async exportDocuments(): Promise<VectorDocument[]> {
    return this.searchEngine.getAllDocuments();
  }

  async importDocuments(docs: VectorDocument[], clearExisting = false): Promise<void> {
    if (clearExisting) {
      await this.clear();
    }
    await this.addDocuments(docs);
  }
}

// ============================================================================
//                              存储接口
// ============================================================================

/** 向量存储接口 */
export interface VectorStorage {
  initialize(): Promise<void>;
  addDocument(doc: VectorDocument): Promise<void>;
  addDocuments(docs: VectorDocument[]): Promise<void>;
  getDocument(id: string): Promise<VectorDocument | undefined>;
  removeDocument(id: string): Promise<boolean>;
  search(queryEmbedding: Embedding, options?: SearchOptions): Promise<SearchResult[]>;
  getStats(): Promise<StorageStats>;
  clear(): Promise<void>;
  close(): void;
  exportDocuments(): Promise<VectorDocument[]>;
  importDocuments(docs: VectorDocument[], clearExisting?: boolean): Promise<void>;
}

// ============================================================================
//                              便捷函数
// ============================================================================

/** 创建 IndexedDB 存储 */
export function createIndexedDBStorage(
  config?: Partial<VectorStorageConfig>,
): IndexedDBVectorStorage {
  return new IndexedDBVectorStorage(config);
}

/** 创建内存存储 */
export function createMemoryStorage(): MemoryVectorStorage {
  return new MemoryVectorStorage();
}

/** 检测是否支持 IndexedDB */
export function isIndexedDBSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

/** 创建存储 (自动选择最佳后端) */
export function createStorage(config?: Partial<VectorStorageConfig>): VectorStorage {
  if (isIndexedDBSupported()) {
    return createIndexedDBStorage(config);
  }
  return createMemoryStorage();
}
