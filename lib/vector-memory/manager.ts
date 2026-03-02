/* ╔════════════════════════════════════════════════════════════════════════╗
 * ║                          向量记忆管理器                                 ║
 * ║     提供会话级写入与检索，包含安全的禁用/回退逻辑                        ║
 * ╚════════════════════════════════════════════════════════════════════════╝ */

import { resolveEmbeddingProvider, type EmbeddingProvider, type ProviderConfig, NoopEmbeddingProvider } from "./provider";
import { createVectorMemoryStore, VectorMemoryStore, type VectorMemoryRecord } from "./store";

export interface VectorMemoryEntryInput {
  id?: string;
  role: "user" | "assistant" | "system";
  source: string;
  content: string;
  createdAt?: number;
}

export interface VectorMemoryOptions {
  enabled?: boolean;
  topK?: number;
  maxContextChars?: number;
  provider?: EmbeddingProvider;
  providerConfig?: ProviderConfig;
  store?: VectorMemoryStore;
}

const DEFAULT_MAX_CONTEXT = 1500;
const PREF_KEY = "vector_memory_enabled";

export class VectorMemoryManager {
  private enabled: boolean;
  private topK: number;
  private maxContextChars: number;
  private provider: EmbeddingProvider;
  private store: VectorMemoryStore;

  constructor(options: VectorMemoryOptions = {}) {
    const envEnabled = process.env.VECTOR_MEMORY_ENABLED === "true"
      || process.env.NEXT_PUBLIC_VECTOR_MEMORY_ENABLED === "true";

    const preference = loadVectorMemoryPreference();
    const providerConfig = options.providerConfig || {};
    const resolvedProvider = options.provider || resolveEmbeddingProvider(providerConfig).provider;
    const hasUsableProvider = !(resolvedProvider instanceof NoopEmbeddingProvider);

    this.enabled = options.enabled ?? preference ?? (envEnabled || hasUsableProvider);
    this.topK = options.topK ?? Number(process.env.VECTOR_MEMORY_TOPK || 5);
    this.maxContextChars = options.maxContextChars ?? DEFAULT_MAX_CONTEXT;
    this.provider = resolvedProvider;
    this.store = options.store || createVectorMemoryStore();

    if (!this.enabled) {
      this.provider = new NoopEmbeddingProvider();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    saveVectorMemoryPreference(enabled);
    if (!enabled) {
      this.provider = new NoopEmbeddingProvider();
    }
  }

  async ingest(sessionId: string, entries: VectorMemoryEntryInput[]): Promise<{
    stored: number;
    skipped: number;
    reason?: string;
  }> {
    if (!this.enabled) {
      return { stored: 0, skipped: entries.length, reason: "vector memory disabled" };
    }

    const valid = entries.filter((e) => e.content && e.content.trim().length > 0);
    if (valid.length === 0) {
      return { stored: 0, skipped: entries.length, reason: "empty payload" };
    }

    const records: VectorMemoryRecord[] = [];
    for (const entry of valid) {
      try {
        const embedding = await this.provider.embed(trimContent(entry.content));
        if (!embedding || embedding.length === 0) continue;
        records.push({
          id: entry.id || safeId(),
          sessionId,
          role: entry.role,
          source: entry.source,
          content: trimContent(entry.content),
          embedding,
          createdAt: entry.createdAt || Date.now(),
        });
      } catch (error) {
        console.warn("[VectorMemory] embed failed:", error);
      }
    }

    if (records.length === 0) {
      return { stored: 0, skipped: entries.length, reason: "no embeddings generated" };
    }

    try {
      await this.store.add(records);
      return { stored: records.length, skipped: entries.length - records.length };
    } catch (error) {
      console.error("[VectorMemory] persist failed:", error);
      return { stored: 0, skipped: entries.length, reason: "persist failed" };
    }
  }

  async retrieve(params: {
    sessionId: string;
    query: string;
    topK?: number;
  }): Promise<{
    results: Array<VectorMemoryRecord & { score: number }>;
    formattedText: string;
  }> {
    const { sessionId, query, topK } = params;
    if (!this.enabled) {
      return { results: [], formattedText: "" };
    }

    const preparedQuery = trimContent(query);
    if (!preparedQuery) {
      return { results: [], formattedText: "" };
    }

    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await this.provider.embed(preparedQuery);
    } catch (error) {
      console.warn("[VectorMemory] query embed failed:", error);
      return { results: [], formattedText: "" };
    }

    const searchResults = await this.store.search(queryEmbedding, {
      topK: topK ?? this.topK,
      sessionId,
    });

    const scored = searchResults.map((result) => ({
      id: result.document.id,
      sessionId,
      role: (result.document.metadata?.role as VectorMemoryRecord["role"]) || "assistant",
      source: (result.document.metadata?.source as string) || "unknown",
      content: result.document.content,
      embedding: result.document.embedding,
      createdAt: result.document.timestamp || 0,
      score: result.score,
    }));

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.createdAt - a.createdAt;
    });

    const limited = scored.slice(0, topK ?? this.topK);
    return {
      results: limited,
      formattedText: formatResults(limited, this.maxContextChars),
    };
  }
}

let sharedManager: VectorMemoryManager | null = null;

export function getVectorMemoryManager(): VectorMemoryManager {
  if (!sharedManager) {
    sharedManager = new VectorMemoryManager();
  }
  return sharedManager;
}

export function setVectorMemoryEnabled(enabled: boolean): void {
  const manager = getVectorMemoryManager();
  manager.setEnabled(enabled);
}

export function isVectorMemoryEnabled(): boolean {
  return getVectorMemoryManager().isEnabled();
}

function trimContent(content: string, maxLength = 2000): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}...`;
}

function safeId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `vm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatResults(results: Array<VectorMemoryRecord & { score: number }>, maxChars: number): string {
  if (!results.length) return "";
  const lines: string[] = [];
  let remaining = maxChars;

  lines.push("向量记忆检索：");
  remaining -= lines[0].length;

  for (let i = 0; i < results.length; i++) {
    const line = `${i + 1}. [${results[i].source}] ${results[i].content}`;
    if (line.length > remaining) break;
    lines.push(line);
    remaining -= line.length;
  }

  return lines.join("\n");
}

function loadVectorMemoryPreference(): boolean | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem(PREF_KEY);
  if (raw === null) return undefined;
  return raw === "true";
}

function saveVectorMemoryPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREF_KEY, String(enabled));
}
