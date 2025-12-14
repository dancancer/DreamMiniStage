/* ═══════════════════════════════════════════════════════════════════════════
   WorldBook 导入适配器

   设计理念：
   - 边界转换：在导入时一次性完成所有字段名规范化
   - 旧字段名转换：key → keys, keysecondary → secondary_keys, disable → enabled
   - 支持多种输入格式：entries 对象、数组、worldBook 数组
   ═══════════════════════════════════════════════════════════════════════════ */

import type { ImportAdapter } from "./types";
import { createImportPipeline, isNonNullObject, hasArrayProperty } from "./types";
import type { WorldBookEntry } from "@/lib/models/world-book-model";

/* ─────────────────────────────────────────────────────────────────────────────
   类型定义
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 规范化后的 WorldBook 条目
 */
export interface NormalizedWorldBookEntry extends WorldBookEntry {
  keys: string[];
  secondary_keys: string[];
  enabled: boolean;
}

/**
 * 原始 WorldBook 条目（可能包含旧格式字段）
 */
interface RawWorldBookEntry {
  // 内容字段
  content?: string;

  // 旧格式关键词字段
  key?: string[];
  keysecondary?: string[];

  // 新格式关键词字段
  keys?: string[];
  secondary_keys?: string[];

  // 旧格式启用字段
  disable?: boolean;

  // 新格式启用字段
  enabled?: boolean;

  // 旧格式排序字段
  order?: number;

  // 新格式排序字段
  insertion_order?: number;

  // 其他字段
  position?: string | number;
  depth?: number;
  selective?: boolean;
  constant?: boolean;
  use_regex?: boolean;
  comment?: string;
  selectiveLogic?: "AND" | "OR" | "NOT";
  tokens?: number;

  // 高级功能
  sticky?: number;
  cooldown?: number;
  delay?: number;
  probability?: number;
  group?: string;
  group_priority?: number;

  [key: string]: unknown;
}

/**
 * SillyTavern entries 对象格式
 */
interface EntriesWrapper {
  entries: Record<string, RawWorldBookEntry>;
}

/**
 * worldBook 数组包装格式
 */
interface WorldBookWrapper {
  worldBook: RawWorldBookEntry[];
}

/* ─────────────────────────────────────────────────────────────────────────────
   字段规范化函数
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 清理并过滤字符串数组（移除空字符串和空白）
 */
function cleanStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((item): item is string =>
    typeof item === "string" && item.trim() !== "",
  );
}

/**
 * 规范化单个 WorldBook 条目
 *
 * 字段转换规则：
 * - key → keys
 * - keysecondary → secondary_keys
 * - disable → enabled (取反)
 * - order → insertion_order
 */
export function normalizeWorldBookEntry(raw: RawWorldBookEntry): NormalizedWorldBookEntry {
  // 关键词字段：优先使用新格式，如果不存在则使用旧格式
  const keys = cleanStringArray(raw.keys ?? raw.key);
  const secondary_keys = cleanStringArray(raw.secondary_keys ?? raw.keysecondary);

  // 启用字段：优先使用新格式，如果不存在则从 disable 推断
  let enabled: boolean;
  if (raw.enabled !== undefined) {
    enabled = Boolean(raw.enabled);
  } else if (raw.disable !== undefined) {
    enabled = !raw.disable;
  } else {
    enabled = true;
  }

  // 排序字段：优先使用新格式
  const insertion_order = raw.insertion_order ?? raw.order ?? 0;

  return {
    content: typeof raw.content === "string" ? raw.content : "",
    keys,
    secondary_keys,
    enabled,
    selective: raw.selective ?? false,
    constant: raw.constant ?? false,
    position: raw.position ?? 4,
    insertion_order,
    use_regex: raw.use_regex ?? false,
    depth: raw.depth ?? 1,
    comment: typeof raw.comment === "string" ? raw.comment : "",
    selectiveLogic: raw.selectiveLogic,
    tokens: raw.tokens,

    // 高级功能
    sticky: raw.sticky,
    cooldown: raw.cooldown,
    delay: raw.delay,
    probability: raw.probability,
    group: raw.group,
    group_priority: raw.group_priority,
  };
}

/**
 * 检查条目是否有效（有内容或有关键词）
 */
function isValidEntry(entry: NormalizedWorldBookEntry): boolean {
  return entry.content.trim() !== "" || entry.keys.length > 0;
}

/* ─────────────────────────────────────────────────────────────────────────────
   类型守卫函数
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 检查是否为有效的原始 WorldBook 条目
 */
function isRawWorldBookEntry(value: unknown): value is RawWorldBookEntry {
  if (!isNonNullObject(value)) return false;
  const obj = value as Record<string, unknown>;
  // 有效的条目至少有 content 或 keys/key 其一
  return (
    typeof obj.content === "string" ||
    Array.isArray(obj.keys) ||
    Array.isArray(obj.key)
  );
}

/**
 * 检查是否为 SillyTavern entries 对象格式
 */
function isEntriesWrapper(value: unknown): value is EntriesWrapper {
  if (!isNonNullObject(value)) return false;
  const obj = value as Record<string, unknown>;
  if (!isNonNullObject(obj.entries)) return false;
  // 检查 entries 对象中的值是否是有效条目
  const entries = Object.values(obj.entries);
  return entries.length > 0 && entries.some(isRawWorldBookEntry);
}

/**
 * 检查是否为数组格式
 */
function isWorldBookArray(value: unknown): value is RawWorldBookEntry[] {
  return Array.isArray(value) && value.length > 0 && value.some(isRawWorldBookEntry);
}

/**
 * 检查是否为 worldBook 包装格式
 */
function isWorldBookWrapper(value: unknown): value is WorldBookWrapper {
  return hasArrayProperty(value, "worldBook") &&
    (value as WorldBookWrapper).worldBook.length > 0 &&
    (value as WorldBookWrapper).worldBook.some(isRawWorldBookEntry);
}

/* ─────────────────────────────────────────────────────────────────────────────
   适配器实现
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * SillyTavern entries 对象格式适配器
 *
 * 格式示例:
 * {
 *   entries: {
 *     "0": { key: ["hello"], content: "world" },
 *     "1": { key: ["foo"], content: "bar" }
 *   }
 * }
 */
export const entriesWrapperAdapter: ImportAdapter<EntriesWrapper, NormalizedWorldBookEntry[]> = {
  name: "entries-wrapper",
  canHandle: isEntriesWrapper,
  normalize: (input) =>
    Object.values(input.entries)
      .filter(isRawWorldBookEntry)
      .map(normalizeWorldBookEntry)
      .filter(isValidEntry),
};

/**
 * 数组格式适配器
 *
 * 格式示例:
 * [
 *   { keys: ["hello"], content: "world" },
 *   { keys: ["foo"], content: "bar" }
 * ]
 */
export const arrayAdapter: ImportAdapter<RawWorldBookEntry[], NormalizedWorldBookEntry[]> = {
  name: "array",
  canHandle: isWorldBookArray,
  normalize: (input) =>
    input
      .filter(isRawWorldBookEntry)
      .map(normalizeWorldBookEntry)
      .filter(isValidEntry),
};

/**
 * worldBook 包装格式适配器
 *
 * 格式示例:
 * {
 *   worldBook: [
 *     { keys: ["hello"], content: "world" }
 *   ]
 * }
 */
export const worldBookWrapperAdapter: ImportAdapter<WorldBookWrapper, NormalizedWorldBookEntry[]> = {
  name: "worldBook-wrapper",
  canHandle: isWorldBookWrapper,
  normalize: (input) =>
    input.worldBook
      .filter(isRawWorldBookEntry)
      .map(normalizeWorldBookEntry)
      .filter(isValidEntry),
};

/**
 * 单条目格式适配器
 *
 * 格式示例:
 * { keys: ["hello"], content: "world" }
 */
export const singleEntryAdapter: ImportAdapter<RawWorldBookEntry, NormalizedWorldBookEntry[]> = {
  name: "single-entry",
  canHandle: (input): input is RawWorldBookEntry =>
    isRawWorldBookEntry(input) &&
    !("entries" in input) &&
    !("worldBook" in input),
  normalize: (input) => {
    const normalized = normalizeWorldBookEntry(input);
    return isValidEntry(normalized) ? [normalized] : [];
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   导出的管道
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * WorldBook 导入管道
 *
 * 按优先级排序的适配器：
 * 1. entries 对象格式（SillyTavern 格式，最常见）
 * 2. 数组格式
 * 3. worldBook 包装格式
 * 4. 单条目格式
 *
 * @example
 * import { worldBookImportPipeline } from "@/lib/adapters/import/worldbook-import";
 * const entries = worldBookImportPipeline.process(jsonData);
 */
export const worldBookImportPipeline = createImportPipeline<NormalizedWorldBookEntry[]>(
  [entriesWrapperAdapter, arrayAdapter, worldBookWrapperAdapter, singleEntryAdapter],
  "worldbook",
);

/**
 * 从任意格式的 JSON 数据导入 WorldBook 条目
 */
export function importWorldBookEntries(jsonData: unknown): NormalizedWorldBookEntry[] {
  return worldBookImportPipeline.process(jsonData);
}

/**
 * 检查 JSON 数据是否可以被导入为 WorldBook
 */
export function canImportWorldBook(jsonData: unknown): boolean {
  return (
    isEntriesWrapper(jsonData) ||
    isWorldBookArray(jsonData) ||
    isWorldBookWrapper(jsonData) ||
    (isRawWorldBookEntry(jsonData) && !("entries" in jsonData) && !("worldBook" in jsonData))
  );
}

/**
 * 检查条目是否包含旧格式字段
 */
export function hasLegacyFields(entry: unknown): boolean {
  if (!isNonNullObject(entry)) return false;
  const obj = entry as Record<string, unknown>;
  return (
    "key" in obj ||
    "keysecondary" in obj ||
    "disable" in obj ||
    "order" in obj
  );
}
