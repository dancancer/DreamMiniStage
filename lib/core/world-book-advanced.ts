/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    World Book 高级功能管理器                                ║
 * ║                                                                            ║
 * ║  实现 SillyTavern 兼容的高级 World Info 功能：                               ║
 * ║  1. 全词匹配 + 大小写敏感                                                    ║
 * ║  2. 递归激活（带性能控制）                                                   ║
 * ║  3. Token 预算管理                                                          ║
 * ║  4. 包含组评分系统                                                          ║
 * ║  5. 可配置扫描深度                                                          ║
 * ║  6. 最小激活数保证                                                          ║
 * ║  7. 缓存机制                                                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  WorldBookEntry,
  WorldBookEntryWithSource,
  WorldBookSource,
  SecondaryKeyLogic,
} from "@/lib/models/world-book-model";
import type { DialogueMessage } from "@/lib/models/character-dialogue-model";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
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

/* ═══════════════════════════════════════════════════════════════════════════
   缓存管理器（好品味：LRU 自动淘汰，无 if-else）
   ═══════════════════════════════════════════════════════════════════════════ */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class WorldBookCache {
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

const SOURCE_PRIORITY: Record<WorldBookSource, number> = {
  chat: 4,
  persona: 3,
  character: 2,
  global: 1,
};

/* ═══════════════════════════════════════════════════════════════════════════
   Token 计数器（简化版，用于预算管理）
   ═══════════════════════════════════════════════════════════════════════════ */

function estimateTokens(text: string): number {
  // 简化估算：平均 4 字符 = 1 token (英文)
  // 中文：平均 1.5 字符 = 1 token
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const otherCount = text.length - cjkCount;
  return Math.ceil(cjkCount / 1.5 + otherCount / 4);
}

/* ═══════════════════════════════════════════════════════════════════════════
   WorldBookAdvancedManager 类
   ═══════════════════════════════════════════════════════════════════════════ */

export class WorldBookAdvancedManager {
  private entries: WorldBookEntryWithSource[] = [];
  private currentTurn: number = 0;
  private cache: WorldBookCache;

  constructor(cacheMaxAge = 60_000) {
    this.cache = new WorldBookCache(cacheMaxAge);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     条目管理
     ───────────────────────────────────────────────────────────────────────── */

  addEntries(entries: WorldBookEntry[], source: WorldBookSource): void {
    const withSource = entries.map((entry) => ({
      ...entry,
      source,
      sourcePriority: SOURCE_PRIORITY[source],
    }));
    this.entries.push(...withSource);
  }

  clearEntries(): void {
    this.entries = [];
    this.cache.clear();
  }

  setCurrentTurn(turn: number): void {
    this.currentTurn = turn;
  }

  advanceTurn(): void {
    this.currentTurn++;
    this.updateTimeEffects();
  }

  /* ─────────────────────────────────────────────────────────────────────────
     核心匹配逻辑（重构：支持递归激活 + 预算管理）
     ───────────────────────────────────────────────────────────────────────── */

  getMatchingEntries(
    message: string,
    chatHistory: DialogueMessage[],
    options: WorldBookMatchOptions = {},
  ): MatchedEntry[] {
    const {
      contextWindow = 5,
      enableProbability = true,
      enableTimeEffects = true,
      enableInclusionGroups = true,
      enableRecursion = false,
      maxRecursionDepth = 3,
      tokenBudget = 0,
      minActivations = 0,
      caseSensitive = false,
      matchWholeWords = false,
    } = options;

    // 构建初始扫描文本
    const recentMessages = chatHistory
      .slice(-contextWindow)
      .map((m) => m.content)
      .join(" ");
    const initialText = `${recentMessages} ${message}`;

    // 过滤启用的条目
    const enabledEntries = this.entries.filter((e) => e.enabled !== false);

    // ════════════════════════════════════════════════════════════════════════
    // Phase 1: 迭代式递归激活（好品味：用循环替代递归，避免栈溢出）
    // ════════════════════════════════════════════════════════════════════════
    const activated = new Map<string, MatchedEntry>();
    let scanBuffer = initialText;
    let recursionLevel = 0;

    while (recursionLevel <= (enableRecursion ? maxRecursionDepth : 0)) {
      const newActivations: MatchedEntry[] = [];

      for (const entry of enabledEntries) {
        const entryKey = entry.entry_id || `${entry.content.slice(0, 50)}`;
        if (activated.has(entryKey)) continue;

        const matchResult = this.evaluateEntry(entry, scanBuffer, {
          enableTimeEffects,
          caseSensitive,
          matchWholeWords,
        });

        if (matchResult) {
          matchResult.recursionLevel = recursionLevel;
          newActivations.push(matchResult);
          activated.set(entryKey, matchResult);
        }
      }

      // 无新激活则退出
      if (newActivations.length === 0) break;

      // 递归：将新激活内容加入扫描缓冲区
      if (enableRecursion && recursionLevel < maxRecursionDepth) {
        const recursiveContent = newActivations
          .filter((m) => !m.entry.preventRecursion)
          .map((m) => m.entry.content)
          .join("\n");

        if (recursiveContent) {
          scanBuffer = `${scanBuffer}\n${recursiveContent}`;
        }
      }

      recursionLevel++;
    }

    let matched = Array.from(activated.values());

    // ════════════════════════════════════════════════════════════════════════
    // Phase 2: 概率过滤
    // ════════════════════════════════════════════════════════════════════════
    if (enableProbability) {
      matched = this.applyProbability(matched);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Phase 3: 包含组评分（好品味：按权重评分，选择最佳）
    // ════════════════════════════════════════════════════════════════════════
    if (enableInclusionGroups) {
      matched = this.applyInclusionGroups(matched);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Phase 4: Token 预算管理
    // ════════════════════════════════════════════════════════════════════════
    if (tokenBudget > 0) {
      matched = this.applyTokenBudget(matched, tokenBudget, minActivations);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Phase 5: 最小激活数保证
    // ════════════════════════════════════════════════════════════════════════
    if (minActivations > 0 && matched.length < minActivations) {
      matched = this.ensureMinActivations(matched, enabledEntries, minActivations);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Phase 6: 排序（来源优先级 > 插入顺序）
    // ════════════════════════════════════════════════════════════════════════
    matched.sort((a, b) => {
      const sourceDiff =
        (b.entry as WorldBookEntryWithSource).sourcePriority -
        (a.entry as WorldBookEntryWithSource).sourcePriority;
      if (sourceDiff !== 0) return sourceDiff;
      return (b.entry.insertion_order || 0) - (a.entry.insertion_order || 0);
    });

    return matched;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     单条目评估（支持全词匹配 + 大小写敏感）
     ───────────────────────────────────────────────────────────────────────── */

  private evaluateEntry(
    entry: WorldBookEntry,
    fullText: string,
    options: {
      enableTimeEffects: boolean;
      caseSensitive: boolean;
      matchWholeWords: boolean;
    },
  ): MatchedEntry | null {
    const { enableTimeEffects, caseSensitive, matchWholeWords } = options;

    // 恒定激活
    if (entry.constant) {
      return { entry, matchReason: "constant" };
    }

    // 时间效果检查
    if (enableTimeEffects) {
      if (entry._stickyRemaining && entry._stickyRemaining > 0) {
        return { entry, matchReason: "sticky", depth: entry.depth };
      }
      if (entry._cooldownRemaining && entry._cooldownRemaining > 0) {
        return null;
      }
      if (entry._delayUntilTurn && this.currentTurn < entry._delayUntilTurn) {
        return null;
      }
      if (entry._delayUntilTurn && this.currentTurn >= entry._delayUntilTurn) {
        entry._delayUntilTurn = undefined;
        return { entry, matchReason: "delay", depth: entry.depth };
      }
    }

    if (!entry.keys || entry.keys.length === 0) {
      return null;
    }

    // 合并全局和条目级别的匹配选项
    const useWholeWords = entry.matchWholeWords ?? matchWholeWords;
    const useCaseSensitive = entry.caseSensitive ?? caseSensitive;

    // 主关键词匹配
    const matchedKeyword = this.matchKeys(
      entry.keys,
      fullText,
      entry.use_regex,
      useWholeWords,
      useCaseSensitive,
    );

    if (!matchedKeyword) {
      return null;
    }

    // 次关键词匹配
    if (entry.selective && entry.secondary_keys && entry.secondary_keys.length > 0) {
      const secondaryMatch = this.evaluateSecondaryKeys(
        entry.secondary_keys,
        fullText,
        entry.selectiveLogic || "AND",
        entry.use_regex,
        useWholeWords,
        useCaseSensitive,
      );
      if (!secondaryMatch) {
        return null;
      }
    }

    // 延迟激活设置
    if (enableTimeEffects && entry.delay && entry.delay > 0) {
      entry._delayUntilTurn = this.currentTurn + entry.delay;
      return null;
    }

    this.activateEntry(entry);

    return {
      entry,
      matchReason: "keyword",
      depth: entry.depth,
      matchedKeyword,
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────
     关键词匹配（支持全词匹配 + 大小写敏感）
     ───────────────────────────────────────────────────────────────────────── */

  private matchKeys(
    keys: string[],
    text: string,
    useRegex?: boolean,
    wholeWords?: boolean,
    caseSensitive?: boolean,
  ): string | null {
    const processedText = caseSensitive ? text : text.toLowerCase();

    for (const key of keys) {
      const processedKey = caseSensitive ? key : key.toLowerCase();

      if (useRegex) {
        try {
          const flags = caseSensitive ? "" : "i";
          const regex = new RegExp(processedKey, flags);
          if (regex.test(text)) return key;
        } catch {
          // 正则无效时降级为普通匹配
          if (this.matchSingleKey(processedText, processedKey, wholeWords)) {
            return key;
          }
        }
      } else {
        if (this.matchSingleKey(processedText, processedKey, wholeWords)) {
          return key;
        }
      }
    }
    return null;
  }

  /**
   * 单个关键词匹配（好品味：全词匹配用正则边界）
   */
  private matchSingleKey(text: string, key: string, wholeWords?: boolean): boolean {
    if (wholeWords) {
      // 全词匹配：使用单词边界
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`);
      return regex.test(text);
    }
    // 子串匹配
    return text.includes(key);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     次关键词评估（支持 SillyTavern 4 种逻辑）
     ───────────────────────────────────────────────────────────────────────── */

  private evaluateSecondaryKeys(
    keys: string[],
    text: string,
    logic: SecondaryKeyLogic,
    useRegex?: boolean,
    wholeWords?: boolean,
    caseSensitive?: boolean,
  ): boolean {
    const matches = keys.map((key) =>
      this.matchKeys([key], text, useRegex, wholeWords, caseSensitive) !== null,
    );

    // 好品味：用对象映射替代 switch（消除分支）
    const logicHandlers: Record<SecondaryKeyLogic, () => boolean> = {
      AND: () => matches.every((m) => m),
      AND_ALL: () => matches.every((m) => m),
      OR: () => matches.some((m) => m),
      AND_ANY: () => matches.some((m) => m),
      NOT: () => !matches.some((m) => m),
      NOT_ANY: () => !matches.some((m) => m),
      NOT_ALL: () => !matches.every((m) => m),
    };

    return logicHandlers[logic]?.() ?? matches.every((m) => m);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     时间效果
     ───────────────────────────────────────────────────────────────────────── */

  private activateEntry(entry: WorldBookEntry): void {
    entry._lastActivatedTurn = this.currentTurn;

    if (entry.sticky && entry.sticky > 0) {
      entry._stickyRemaining = entry.sticky;
    }
    if (entry.cooldown && entry.cooldown > 0) {
      entry._cooldownRemaining = entry.cooldown;
    }
  }

  private updateTimeEffects(): void {
    for (const entry of this.entries) {
      if (entry._stickyRemaining && entry._stickyRemaining > 0) {
        entry._stickyRemaining--;
      }
      if (entry._cooldownRemaining && entry._cooldownRemaining > 0) {
        entry._cooldownRemaining--;
      }
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     概率激活
     ───────────────────────────────────────────────────────────────────────── */

  private applyProbability(matched: MatchedEntry[]): MatchedEntry[] {
    return matched.filter((m) => {
      const prob = m.entry.probability;
      if (prob === undefined || prob >= 100) return true;
      if (prob <= 0) return false;
      return Math.random() * 100 < prob;
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     包含组评分系统（好品味：按权重 + 优先级评分）
     ───────────────────────────────────────────────────────────────────────── */

  private applyInclusionGroups(matched: MatchedEntry[]): MatchedEntry[] {
    const groups = new Map<string, MatchedEntry[]>();

    // 按组分类
    for (const m of matched) {
      if (m.entry.group) {
        const existing = groups.get(m.entry.group) || [];
        existing.push(m);
        groups.set(m.entry.group, existing);
      }
    }

    const excluded = new Set<WorldBookEntry>();

    // 处理每个组：选择得分最高的条目
    for (const [, groupEntries] of groups) {
      if (groupEntries.length <= 1) continue;

      // 计算每个条目的得分
      const scored = groupEntries.map((m) => ({
        entry: m,
        score: this.calculateGroupScore(m.entry),
      }));

      // 按得分降序排序
      scored.sort((a, b) => b.score - a.score);

      // 排除得分较低的条目
      for (let i = 1; i < scored.length; i++) {
        excluded.add(scored[i].entry.entry);
      }
    }

    return matched.filter((m) => !excluded.has(m.entry));
  }

  /**
   * 计算组内得分
   * 公式：(group_priority * 1000) + (group_weight || 0)
   */
  private calculateGroupScore(entry: WorldBookEntry): number {
    const priority = entry.group_priority || 0;
    const weight = entry.group_weight || 0;
    return priority * 1000 + weight;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     Token 预算管理（好品味：按优先级填充，无硬截断）
     ───────────────────────────────────────────────────────────────────────── */

  private applyTokenBudget(
    matched: MatchedEntry[],
    budget: number,
    minActivations: number,
  ): MatchedEntry[] {
    // 先按优先级排序
    const sorted = [...matched].sort((a, b) => {
      const sourceDiff =
        (b.entry as WorldBookEntryWithSource).sourcePriority -
        (a.entry as WorldBookEntryWithSource).sourcePriority;
      if (sourceDiff !== 0) return sourceDiff;
      return (b.entry.insertion_order || 0) - (a.entry.insertion_order || 0);
    });

    const result: MatchedEntry[] = [];
    let usedTokens = 0;

    for (const m of sorted) {
      const tokens = m.entry.tokens || estimateTokens(m.entry.content);

      // 保证最小激活数
      if (result.length < minActivations) {
        result.push(m);
        usedTokens += tokens;
        continue;
      }

      // 检查预算
      if (usedTokens + tokens <= budget) {
        result.push(m);
        usedTokens += tokens;
      }
    }

    return result;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     最小激活数保证
     ───────────────────────────────────────────────────────────────────────── */

  private ensureMinActivations(
    current: MatchedEntry[],
    allEntries: WorldBookEntryWithSource[],
    minActivations: number,
  ): MatchedEntry[] {
    if (current.length >= minActivations) return current;

    const needed = minActivations - current.length;
    const currentIds = new Set(current.map((m) => m.entry.entry_id || m.entry.content));

    // 从恒定激活条目中补充
    const constantEntries = allEntries
      .filter((e) => e.constant && !currentIds.has(e.entry_id || e.content))
      .slice(0, needed)
      .map((entry) => ({ entry, matchReason: "constant" as const }));

    return [...current, ...constantEntries];
  }

  /* ─────────────────────────────────────────────────────────────────────────
     深度注入
     ───────────────────────────────────────────────────────────────────────── */

  organizeByDepth(matched: MatchedEntry[]): Map<number, MatchedEntry[]> {
    const depthMap = new Map<number, MatchedEntry[]>();

    for (const m of matched) {
      const depth = m.depth ?? 0;
      const existing = depthMap.get(depth) || [];
      existing.push(m);
      depthMap.set(depth, existing);
    }

    return depthMap;
  }

  generateDepthInjections(matched: MatchedEntry[]): DepthInjection[] {
    const depthMap = this.organizeByDepth(matched);
    const injections: DepthInjection[] = [];

    for (const [depth, entries] of depthMap) {
      entries.sort(
        (a, b) => (b.entry.insertion_order || 0) - (a.entry.insertion_order || 0),
      );

      for (let i = 0; i < entries.length; i++) {
        injections.push({
          content: entries[i].entry.content,
          depth,
          order: i,
        });
      }
    }

    return injections;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     内容生成
     ───────────────────────────────────────────────────────────────────────── */

  generateWiBefore(matched: MatchedEntry[]): string {
    const beforeEntries = matched.filter((m) => {
      const pos = m.entry.position;
      return pos === 0 || pos === "before" || pos === "0";
    });
    return beforeEntries.map((m) => m.entry.content).join("\n\n");
  }

  generateWiAfter(matched: MatchedEntry[]): string {
    const afterEntries = matched.filter((m) => {
      const pos = m.entry.position;
      return pos === 1 || pos === "after" || pos === "1";
    });
    return afterEntries.map((m) => m.entry.content).join("\n\n");
  }

  /* ─────────────────────────────────────────────────────────────────────────
     缓存 API
     ───────────────────────────────────────────────────────────────────────── */

  getCachedEntries(key: string): WorldBookEntry[] | null {
    return this.cache.get(key);
  }

  setCachedEntries(key: string, entries: WorldBookEntry[]): void {
    this.cache.set(key, entries);
  }

  invalidateCache(key: string): void {
    this.cache.invalidate(key);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   全局缓存（好品味：模块级单例，无需 class）
   ═══════════════════════════════════════════════════════════════════════════ */

const globalWorldBookCache = new WorldBookCache(60_000, 200);

export function getGlobalWorldBookCache(): WorldBookCache {
  return globalWorldBookCache;
}

/* ═══════════════════════════════════════════════════════════════════════════
   工厂函数
   ═══════════════════════════════════════════════════════════════════════════ */

let defaultManager: WorldBookAdvancedManager | null = null;

export function getWorldBookManager(): WorldBookAdvancedManager {
  if (!defaultManager) {
    defaultManager = new WorldBookAdvancedManager();
  }
  return defaultManager;
}

export function createWorldBookManager(): WorldBookAdvancedManager {
  return new WorldBookAdvancedManager();
}
