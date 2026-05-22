/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  World Book 高级功能管理器 — 编排层                                         ║
 * ║                                                                            ║
 * ║  类型/缓存/常量  → world-book-advanced-types.ts                             ║
 * ║  匹配/评分引擎   → world-book-match-engine.ts                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  WorldBookEntry,
  WorldBookEntryWithSource,
  WorldBookSource,
} from "@/lib/models/world-book-model";
import type { DialogueMessage } from "@/lib/models/character-dialogue-model";
import { WorldBookManager } from "./world-book";

/* ─────────────────────────────────────────────────────────────────────────
   匹配基础设施集中导出
   ───────────────────────────────────────────────────────────────────────── */

export type { WorldBookMatchOptions, MatchedEntry, DepthInjection } from "./world-book-advanced-types";
export { WorldBookCache, SOURCE_PRIORITY, estimateTokens } from "./world-book-advanced-types";

import type { WorldBookMatchOptions, MatchedEntry, DepthInjection } from "./world-book-advanced-types";
import { WorldBookCache, SOURCE_PRIORITY } from "./world-book-advanced-types";
import {
  matchKeys, evaluateSecondaryKeys, resolveDepth,
  applyProbability, applyInclusionGroups, applyTokenBudget, ensureMinActivations,
} from "./world-book-match-engine";

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

    // Phase 1: 迭代式递归激活（用循环替代递归，避免栈溢出）
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

    // Phase 2: 概率过滤
    if (enableProbability) {
      matched = applyProbability(matched);
    }

    // Phase 3: 包含组评分（按权重评分，选择最佳）
    if (enableInclusionGroups) {
      matched = applyInclusionGroups(matched);
    }

    // Phase 4: Token 预算管理
    if (tokenBudget > 0) {
      matched = applyTokenBudget(matched, tokenBudget, minActivations);
    }

    // Phase 5: 最小激活数保证
    if (minActivations > 0 && matched.length < minActivations) {
      matched = ensureMinActivations(matched, enabledEntries, minActivations);
    }

    // Phase 6: 排序（来源优先级 > 插入顺序）
    matched.sort((a, b) => {
      const sourceDiff =
        (b.entry as WorldBookEntryWithSource).sourcePriority -
        (a.entry as WorldBookEntryWithSource).sourcePriority;
      if (sourceDiff !== 0) return sourceDiff;
      return (b.entry.insertion_order || 0) - (a.entry.insertion_order || 0);
    });

    return matched;
  }

  /** 单条目评估（委托关键词匹配到引擎层） */
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
        return { entry, matchReason: "sticky", depth: resolveDepth(entry) };
      }
      if (entry._cooldownRemaining && entry._cooldownRemaining > 0) {
        return null;
      }
      if (entry._delayUntilTurn && this.currentTurn < entry._delayUntilTurn) {
        return null;
      }
      if (entry._delayUntilTurn && this.currentTurn >= entry._delayUntilTurn) {
        entry._delayUntilTurn = undefined;
        return { entry, matchReason: "delay", depth: resolveDepth(entry) };
      }
    }

    if (!entry.keys || entry.keys.length === 0) {
      return null;
    }

    // 合并全局和条目级别的匹配选项
    const useWholeWords = entry.matchWholeWords ?? matchWholeWords;
    const useCaseSensitive = entry.caseSensitive ?? caseSensitive;

    // 主关键词匹配
    const matchedKeyword = matchKeys(
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
      const secondaryMatch = evaluateSecondaryKeys(
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
      depth: resolveDepth(entry),
      matchedKeyword,
    };
  }

  /** 时间效果 — 激活条目 */
  private activateEntry(entry: WorldBookEntry): void {
    entry._lastActivatedTurn = this.currentTurn;

    if (entry.sticky && entry.sticky > 0) {
      entry._stickyRemaining = entry.sticky;
    }
    if (entry.cooldown && entry.cooldown > 0) {
      // ── cooldown 按轮次计数：+1 确保"冷却 2"代表跳过后续两轮
      entry._cooldownRemaining = entry.cooldown + 1;
    }
  }

  private updateTimeEffects(): void {
    for (const entry of this.entries) {
      if (entry._stickyRemaining && entry._stickyRemaining > 0) {
        entry._stickyRemaining--;
      }
      if (entry._cooldownRemaining && entry._cooldownRemaining > 0) {
        entry._cooldownRemaining = Math.max(0, entry._cooldownRemaining - 1);
        if (entry._cooldownRemaining === 0) {
          entry._cooldownRemaining = undefined;
        }
      }
    }
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
      const normalizedPos = WorldBookManager.normalizePosition(m.entry);
      return normalizedPos === 0;
    });
    return beforeEntries.map((m) => m.entry.content).join("\n\n");
  }

  generateWiAfter(matched: MatchedEntry[]): string {
    const afterEntries = matched.filter((m) => {
      const normalizedPos = WorldBookManager.normalizePosition(m.entry);
      // Position 1 = after story string (wiAfter)
      // Position 2 = before AN (also sometimes used as after in some exports)
      return normalizedPos === 1 || normalizedPos === 2;
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
