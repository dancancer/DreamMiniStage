import { z } from "zod";

const DB_NAME = "CharacterAppDB";
const DB_VERSION = 12;

export const CHARACTERS_RECORD_FILE = "characters_record";
export const CHARACTER_DIALOGUES_FILE = "character_dialogues";
export const CHARACTER_IMAGES_FILE = "character_images";
export const WORLD_BOOK_FILE = "world_book";
export const REGEX_SCRIPTS_FILE = "regex_scripts";
export const PRESET_FILE = "preset_data";
export const SESSIONS_RECORD_FILE = "sessions_record";

// Agent-related storage constants  
export const AGENT_CONVERSATIONS_FILE = "agent_conversations";

// Memory/RAG storage constants
export const MEMORY_ENTRIES_FILE = "memory_entries";
export const MEMORY_EMBEDDINGS_FILE = "memory_embeddings";

// ================================
// IndexedDB 底座封装
// ================================

const STORE_NAMES = [
  CHARACTERS_RECORD_FILE,
  CHARACTER_DIALOGUES_FILE,
  CHARACTER_IMAGES_FILE,
  WORLD_BOOK_FILE,
  REGEX_SCRIPTS_FILE,
  PRESET_FILE,
  SESSIONS_RECORD_FILE,
  AGENT_CONVERSATIONS_FILE,
  MEMORY_ENTRIES_FILE,
  MEMORY_EMBEDDINGS_FILE,
];

// 仍然保持旧的“data”数组模式的仓库
const ARRAY_STORES: string[] = [];

// 迁移到按记录存储的仓库
const RECORD_STORES: Array<string> = [
  CHARACTERS_RECORD_FILE,
  CHARACTER_DIALOGUES_FILE,
  SESSIONS_RECORD_FILE,
  AGENT_CONVERSATIONS_FILE,
  MEMORY_ENTRIES_FILE,
  MEMORY_EMBEDDINGS_FILE,
  WORLD_BOOK_FILE,
  REGEX_SCRIPTS_FILE,
  PRESET_FILE,
];

const IMAGE_BATCH_SIZE = 10;
const RECORD_BATCH_SIZE = 50;

const BackupSchema = z.object({
  [WORLD_BOOK_FILE]: z.array(z.any()).optional(),
  [REGEX_SCRIPTS_FILE]: z.array(z.any()).optional(),
  [PRESET_FILE]: z.array(z.any()).optional(),
  [CHARACTERS_RECORD_FILE]: z.array(z.any()).optional(),
  [CHARACTER_DIALOGUES_FILE]: z.array(z.any()).optional(),
  [SESSIONS_RECORD_FILE]: z.array(z.any()).optional(),
  [AGENT_CONVERSATIONS_FILE]: z.array(z.any()).optional(),
  [MEMORY_ENTRIES_FILE]: z.array(z.any()).optional(),
  [MEMORY_EMBEDDINGS_FILE]: z.array(z.any()).optional(),
  [CHARACTER_IMAGES_FILE]: z.array(
    z.object({
      key: z.string(),
      data: z.string(),
    }),
  ).optional(),
}).passthrough();

let dbPromise: Promise<IDBDatabase> | null = null;
let initPromise: Promise<void> | null = null;

function assertIndexedDB(): IDBFactory {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment");
  }
  return indexedDB;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  const idb = assertIndexedDB();

  dbPromise = new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      STORE_NAMES.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      });
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error("Failed to open IndexedDB"));
    };

    request.onblocked = () => {
      console.warn("IndexedDB upgrade blocked. Close other tabs to continue.");
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });

  return dbPromise;
}

async function ensureDataStoresInitialized(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const db = await openDB();

    await Promise.all(ARRAY_STORES.map(async storeName => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const existing = await promisify(store.get("data"));
      if (existing === undefined) {
        await promisify(store.put([], "data"));
      }
    }));

    await migrateLegacyArrays(db);
  })();

  return initPromise;
}

export async function readData(storeName: string): Promise<any[]> {
  await ensureDataStoresInitialized();
  const db = await openDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const result = await promisify(store.get("data"));
  return result !== undefined ? (result as any[]) : [];
}

export async function writeData(storeName: string, data: any[]): Promise<void> {
  await ensureDataStoresInitialized();
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  await promisify(store.put(data, "data"));
}

export async function initializeDataFiles(): Promise<void> {
  await ensureDataStoresInitialized();
}

export async function setBlob(key: string, blob: Blob): Promise<void> {
  await ensureDataStoresInitialized();
  const db = await openDB();
  const tx = db.transaction(CHARACTER_IMAGES_FILE, "readwrite");
  const store = tx.objectStore(CHARACTER_IMAGES_FILE);
  await promisify(store.put(blob, key));
}

export async function getBlob(key: string): Promise<Blob | null> {
  await ensureDataStoresInitialized();
  const db = await openDB();
  const tx = db.transaction(CHARACTER_IMAGES_FILE, "readonly");
  const store = tx.objectStore(CHARACTER_IMAGES_FILE);
  const result = await promisify(store.get(key));
  return (result as Blob | null) || null;
}

export async function deleteBlob(key: string): Promise<void> {
  await ensureDataStoresInitialized();
  const db = await openDB();
  const tx = db.transaction(CHARACTER_IMAGES_FILE, "readwrite");
  const store = tx.objectStore(CHARACTER_IMAGES_FILE);
  await promisify(store.delete(key));
}

// ================================
// 记录级通用 API
// ================================

export async function getRecordByKey<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  await ensureDataStoresInitialized();
  const db = await openDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const result = await promisify(store.get(key));
  return (result as T) || null;
}

export async function getAllRecords<T>(storeName: string): Promise<T[]> {
  await ensureDataStoresInitialized();
  const db = await openDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  return (await promisify(store.getAll())) as T[];
}

export async function getAllEntries<T>(storeName: string): Promise<Array<{ key: IDBValidKey; value: T }>> {
  await ensureDataStoresInitialized();
  const db = await openDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const [keys, values] = await Promise.all([
    promisify(store.getAllKeys()),
    promisify(store.getAll()),
  ]);
  const entries: Array<{ key: IDBValidKey; value: T }> = [];
  (keys as IDBValidKey[]).forEach((key, index) => {
    entries.push({ key, value: (values as T[])[index] });
  });
  return entries;
}

export async function putRecord<T>(storeName: string, key: IDBValidKey, value: T): Promise<void> {
  await ensureDataStoresInitialized();
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  await promisify(store.put(value, key));
}

export async function putRecords<T>(storeName: string, records: T[], keySelector: (record: T) => IDBValidKey): Promise<void> {
  await ensureDataStoresInitialized();
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  for (const record of records) {
    await promisify(store.put(record, keySelector(record)));
  }
}

export async function deleteRecord(storeName: string, key: IDBValidKey): Promise<void> {
  await ensureDataStoresInitialized();
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  await promisify(store.delete(key));
}

export async function clearStore(storeName: string): Promise<void> {
  await ensureDataStoresInitialized();
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  await promisify(store.clear());
}

export async function exportAllData(): Promise<Record<string, any>> {
  const db = await openDB();
  const exportData: Record<string, any> = {};
  
  // Handle array-based stores
  for (const storeName of ARRAY_STORES) {
    const data = await readData(storeName);
    exportData[storeName] = data;
  }

  // Handle record-based stores
  for (const storeName of RECORD_STORES) {
    const entries = await getAllEntries<any>(storeName);
    exportData[storeName] = entries.map(({ key, value }) => {
      if (value && typeof value === "object" && value.id === undefined) {
        return { ...value, id: key };
      }
      return value;
    });
  }

  // Handle image data separately
  const imageBlobs: Array<{key: string, data: string}> = [];
  
  // Get all keys from the image store
  const tx = db.transaction(CHARACTER_IMAGES_FILE, "readonly");
  const store = tx.objectStore(CHARACTER_IMAGES_FILE);
  const keys = await promisify(store.getAllKeys()) as string[];

  // Read each image blob and convert to base64
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    const blob = await getBlob(key);
    if (blob && blob instanceof Blob) {
      try {
        const base64 = await blobToBase64(blob);
        imageBlobs.push({ key, data: base64 });
      } catch (error) {
        console.error(`Failed to convert image ${key} to base64:`, error);
      }
    }
    if ((index + 1) % IMAGE_BATCH_SIZE === 0) {
      await yieldToMain();
    }
  }
  
  exportData[CHARACTER_IMAGES_FILE] = imageBlobs;

  return exportData;
}

export async function importAllData(data: Record<string, any>): Promise<void> {
  const payload = validateBackupPayload(data);
  
  // Array-based stores: full replace
  for (const storeName of ARRAY_STORES) {
    if (Array.isArray(payload[storeName])) {
      await writeData(storeName, payload[storeName]);
    }
  }

  // Record-based stores: clear then bulk put（分批防止长时间阻塞）
  for (const storeName of RECORD_STORES) {
    const records = payload[storeName];
    if (!Array.isArray(records)) continue;
    await clearStore(storeName);
    for (let i = 0; i < records.length; i += RECORD_BATCH_SIZE) {
      const batch = records.slice(i, i + RECORD_BATCH_SIZE);
      await putRecords(storeName, batch, (record: any) => selectRecordKey(storeName, record));
      if (i > 0 && i % (RECORD_BATCH_SIZE * 2) === 0) {
        await yieldToMain();
      }
    }
  }

  // Handle image data separately
  if (Array.isArray(payload[CHARACTER_IMAGES_FILE])) {
    const images = payload[CHARACTER_IMAGES_FILE];
    for (let i = 0; i < images.length; i++) {
      const item = images[i];
      if (typeof item?.data === "string") {
        const blob = await base64ToBlob(item.data);
        await setBlob(item.key, blob);
      }
      if ((i + 1) % IMAGE_BATCH_SIZE === 0) {
        await yieldToMain();
      }
    }
  }
}

// Helper function to convert Blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  if (!(blob instanceof Blob)) {
    throw new Error("Input is not a valid Blob object");
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert blob to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper function to convert base64 to Blob
async function base64ToBlob(base64: string): Promise<Blob> {
  const response = await fetch(base64);
  return response.blob();
}

async function yieldToMain(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
}

function validateBackupPayload(payload: Record<string, any>): Record<string, any> {
  const parsed = BackupSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Invalid backup payload");
  }
  return parsed.data;
}

function selectRecordKey(storeName: string, record: any): IDBValidKey {
  const key =
    record?.id ||
    record?.key ||
    record?.ownerId ||
    record?.name ||
    record?.identifier ||
    record?.characterId;

  if (key) {
    return key as IDBValidKey;
  }
  throw new Error(`Invalid record key for store ${storeName}`);
}

// ================================
// 迁移辅助
// ================================

type LegacyKeySelector = (record: any) => IDBValidKey | null;

const LEGACY_KEY_SELECTORS: Record<string, LegacyKeySelector> = {
  [CHARACTERS_RECORD_FILE]: (record) => record?.id || null,
  [CHARACTER_DIALOGUES_FILE]: (record) => record?.id || record?.character_id || null,
  [AGENT_CONVERSATIONS_FILE]: (record) => record?.id || null,
  [MEMORY_ENTRIES_FILE]: (record) => record?.characterId || record?.id || null,
  [MEMORY_EMBEDDINGS_FILE]: (record) => record?.id || null,
  [WORLD_BOOK_FILE]: () => null,
  [REGEX_SCRIPTS_FILE]: () => null,
  [PRESET_FILE]: () => null,
};

async function migrateLegacyArrays(db: IDBDatabase): Promise<void> {
  await Promise.all(
    Object.entries(LEGACY_KEY_SELECTORS).map(async ([storeName, getKey]) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);

      const keys = await promisify(store.getAllKeys());
      const hasNonDataKey = (keys as IDBValidKey[]).some(key => key !== "data");
      if (hasNonDataKey) {
        return;
      }

      const legacy = await promisify(store.get("data"));
      if (!Array.isArray(legacy) || legacy.length === 0) {
        return;
      }

      const [first] = legacy;

      // 特殊：原本以单对象承载所有数据的仓库（world_book/regex_scripts/preset）
      if ((storeName === WORLD_BOOK_FILE || storeName === REGEX_SCRIPTS_FILE || storeName === PRESET_FILE) && first && typeof first === "object") {
        for (const [key, value] of Object.entries(first as Record<string, any>)) {
          await promisify(store.put(value, key));
        }
      } else {
        for (const record of legacy) {
          const key = getKey(record);
          if (key === null) {
            continue;
          }
          if (storeName === CHARACTERS_RECORD_FILE && record && record.order === undefined) {
            const timestamp = record.updated_at || record.created_at;
            record.order = timestamp ? Date.parse(timestamp) : Date.now();
          }
          await promisify(store.put(record, key));
        }
      }

      await promisify(store.delete("data"));
    }),
  );
}
