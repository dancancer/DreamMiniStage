import { 
  deleteRecord, 
  getAllRecords, 
  getRecordByKey, 
  MEMORY_EMBEDDINGS_FILE, 
  MEMORY_ENTRIES_FILE, 
  putRecord, 
} from "@/lib/data/local-storage";
import { 
  MemoryEntry, 
  MemoryType, 
  MemorySearchQuery, 
  MemoryAnalytics,
  MemoryRAGConfig, 
} from "@/lib/models/memory-model";
import { v4 as uuidv4 } from "uuid";

export interface MemoryRecord {
  id: string;
  characterId: string;
  entries: MemoryEntry[];
  config: MemoryRAGConfig;
  created_at: string;
  updated_at: string;
}

export interface EmbeddingRecord {
  id: string; // Same as memory entry ID
  characterId: string;
  embedding: number[];
  model: string; // Which embedding model was used
  created_at: string;
}

export class LocalMemoryOperations {
  // ================================
  // 内部工具
  // ================================
  private static async getMemoryRecord(characterId: string): Promise<MemoryRecord | null> {
    return await getRecordByKey<MemoryRecord>(MEMORY_ENTRIES_FILE, characterId);
  }

  private static async saveMemoryRecord(record: MemoryRecord): Promise<void> {
    await putRecord(MEMORY_ENTRIES_FILE, record.characterId, record);
  }

  private static async ensureMemoryRecord(characterId: string): Promise<MemoryRecord> {
    const existing = await this.getMemoryRecord(characterId);
    if (existing) return existing;

    const now = new Date().toISOString();
    const record: MemoryRecord = {
      id: characterId,
      characterId,
      entries: [],
      config: this.getDefaultRAGConfig(),
      created_at: now,
      updated_at: now,
    };
    await this.saveMemoryRecord(record);
    return record;
  }

  private static async findRecordByEntry(entryId: string): Promise<{ record: MemoryRecord; index: number } | null> {
    const allRecords = await getAllRecords<MemoryRecord>(MEMORY_ENTRIES_FILE);
    for (const record of allRecords) {
      const idx = record.entries.findIndex(entry => entry.id === entryId);
      if (idx !== -1) {
        return { record, index: idx };
      }
    }
    return null;
  }

  /**
   * Create a new memory entry for a character
   */
  static async createMemoryEntry(
    characterId: string, 
    type: MemoryType,
    content: string,
    metadata: any = {},
    tags: string[] = [],
    importance: number = 0.5,
  ): Promise<MemoryEntry> {
    const memoryRecord = await this.ensureMemoryRecord(characterId);
    const now = new Date().toISOString();

    const memoryEntry: MemoryEntry = {
      id: uuidv4(),
      characterId,
      type,
      content,
      metadata: {
        source: "manual",
        confidence: 1.0,
        ...metadata,
      },
      tags,
      importance,
      accessCount: 0,
      lastAccessed: new Date().toISOString(),
      created_at: now,
      updated_at: now,
    };

    memoryRecord.entries.push(memoryEntry);
    memoryRecord.updated_at = now;
    await this.saveMemoryRecord(memoryRecord);
    return memoryEntry;
  }

  /**
   * Get all memory entries for a character
   */
  static async getMemoryEntriesByCharacter(characterId: string): Promise<MemoryEntry[]> {
    const record = await this.getMemoryRecord(characterId);
    return record ? record.entries : [];
  }

  /**
   * Get a specific memory entry by ID
   */
  static async getMemoryEntryById(entryId: string): Promise<MemoryEntry | null> {
    const located = await this.findRecordByEntry(entryId);
    if (!located) return null;
    return located.record.entries[located.index] || null;
  }

  /**
   * Update a memory entry
   */
  static async updateMemoryEntry(
    entryId: string, 
    updates: Partial<MemoryEntry>,
  ): Promise<MemoryEntry | null> {
    const found = await this.findRecordByEntry(entryId);
    if (!found) return null;

    const { record, index } = found;
    record.entries[index] = {
      ...record.entries[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    record.updated_at = new Date().toISOString();

    await this.saveMemoryRecord(record);
    return record.entries[index];
  }

  /**
   * Delete a memory entry
   */
  static async deleteMemoryEntry(entryId: string): Promise<boolean> {
    const found = await this.findRecordByEntry(entryId);
    if (!found) return false;

    const { record, index } = found;
    record.entries.splice(index, 1);
    record.updated_at = new Date().toISOString();

    await this.saveMemoryRecord(record);
    await this.deleteEmbedding(entryId);
    return true;
  }

  /**
   * Increment access count for a memory entry
   */
  static async incrementAccessCount(entryId: string): Promise<void> {
    const entry = await this.getMemoryEntryById(entryId);
    if (entry) {
      await this.updateMemoryEntry(entryId, {
        accessCount: entry.accessCount + 1,
        lastAccessed: new Date().toISOString(),
      });
    }
  }

  /**
   * Search memories by text (basic search, not vector search)
   */
  static async searchMemoriesByText(query: MemorySearchQuery): Promise<MemoryEntry[]> {
    const entries = await this.getMemoryEntriesByCharacter(query.characterId);
    const lowerQuery = query.query.toLowerCase();
    
    let filteredEntries = entries.filter((entry: MemoryEntry) => {
      // Text search
      const matchesText = entry.content.toLowerCase().includes(lowerQuery) ||
                         entry.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
      
      // Type filter
      const matchesType = !query.types || query.types.includes(entry.type);
      
      // Tag filter
      const matchesTags = !query.tags || query.tags.some(tag => 
        entry.tags.includes(tag),
      );
      
      return matchesText && matchesType && matchesTags;
    });

    // Sort by importance and access count
    filteredEntries.sort((a: MemoryEntry, b: MemoryEntry) => {
      return (b.importance * 0.7 + (b.accessCount / 100) * 0.3) - 
             (a.importance * 0.7 + (a.accessCount / 100) * 0.3);
    });

    // Apply max results limit
    if (query.maxResults) {
      filteredEntries = filteredEntries.slice(0, query.maxResults);
    }

    return filteredEntries;
  }

  /**
   * Store vector embedding for a memory entry
   */
  static async storeEmbedding(
    entryId: string, 
    characterId: string,
    embedding: number[], 
    model: string,
  ): Promise<void> {
    const embeddingRecord: EmbeddingRecord = {
      id: entryId,
      characterId,
      embedding,
      model,
      created_at: new Date().toISOString(),
    };

    await putRecord(MEMORY_EMBEDDINGS_FILE, entryId, embeddingRecord);
  }

  /**
   * Get embedding for a memory entry
   */
  static async getEmbedding(entryId: string): Promise<EmbeddingRecord | null> {
    return await getRecordByKey<EmbeddingRecord>(MEMORY_EMBEDDINGS_FILE, entryId);
  }

  /**
   * Get all embeddings for a character
   */
  static async getEmbeddingsByCharacter(characterId: string): Promise<EmbeddingRecord[]> {
    const embeddings = await getAllRecords<EmbeddingRecord>(MEMORY_EMBEDDINGS_FILE);
    return embeddings.filter(record => record.characterId === characterId);
  }

  /**
   * Delete embedding
   */
  static async deleteEmbedding(entryId: string): Promise<boolean> {
    const existing = await getRecordByKey<EmbeddingRecord>(MEMORY_EMBEDDINGS_FILE, entryId);
    if (!existing) return false;
    await deleteRecord(MEMORY_EMBEDDINGS_FILE, entryId);
    return true;
  }

  /**
   * Get memory analytics for a character
   */
  static async getMemoryAnalytics(characterId: string): Promise<MemoryAnalytics> {
    const entries = await this.getMemoryEntriesByCharacter(characterId);
    
    const entriesByType: Record<MemoryType, number> = {
      [MemoryType.FACT]: 0,
      [MemoryType.RELATIONSHIP]: 0,
      [MemoryType.EVENT]: 0,
      [MemoryType.PREFERENCE]: 0,
      [MemoryType.EMOTION]: 0,
      [MemoryType.GEOGRAPHY]: 0,
      [MemoryType.CONCEPT]: 0,
      [MemoryType.DIALOGUE]: 0,
    };

    let totalImportance = 0;
    let oldestEntry: MemoryEntry | undefined;
    let newestEntry: MemoryEntry | undefined;

    for (const entry of entries) {
      entriesByType[entry.type]++;
      totalImportance += entry.importance;

      if (!oldestEntry || new Date(entry.created_at) < new Date(oldestEntry.created_at)) {
        oldestEntry = entry;
      }
      if (!newestEntry || new Date(entry.created_at) > new Date(newestEntry.created_at)) {
        newestEntry = entry;
      }
    }

    const mostAccessedEntries = entries
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 5);

    return {
      totalEntries: entries.length,
      entriesByType,
      averageImportance: entries.length > 0 ? totalImportance / entries.length : 0,
      mostAccessedEntries,
      oldestEntry,
      newestEntry,
      memoryDensity: entries.length > 0 ? this.calculateMemoryDensity(entries) : 0,
    };
  }

  /**
   * Get RAG configuration for a character
   */
  static async getRAGConfig(characterId: string): Promise<MemoryRAGConfig> {
    const record = await this.getMemoryRecord(characterId);
    return record?.config || this.getDefaultRAGConfig();
  }

  /**
   * Update RAG configuration for a character
   */
  static async updateRAGConfig(
    characterId: string, 
    config: Partial<MemoryRAGConfig>,
  ): Promise<MemoryRAGConfig> {
    const record = await this.ensureMemoryRecord(characterId);
    record.config = { ...record.config, ...config };
    record.updated_at = new Date().toISOString();
    await this.saveMemoryRecord(record);
    return record.config;
  }

  /**
   * Clear all memories for a character
   */
  static async clearCharacterMemories(characterId: string): Promise<void> {
    const record = await this.getMemoryRecord(characterId);
    if (record) {
      await deleteRecord(MEMORY_ENTRIES_FILE, characterId);
    }

    const embeddings = await this.getEmbeddingsByCharacter(characterId);
    await Promise.all(
      embeddings.map(embedding => deleteRecord(MEMORY_EMBEDDINGS_FILE, embedding.id)),
    );
  }

  /**
   * Get default RAG configuration
   */
  private static getDefaultRAGConfig(): MemoryRAGConfig {
    return {
      embeddingModel: "text-embedding-3-small",
      chunkSize: 512,
      chunkOverlap: 50,
      topK: 5,
      similarityThreshold: 0.7,
      enableHybridSearch: true,
    };
  }

  /**
   * Calculate memory density (memories per day)
   */
  private static calculateMemoryDensity(entries: MemoryEntry[]): number {
    if (entries.length === 0) return 0;

    const oldest = Math.min(...entries.map(e => new Date(e.created_at).getTime()));
    const newest = Math.max(...entries.map(e => new Date(e.created_at).getTime()));
    const daysDiff = (newest - oldest) / (1000 * 60 * 60 * 24);
    
    return daysDiff > 0 ? entries.length / daysDiff : entries.length;
  }
} 
