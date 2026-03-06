/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                     Vector Runtime Settings                              ║
 * ║                                                                          ║
 * ║  chat/files/worldinfo 共用的向量运行时开关与数值配置单一路径                 ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

export interface VectorRuntimeSettings {
  enabledChats: boolean;
  enabledFiles: boolean;
  query: number;
  scoreThreshold: number;
  maxEntries: number;
}

const STORAGE_KEY = "dreamministage.vector-runtime-settings";

const DEFAULT_VECTOR_RUNTIME_SETTINGS: VectorRuntimeSettings = {
  enabledChats: false,
  enabledFiles: false,
  query: 2,
  scoreThreshold: 0.25,
  maxEntries: 5,
};

let cachedSettings: VectorRuntimeSettings | null = null;

function clampPositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function clampThreshold(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }
  return parsed;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function normalizeSettings(value: unknown): VectorRuntimeSettings {
  const candidate = (value && typeof value === "object")
    ? value as Partial<VectorRuntimeSettings>
    : {};

  return {
    enabledChats: toBoolean(candidate.enabledChats, DEFAULT_VECTOR_RUNTIME_SETTINGS.enabledChats),
    enabledFiles: toBoolean(candidate.enabledFiles, DEFAULT_VECTOR_RUNTIME_SETTINGS.enabledFiles),
    query: clampPositiveInteger(candidate.query, DEFAULT_VECTOR_RUNTIME_SETTINGS.query),
    scoreThreshold: clampThreshold(candidate.scoreThreshold, DEFAULT_VECTOR_RUNTIME_SETTINGS.scoreThreshold),
    maxEntries: clampPositiveInteger(candidate.maxEntries, DEFAULT_VECTOR_RUNTIME_SETTINGS.maxEntries),
  };
}

function readStoredSettings(): VectorRuntimeSettings {
  if (cachedSettings) {
    return { ...cachedSettings };
  }

  if (typeof window === "undefined") {
    cachedSettings = { ...DEFAULT_VECTOR_RUNTIME_SETTINGS };
    return { ...cachedSettings };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    cachedSettings = { ...DEFAULT_VECTOR_RUNTIME_SETTINGS };
    return { ...cachedSettings };
  }

  try {
    cachedSettings = normalizeSettings(JSON.parse(raw));
  } catch {
    cachedSettings = { ...DEFAULT_VECTOR_RUNTIME_SETTINGS };
  }

  return { ...cachedSettings };
}

function writeStoredSettings(next: VectorRuntimeSettings): VectorRuntimeSettings {
  cachedSettings = { ...next };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedSettings));
  }
  return { ...cachedSettings };
}

function updateSettings(patch: Partial<VectorRuntimeSettings>): VectorRuntimeSettings {
  return writeStoredSettings(normalizeSettings({
    ...readStoredSettings(),
    ...patch,
  }));
}

export function getVectorChatsState(): boolean {
  return readStoredSettings().enabledChats;
}

export function setVectorChatsState(enabled: boolean): boolean {
  return updateSettings({ enabledChats: enabled }).enabledChats;
}

export function getVectorFilesState(): boolean {
  return readStoredSettings().enabledFiles;
}

export function setVectorFilesState(enabled: boolean): boolean {
  return updateSettings({ enabledFiles: enabled }).enabledFiles;
}

export function getVectorQuerySetting(): number {
  return readStoredSettings().query;
}

export function setVectorQuerySetting(query: number): number {
  return updateSettings({ query }).query;
}

export function getVectorThresholdSetting(): number {
  return readStoredSettings().scoreThreshold;
}

export function setVectorThresholdSetting(scoreThreshold: number): number {
  return updateSettings({ scoreThreshold }).scoreThreshold;
}

export function getVectorMaxEntriesSetting(): number {
  return readStoredSettings().maxEntries;
}

export function setVectorMaxEntriesSetting(maxEntries: number): number {
  return updateSettings({ maxEntries }).maxEntries;
}
