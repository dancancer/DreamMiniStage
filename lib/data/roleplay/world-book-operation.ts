import { 
  WORLD_BOOK_FILE, 
  clearStore, 
  getAllEntries, 
  getRecordByKey, 
  putRecord, 
} from "@/lib/data/local-storage";
import { WorldBookEntry } from "@/lib/models/world-book-model";

export interface WorldBookSettings {
  enabled: boolean;
  maxEntries: number;
  contextWindow: number;
  metadata?: any;
}

const DEFAULT_SETTINGS: WorldBookSettings = {
  enabled: true,
  maxEntries: 5,
  contextWindow: 5,
};

export class WorldBookOperations {
  static async getWorldBooks(): Promise<Record<string, any>> {
    const entries = await getAllEntries<any>(WORLD_BOOK_FILE);
    return entries.reduce<Record<string, any>>((acc, { key, value }) => {
      if (key) {
        acc[String(key)] = value;
      }
      return acc;
    }, {});
  }

  private static async saveWorldBooks(worldBooks: Record<string, any>): Promise<void> {
    await clearStore(WORLD_BOOK_FILE);
    for (const [key, value] of Object.entries(worldBooks)) {
      await putRecord(WORLD_BOOK_FILE, key, value);
    }
  }

  static async getWorldBook(characterId: string): Promise<Record<string, WorldBookEntry> | null> {
    try {
      const worldBook = await getRecordByKey<Record<string, WorldBookEntry>>(WORLD_BOOK_FILE, characterId);
      return worldBook || null;
    } catch (error) {
      console.error("Error getting world book:", error);
      return null;
    }
  }
  
  static async updateWorldBook(
    characterId: string, 
    worldBook: Record<string, WorldBookEntry> | WorldBookEntry[],
  ): Promise<boolean> {
    const worldBooks = await this.getWorldBooks();
    
    const processEntry = (entry: WorldBookEntry): WorldBookEntry => {
      return {
        ...entry,
        depth: entry.extensions?.depth ?? 1,
        position: entry.extensions?.position ?? 4,
      } as WorldBookEntry;
    };
    
    const entries = Array.isArray(worldBook) 
      ? worldBook.reduce((acc, entry, i) => {
        const processedEntry = processEntry(entry);
        return {
          ...acc,
          [`entry_${i}`]: processedEntry,
        };
      }, {} as Record<string, WorldBookEntry>)
      : Object.fromEntries(
        Object.entries(worldBook).map(([key, entry]) => {
          const processedEntry = processEntry(entry);
          return [key, processedEntry];
        }),
      );
    
    worldBooks[characterId] = entries;
    await this.saveWorldBooks(worldBooks);
    return true;
  }
  
  static async addWorldBookEntry(
    characterId: string, 
    entry: WorldBookEntry,
  ): Promise<string | null> {
    const worldBook = await this.getWorldBook(characterId) || {};
    
    const entryId = `entry_${Object.keys(worldBook).length}`;

    worldBook[entryId] = entry;
    
    const success = await this.updateWorldBook(characterId, worldBook);
    
    return success ? entryId : null;
  }
  
  static async updateWorldBookEntry(
    characterId: string, 
    entryId: string, 
    updates: Partial<WorldBookEntry>,
  ): Promise<boolean> {
    const worldBook = await this.getWorldBook(characterId);
    
    if (!worldBook || !worldBook[entryId]) {
      return false;
    }
    
    worldBook[entryId] = { ...worldBook[entryId], ...updates };
    
    return this.updateWorldBook(characterId, worldBook);
  }
  
  static async deleteWorldBookEntry(characterId: string, entryId: string): Promise<boolean> {
    const worldBook = await this.getWorldBook(characterId);
    
    if (!worldBook || !worldBook[entryId]) {
      return false;
    }
    
    delete worldBook[entryId];
    
    return this.updateWorldBook(characterId, worldBook);
  }
  
  static async getWorldBookSettings(characterId: string): Promise<WorldBookSettings> {
    const settings = await getRecordByKey<WorldBookSettings>(WORLD_BOOK_FILE, `${characterId}_settings`);
    
    if (!settings) {
      return { ...DEFAULT_SETTINGS };
    }
    
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
    };
  }
  
  static async updateWorldBookSettings(
    characterId: string,
    updates: Partial<WorldBookSettings>,
  ): Promise<WorldBookSettings> {
    const worldBooks = await this.getWorldBooks();
    const currentSettings = await this.getWorldBookSettings(characterId);
    const newSettings = { ...currentSettings, ...updates };
    
    worldBooks[`${characterId}_settings`] = newSettings;
    await this.saveWorldBooks(worldBooks);
    
    return newSettings;
  }

  static async deleteWorldBook(characterId: string): Promise<boolean> {
    try {
      const worldBooks = await this.getWorldBooks();
      let changed = false;

      if (worldBooks[characterId]) {
        delete worldBooks[characterId];
        changed = true;
      }

      if (worldBooks[`${characterId}_settings`]) {
        delete worldBooks[`${characterId}_settings`];
        changed = true;
      }

      if (!changed) return false;

      await this.saveWorldBooks(worldBooks);
      return true;
    } catch (error) {
      console.error("Error deleting world book:", error);
      return false;
    }
  }
}
