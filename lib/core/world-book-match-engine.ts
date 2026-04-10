/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              World Book 匹配引擎 — 纯函数层                                 ║
 * ║                                                                            ║
 * ║  从 WorldBookAdvancedManager 抽取的无状态匹配逻辑：                            ║
 * ║  1. 关键词匹配（全词 + 大小写敏感 + CJK）                                     ║
 * ║  2. 次关键词评估（4 种逻辑运算）                                              ║
 * ║  3. Extension 字段解析                                                      ║
 * ║  4. 概率过滤                                                                ║
 * ║  5. 包含组评分                                                              ║
 * ║  6. Token 预算管理                                                          ║
 * ║  7. 最小激活数保证                                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  WorldBookEntry,
  WorldBookEntryWithSource,
  SecondaryKeyLogic,
} from "@/lib/models/world-book-model";
import type { MatchedEntry, ExtensionFields } from "./world-book-advanced-types";
import { estimateTokens } from "./world-book-advanced-types";

/* ═══════════════════════════════════════════════════════════════════════════
   Extension 字段解析（好品味：统一入口，消除重复）
   ═══════════════════════════════════════════════════════════════════════════ */

export function getExtension(entry: WorldBookEntry): ExtensionFields | undefined {
  if (!entry.extensions || typeof entry.extensions !== "object") {
    return undefined;
  }
  return entry.extensions as ExtensionFields;
}

export function resolveDepth(entry: WorldBookEntry): number | undefined {
  if (typeof entry.depth === "number") return entry.depth;
  const ext = getExtension(entry);
  const extDepth = ext?.depth;
  return typeof extDepth === "number" ? extDepth : undefined;
}

export function resolveUseProbability(entry: WorldBookEntry): boolean | undefined {
  if (typeof entry.useProbability === "boolean") return entry.useProbability;
  const ext = getExtension(entry);
  const extValue = ext?.useProbability ?? ext?.use_probability;
  return typeof extValue === "boolean" ? extValue : undefined;
}

export function resolveProbability(entry: WorldBookEntry): number | undefined {
  if (typeof entry.probability === "number") return entry.probability;
  const ext = getExtension(entry);
  const extValue = ext?.probability;
  return typeof extValue === "number" ? extValue : undefined;
}

export function resolveGroupName(entry: WorldBookEntry): string {
  if (typeof entry.group === "string") return entry.group;
  const ext = getExtension(entry);
  const extGroup = ext?.group;
  return typeof extGroup === "string" ? extGroup : "";
}

export function resolveGroupPriority(entry: WorldBookEntry): number {
  if (typeof entry.group_priority === "number") return entry.group_priority;
  if (typeof entry.groupPriority === "number") return entry.groupPriority;

  const ext = getExtension(entry);
  const extValue = ext?.group_priority ?? ext?.groupPriority;
  return typeof extValue === "number" ? extValue : 0;
}

export function resolveGroupWeight(entry: WorldBookEntry): number {
  if (typeof entry.group_weight === "number") return entry.group_weight;
  if (typeof entry.groupWeight === "number") return entry.groupWeight;

  const ext = getExtension(entry);
  const extValue = ext?.group_weight ?? ext?.groupWeight;
  return typeof extValue === "number" ? extValue : 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   关键词匹配（支持全词匹配 + 大小写敏感）
   ═══════════════════════════════════════════════════════════════════════════ */

export function matchKeys(
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
        if (matchSingleKey(processedText, processedKey, wholeWords)) {
          return key;
        }
      }
    } else {
      if (matchSingleKey(processedText, processedKey, wholeWords)) {
        return key;
      }
    }
  }
  return null;
}

/**
 * 单个关键词匹配（好品味：全词匹配用正则边界）
 */
export function matchSingleKey(text: string, key: string, wholeWords?: boolean): boolean {
  if (!wholeWords) {
    return text.includes(key);
  }

  if (hasCjk(key)) {
    return matchCjkWholeWord(text, key);
  }

  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "u");
  return regex.test(text);
}

/* ─────────────────────────────────────────────────────────────────────────
   CJK 全词匹配：使用 Intl.Segmenter 近似中文/日文/韩文的词界
   ───────────────────────────────────────────────────────────────────────── */

export function matchCjkWholeWord(text: string, key: string): boolean {
  const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("zh-CN", { granularity: "word" })
    : null;

  if (!segmenter) return text.includes(key);

  for (const { segment, isWordLike } of segmenter.segment(text)) {
    if (!isWordLike) continue;
    if (segment === key || segment.startsWith(key)) {
      return true;
    }
  }

  return false;
}

export function hasCjk(text: string): boolean {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
    text,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   次关键词评估（支持 SillyTavern 4 种逻辑）
   ═══════════════════════════════════════════════════════════════════════════ */

export function evaluateSecondaryKeys(
  keys: string[],
  text: string,
  logic: SecondaryKeyLogic,
  useRegex?: boolean,
  wholeWords?: boolean,
  caseSensitive?: boolean,
): boolean {
  const matches = keys.map((key) =>
    matchKeys([key], text, useRegex, wholeWords, caseSensitive) !== null,
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

/* ═══════════════════════════════════════════════════════════════════════════
   概率激活
   ═══════════════════════════════════════════════════════════════════════════ */

export function applyProbability(matched: MatchedEntry[]): MatchedEntry[] {
  return matched.filter((m) => {
    const useProbability = resolveUseProbability(m.entry) ?? true;
    if (!useProbability) return true;

    const prob = resolveProbability(m.entry);
    if (prob === undefined || prob >= 100) return true;
    if (prob <= 0) return false;
    return Math.random() * 100 < prob;
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   包含组评分系统（好品味：按权重 + 优先级评分）
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 计算组内得分
 * 公式：(group_priority * 1000) + (group_weight || 0)
 */
function calculateGroupScore(entry: WorldBookEntry): number {
  const priority = resolveGroupPriority(entry);
  const weight = resolveGroupWeight(entry);
  return priority * 1000 + weight;
}

export function applyInclusionGroups(matched: MatchedEntry[]): MatchedEntry[] {
  const groups = new Map<string, MatchedEntry[]>();

  // 按组分类
  for (const m of matched) {
    const groupName = resolveGroupName(m.entry);
    if (groupName) {
      const existing = groups.get(groupName) || [];
      existing.push(m);
      groups.set(groupName, existing);
    }
  }

  const excluded = new Set<WorldBookEntry>();

  // 处理每个组：选择得分最高的条目
  for (const [, groupEntries] of groups) {
    if (groupEntries.length <= 1) continue;

    // 计算每个条目的得分
    const scored = groupEntries.map((m) => ({
      entry: m,
      score: calculateGroupScore(m.entry),
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

/* ═══════════════════════════════════════════════════════════════════════════
   Token 预算管理（好品味：按优先级填充，无硬截断）
   ═══════════════════════════════════════════════════════════════════════════ */

export function applyTokenBudget(
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

/* ═══════════════════════════════════════════════════════════════════════════
   最小激活数保证
   ═══════════════════════════════════════════════════════════════════════════ */

export function ensureMinActivations(
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
