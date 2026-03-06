/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                     Secret Command Handlers                              ║
 * ║                                                                          ║
 * ║  密钥命令：secret-write/read/id/delete/rename                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { useModelStore } from "@/lib/store/model-store";
import type { CommandHandler } from "../types";
import { parseBoolean, pickText } from "../utils/helpers";

const SECRET_STORE_STORAGE_KEY = "dreamministage.secret-store";
const SECRET_PROVIDER_STORAGE_KEYS: Record<string, string | undefined> = {
  openai: "openaiApiKey",
  gemini: "geminiApiKey",
};
const CURRENT_PROVIDER_STORAGE_KEY = "llmType";
const GENERIC_API_KEY_STORAGE_KEY = "apiKey";

type SecretEntry = {
  id: string;
  label: string;
  value: string;
  active: boolean;
};

type SecretStore = Record<string, SecretEntry[]>;

function readStorageValue(storageKey: string): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(storageKey) || "";
  } catch {
    return "";
  }
}

function writeStorageValue(storageKey: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (value) {
      window.localStorage.setItem(storageKey, value);
      return;
    }
    window.localStorage.removeItem(storageKey);
  } catch {
    // 忽略浏览器存储失败，Slash 结果仍以命令返回值为准
  }
}

function readSecretStore(): SecretStore {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(SECRET_STORE_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as SecretStore;
  } catch {
    return {};
  }
}

function writeSecretStore(store: SecretStore): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SECRET_STORE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // 忽略浏览器存储失败，Slash 结果仍以命令返回值为准
  }
}

function normalizeSecretEntries(entries: SecretEntry[]): SecretEntry[] {
  const normalized = entries
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => ({
      id: String(entry.id || `secret-${index + 1}`),
      label: String(entry.label || entry.id || `secret-${index + 1}`),
      value: String(entry.value || ""),
      active: Boolean(entry.active),
    }));

  if (normalized.length === 0) {
    return [];
  }

  const activeIndex = normalized.findIndex((entry) => entry.active);
  const targetIndex = activeIndex >= 0 ? activeIndex : 0;
  return normalized.map((entry, index) => ({
    ...entry,
    active: index === targetIndex,
  }));
}

function updateActiveEntry(entries: SecretEntry[], targetId: string): SecretEntry[] {
  return entries.map((entry) => ({
    ...entry,
    active: entry.id === targetId,
  }));
}

function buildSecretId(key: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${key}-${timestamp}-${randomPart}`;
}

function buildSecretLabel(): string {
  return new Date().toISOString();
}

function normalizeSecretKey(raw: string | undefined): string {
  const key = (raw || "").trim().toLowerCase();
  if (key) {
    return key;
  }

  const currentProvider = readStorageValue(CURRENT_PROVIDER_STORAGE_KEY).trim().toLowerCase();
  if (currentProvider === "gemini" || currentProvider === "ollama" || currentProvider === "openai") {
    return currentProvider;
  }

  return "openai";
}

function parseOptionalFlag(
  raw: string | undefined,
  commandName: string,
  flagName: string,
  defaultValue: boolean,
): boolean {
  const parsed = parseBoolean(raw, undefined);
  if (raw !== undefined && parsed === undefined) {
    throw new Error(`/${commandName} invalid ${flagName} value: ${raw}`);
  }
  return parsed ?? defaultValue;
}

function bootstrapProviderSecret(key: string): SecretEntry[] {
  const providerStorageKey = SECRET_PROVIDER_STORAGE_KEYS[key];
  if (!providerStorageKey) {
    return [];
  }

  const value = readStorageValue(providerStorageKey);
  if (!value) {
    return [];
  }

  return [{
    id: `${key}-active`,
    label: `${key}-active`,
    value,
    active: true,
  }];
}

function loadSecretEntries(key: string): SecretEntry[] {
  const store = readSecretStore();
  const existing = normalizeSecretEntries(Array.isArray(store[key]) ? store[key] : []);
  if (existing.length > 0) {
    return existing;
  }

  const bootstrapped = bootstrapProviderSecret(key);
  if (bootstrapped.length === 0) {
    return [];
  }

  store[key] = bootstrapped;
  writeSecretStore(store);
  return bootstrapped;
}

function syncProviderSecret(key: string, activeValue: string): void {
  const providerStorageKey = SECRET_PROVIDER_STORAGE_KEYS[key];
  if (!providerStorageKey) {
    return;
  }

  writeStorageValue(providerStorageKey, activeValue);
  const currentProvider = normalizeSecretKey(readStorageValue(CURRENT_PROVIDER_STORAGE_KEY));
  if (currentProvider === key) {
    writeStorageValue(GENERIC_API_KEY_STORAGE_KEY, activeValue);
  }

  const modelStore = useModelStore.getState();
  const activeConfig = modelStore.getConfigById(modelStore.activeConfigId);
  if (activeConfig?.type === key) {
    modelStore.updateConfig(activeConfig.id, { apiKey: activeValue || undefined });
  }
}

function persistSecretEntries(key: string, entries: SecretEntry[]): SecretEntry[] {
  const store = readSecretStore();
  const normalized = normalizeSecretEntries(entries);

  if (normalized.length === 0) {
    delete store[key];
    writeSecretStore(store);
    syncProviderSecret(key, "");
    return [];
  }

  store[key] = normalized;
  writeSecretStore(store);
  const activeValue = normalized.find((entry) => entry.active)?.value || "";
  syncProviderSecret(key, activeValue);
  return normalized;
}

function requireSecretEntries(key: string, commandName: string): SecretEntry[] {
  const entries = loadSecretEntries(key);
  if (entries.length > 0) {
    return entries;
  }
  throw new Error(`/${commandName} has no saved secrets for key: ${key}`);
}

function findSecretEntry(
  entries: SecretEntry[],
  target: string,
  commandName: string,
  key: string,
): SecretEntry {
  if (!target) {
    const active = entries.find((entry) => entry.active);
    if (active) {
      return active;
    }
    throw new Error(`/${commandName} has no active secret for key: ${key}`);
  }

  const found = entries.find((entry) => entry.id === target)
    || entries.find((entry) => entry.label === target);
  if (found) {
    return found;
  }

  throw new Error(`/${commandName} could not find secret '${target}' for key: ${key}`);
}

/** /secret-write [value] - 写入密钥并切为当前激活项 */
export const handleSecretWrite: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  parseOptionalFlag(namedArgs.quiet, "secret-write", "quiet", false);
  const allowEmpty = parseOptionalFlag(namedArgs.empty, "secret-write", "empty", false);
  const key = normalizeSecretKey(namedArgs.key);
  const value = pickText(args, pipe).trim();

  if (!value && !allowEmpty) {
    throw new Error("/secret-write requires a secret value");
  }

  const entries = loadSecretEntries(key);
  const nextEntry: SecretEntry = {
    id: buildSecretId(key),
    label: (namedArgs.label || "").trim() || buildSecretLabel(),
    value,
    active: true,
  };
  persistSecretEntries(key, updateActiveEntry([...entries, nextEntry], nextEntry.id));
  return nextEntry.id;
};

/** /secret-read [id|label] - 读取指定或当前激活密钥值 */
export const handleSecretRead: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  parseOptionalFlag(namedArgs.quiet, "secret-read", "quiet", false);
  const key = normalizeSecretKey(namedArgs.key);
  const entries = requireSecretEntries(key, "secret-read");
  const target = pickText(args, pipe).trim();
  return findSecretEntry(entries, target, "secret-read", key).value;
};

/** /secret-id [id|label] - 读取或切换当前激活密钥 */
export const handleSecretId: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  parseOptionalFlag(namedArgs.quiet, "secret-id", "quiet", false);
  const key = normalizeSecretKey(namedArgs.key);
  const entries = requireSecretEntries(key, "secret-id");
  const target = pickText(args, pipe).trim();
  const found = findSecretEntry(entries, target, "secret-id", key);

  if (!target) {
    return found.id;
  }

  persistSecretEntries(key, updateActiveEntry(entries, found.id));
  return found.id;
};

/** /secret-delete [id|label] - 删除指定或当前激活密钥 */
export const handleSecretDelete: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  parseOptionalFlag(namedArgs.quiet, "secret-delete", "quiet", false);
  const key = normalizeSecretKey(namedArgs.key);
  const entries = requireSecretEntries(key, "secret-delete");
  const target = pickText(args, pipe).trim();
  const found = findSecretEntry(entries, target, "secret-delete", key);
  const nextEntries = entries.filter((entry) => entry.id !== found.id);
  persistSecretEntries(key, nextEntries);
  return found.id;
};

/** /secret-rename <label> - 重命名指定密钥 */
export const handleSecretRename: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  parseOptionalFlag(namedArgs.quiet, "secret-rename", "quiet", false);
  const key = normalizeSecretKey(namedArgs.key);
  const target = (namedArgs.id || "").trim();
  const nextLabel = pickText(args, pipe).trim();

  if (!target) {
    throw new Error("/secret-rename requires id=<secret-id|label>");
  }
  if (!nextLabel) {
    throw new Error("/secret-rename requires a new label");
  }

  const entries = requireSecretEntries(key, "secret-rename");
  const found = findSecretEntry(entries, target, "secret-rename", key);
  const nextEntries = entries.map((entry) => {
    if (entry.id !== found.id) {
      return entry;
    }
    return {
      ...entry,
      label: nextLabel,
    };
  });

  persistSecretEntries(key, nextEntries);
  return found.id;
};
