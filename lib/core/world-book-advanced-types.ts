/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              World Book 高级功能 — 类型 · 缓存 · 常量                       ║
 * ║                                                                            ║
 * ║  从 world-book-advanced.ts 拆分出的基础设施层：                                ║
 * ║  1. 公共类型定义                                                             ║
 * ║  2. LRU 缓存管理器                                                          ║
 * ║  3. 来源优先级常量                                                           ║
 * ║  4. Token 估算工具                                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  WorldBookEntry,
  WorldBookSource,
} from "@/lib/models/world-book-model";

/* ═══════════════════════════════════════════════════════════════════════════
   公共类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

export interface WorldBookMatchOptions {
  /** 上下文窗口大小 (最近 N 条消息) */
  contextWindow?: number;
  /** 当前轮次 */
  currentTurn?: number;
  /** 是否启用概率激活 */
  enableProbability?: boolean;
  /** 是否启用时间效果 */
  enableTimeEffects?: boolean;
  /** 是否启用包含组 */
  enableInclusionGroups?: boolean;
  /** 是否启用递归激活 */
  enableRecursion?: boolean;
  /** 最大递归深度 (性能控制) */
  maxRecursionDepth?: number;
  /** Token 预算 (0 = 无限制) */
  tokenBudget?: number;
  /** 最小激活数 */
  minActivations?: number;
  /** 全局大小写敏感设置 */
  caseSensitive?: boolean;
  /** 全局全词匹配设置 */
  matchWholeWords?: boolean;
}

export interface MatchedEntry {
  entry: WorldBookEntry;
  matchReason: "constant" | "keyword" | "sticky" | "delay" | "recursive";
  depth?: number;
  /** 递归激活深度 */
  recursionLevel?: number;
  /** 匹配到的关键词 */
  matchedKeyword?: string;
}

export interface DepthInjection {
  content: string;
  depth: number;
  order: number;
}

export type ExtensionFields = Record<string, unknown>;

/* ═══════════════════════════════════════════════════════════════════════════
   缓存管理器（好品味：LRU 自动淘汰，无 if-else）
   ═══════════════════════════════════════════════════════════════════════════ */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class WorldBookCache {
  private cache = new Map<string, CacheEntry<WorldBookEntry[]>>();
  private maxAge: number;
  private maxSize: number;

  constructor(maxAge = 60_000, maxSize = 100) {
    this.maxAge = maxAge;
    this.maxSize = maxSize;
  }

  get(key: string): WorldBookEntry[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // 过期自动淘汰
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: WorldBookEntry[]): void {
    // LRU: 超过容量时删除最旧的
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  /** 使特定 key 的缓存失效 */
  invalidate(key: string): void {
    this.cache.delete(key);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   来源优先级常量
   ═══════════════════════════════════════════════════════════════════════════ */

export const SOURCE_PRIORITY: Record<WorldBookSource, number> = {
  chat: 4,
  persona: 3,
  character: 2,
  global: 1,
};

/* ═══════════════════════════════════════════════════════════════════════════
   Token 计数器（简化版，用于预算管理）
   ═══════════════════════════════════════════════════════════════════════════ */

export function estimateTokens(text: string): number {
  // 简化估算：平均 4 字符 = 1 token (英文)
  // 中文：平均 1.5 字符 = 1 token
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const otherCount = text.length - cjkCount;
  return Math.ceil(cjkCount / 1.5 + otherCount / 4);
}
