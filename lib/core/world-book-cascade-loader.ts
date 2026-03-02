/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   世界书级联加载器                                           ║
 * ║                                                                            ║
 * ║  实现 SillyTavern 式的多来源世界书加载、去重和优先级管理                      ║
 * ║  支持：缓存、递归激活、预算管理、可配置扫描深度                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";
import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import type {
  WorldBookEntry,
  WorldBookSource,
} from "@/lib/models/world-book-model";
import type { DialogueMessage } from "@/lib/models/character-dialogue-model";
import {
  WorldBookAdvancedManager,
  getGlobalWorldBookCache,
  type WorldBookMatchOptions,
} from "@/lib/core/world-book-advanced";
import { getVectorMemoryManager } from "@/lib/vector-memory/manager";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface EntryWithSource {
  entry: WorldBookEntry;
  source: WorldBookSource;
}

/** 级联加载选项（暴露高级功能） */
export interface CascadeLoadOptions {
  /** 上下文窗口大小 (最近 N 条消息) */
  contextWindow?: number;
  /** 是否启用递归激活 */
  enableRecursion?: boolean;
  /** 最大递归深度 (性能控制，默认 3) */
  maxRecursionDepth?: number;
  /** Token 预算 (0 = 无限制) */
  tokenBudget?: number;
  /** 最小激活数 */
  minActivations?: number;
  /** 全局大小写敏感设置 */
  caseSensitive?: boolean;
  /** 全局全词匹配设置 */
  matchWholeWords?: boolean;
  /** 是否启用概率激活 */
  enableProbability?: boolean;
  /** 是否启用包含组 */
  enableInclusionGroups?: boolean;
  /** 是否启用时间效果 */
  enableTimeEffects?: boolean;
  /** 是否使用缓存 */
  useCache?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   公共 API
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 从多个来源加载世界书并生成注入内容
 *
 * 【SillyTavern 式级联加载】
 * - 并行加载三个来源（Promise.all）
 * - 哈希去重（上层优先）
 * - 支持缓存、递归激活、预算管理等高级功能
 *
 * @param characterId - 角色 ID
 * @param dialogueKey - 对话键
 * @param currentUserInput - 当前用户输入
 * @param options - 高级选项
 * @returns wiBefore 和 wiAfter 内容
 */
export async function loadWorldBooksFromSources(
  characterId: string,
  dialogueKey: string,
  currentUserInput: string,
  options: CascadeLoadOptions = {},
): Promise<{ wiBefore: string; wiAfter: string }> {
  const {
    contextWindow = 5,
    enableRecursion = false,
    maxRecursionDepth = 3,
    tokenBudget = 0,
    minActivations = 0,
    caseSensitive = false,
    matchWholeWords = false,
    enableProbability = true,
    enableInclusionGroups = true,
    enableTimeEffects = false,
    useCache = true,
  } = options;

  // ════════════════════════════════════════════════════════════════════════
  // Step 1: 尝试从缓存加载（好品味：缓存 key 标准化）
  // ════════════════════════════════════════════════════════════════════════
  const cache = getGlobalWorldBookCache();
  const cacheKey = `${characterId}:${dialogueKey}`;

  let allEntries: EntryWithSource[];

  if (useCache) {
    const cached = cache.get(cacheKey);
    if (cached) {
      console.debug(`[WI] Cache hit for ${cacheKey}`);
      allEntries = cached.map((entry) => ({
        entry,
        source: "character" as WorldBookSource,
      }));
    } else {
      allEntries = await loadAndCacheEntries(characterId, dialogueKey, cacheKey, cache);
    }
  } else {
    allEntries = await loadEntriesWithoutCache(characterId, dialogueKey);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Step 2: 级联去重（优先级通过数组顺序自然实现）
  // ════════════════════════════════════════════════════════════════════════
  const deduplicatedEntries = deduplicateEntries(allEntries);

  if (deduplicatedEntries.length === 0) {
    return { wiBefore: "", wiAfter: "" };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Step 3: 获取聊天历史并匹配（传递所有高级选项）
  // ════════════════════════════════════════════════════════════════════════
  const chatHistory = await getChatHistoryForWorldBook(dialogueKey, contextWindow);
  const manager = new WorldBookAdvancedManager();

  // 按来源分组并添加到管理器
  const entriesBySource = groupEntriesBySource(deduplicatedEntries);

  for (const [source, entries] of Object.entries(entriesBySource)) {
    if (entries.length === 0) continue;
    manager.addEntries(entries, source as WorldBookSource);
  }

  // 构建匹配选项
  const matchOptions: WorldBookMatchOptions = {
    contextWindow,
    enableRecursion,
    maxRecursionDepth,
    tokenBudget,
    minActivations,
    caseSensitive,
    matchWholeWords,
    enableProbability,
    enableInclusionGroups,
    enableTimeEffects,
  };

  // 匹配条目 - 返回 MatchedEntry[]，需要提取 entry 字段
  const matchedEntries = manager.getMatchingEntries(currentUserInput, chatHistory, matchOptions);

  if (matchedEntries.length === 0) {
    return { wiBefore: "", wiAfter: "" };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Step 4: 生成注入内容并写入向量记忆
  // ════════════════════════════════════════════════════════════════════════
  const wiBefore = manager.generateWiBefore(matchedEntries);
  const wiAfter = manager.generateWiAfter(matchedEntries);

  // 提取 WorldBookEntry[] 用于向量记忆
  const matched = matchedEntries.map(m => m.entry);

  // 写入向量记忆（用于 RAG）
  await ingestToVectorMemory(dialogueKey, matched, wiBefore, wiAfter);

  console.debug(`[WI] Matched ${matched.length} entries, wiBefore: ${wiBefore.length} chars, wiAfter: ${wiAfter.length} chars`);

  return { wiBefore, wiAfter };
}

/* ═══════════════════════════════════════════════════════════════════════════
   缓存辅助函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 加载条目并写入缓存
 */
async function loadAndCacheEntries(
  characterId: string,
  dialogueKey: string,
  cacheKey: string,
  cache: ReturnType<typeof getGlobalWorldBookCache>,
): Promise<EntryWithSource[]> {
  const allEntries = await loadEntriesWithoutCache(characterId, dialogueKey);

  // 写入缓存
  const entriesToCache = allEntries.map((e) => e.entry);
  cache.set(cacheKey, entriesToCache);
  console.debug(`[WI] Cached ${entriesToCache.length} entries for ${cacheKey}`);

  return allEntries;
}

/**
 * 加载条目（不使用缓存）
 */
async function loadEntriesWithoutCache(
  characterId: string,
  dialogueKey: string,
): Promise<EntryWithSource[]> {
  const [globalBooks, characterBooks, dialogueBooks] = await Promise.all([
    getGlobalWorldBooks(),
    getCharacterWorldBooks(characterId),
    getDialogueWorldBooks(dialogueKey),
  ]);

  // 级联：dialogue > character > global
  return [
    ...dialogueBooks,
    ...characterBooks,
    ...globalBooks,
  ];
}

/* ═══════════════════════════════════════════════════════════════════════════
   来源加载函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 加载全局世界书
 *
 * 规则：
 * - 只加载 enabled=true 的世界书
 * - 忽略未启用的
 * - 错误容错：任何加载失败都返回空数组
 */
async function getGlobalWorldBooks(): Promise<EntryWithSource[]> {
  try {
    const globalKeys = await WorldBookOperations.getWorldBookKeysByPrefix("global:");
    const results: EntryWithSource[] = [];

    for (const key of globalKeys) {
      try {
        const settings = await WorldBookOperations.getWorldBookSettings(key);

        // 跳过未启用的全局世界书
        if (!settings.enabled) {
          console.debug(`[WI] Skipping disabled global world book: ${key}`);
          continue;
        }

        const worldBook = await WorldBookOperations.getWorldBook(key);
        if (!worldBook) continue;

        // 将所有条目标记为 global 来源
        const entries = Object.values(worldBook)
          .filter((entry) => entry.enabled !== false) // 跳过禁用条目
          .map((entry) => ({
            entry,
            source: "global" as const,
          }));

        results.push(...entries);
      } catch (error) {
        console.error(`[WI] Failed to load global world book ${key}:`, error);
        // 单个全局世界书加载失败不影响其他
        continue;
      }
    }

    console.debug(
      `[WI] Loaded ${results.length} entries from ${globalKeys.length} global world books`,
    );
    return results;
  } catch (error) {
    console.error("[WI] Failed to get global world book keys:", error);
    return []; // 容错：失败时返回空数组
  }
}

/**
 * 加载角色世界书
 *
 * - 使用 "character:{id}" 格式
 * - 错误容错：任何加载失败都返回空数组
 */
async function getCharacterWorldBooks(characterId: string): Promise<EntryWithSource[]> {
  try {
    const key = `character:${characterId}`;
    const worldBook = await WorldBookOperations.getWorldBook(key);

    if (!worldBook) {
      console.debug(`[WI] No character world book found for: ${characterId}`);
      return [];
    }

    const entries = Object.values(worldBook)
      .filter((entry) => entry.enabled !== false)
      .map((entry) => ({
        entry,
        source: "character" as const,
      }));

    console.debug(`[WI] Loaded ${entries.length} entries from character world book`);
    return entries;
  } catch (error) {
    console.error(`[WI] Failed to load character world book for ${characterId}:`, error);
    return [];
  }
}

/**
 * 加载会话级世界书
 *
 * - 错误容错：任何加载失败都返回空数组
 */
async function getDialogueWorldBooks(dialogueKey: string): Promise<EntryWithSource[]> {
  try {
    const key = `dialogue:${dialogueKey}`;
    const worldBook = await WorldBookOperations.getWorldBook(key);

    if (!worldBook) {
      console.debug(`[WI] No dialogue world book found for: ${dialogueKey}`);
      return [];
    }

    const entries = Object.values(worldBook)
      .filter((entry) => entry.enabled !== false)
      .map((entry) => ({
        entry,
        source: "chat" as const,
      }));

    console.debug(`[WI] Loaded ${entries.length} entries from dialogue world book`);
    return entries;
  } catch (error) {
    console.error(`[WI] Failed to load dialogue world book for ${dialogueKey}:`, error);
    return []; // 容错：失败时返回空数组
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   去重逻辑（好品味：哈希表 O(1)）
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 去重条目（SillyTavern 式哈希去重）
 *
 * 规则：上层激活的条目，下层自动跳过
 * 优先级：dialogue > character > global
 *
 * 【好品味设计】
 * - 不用 if-else 判断优先级
 * - 通过数组顺序自然表达
 * - 哈希表 O(1) 查找
 */
function deduplicateEntries(entries: EntryWithSource[]): EntryWithSource[] {
  const seen = new Set<string>();
  const results: EntryWithSource[] = [];

  for (const { entry, source } of entries) {
    // 生成全局唯一键：entry_id 或 content 哈希
    const entryKey = entry.entry_id || hashContent(entry.content);

    if (seen.has(entryKey)) {
      console.debug(`[WI] Skipping duplicate entry from ${source}:`, entryKey);
      continue;
    }

    seen.add(entryKey);
    results.push({ entry, source });
  }

  return results;
}

/**
 * 按来源分组条目
 */
function groupEntriesBySource(
  entries: EntryWithSource[],
): Record<WorldBookSource, WorldBookEntry[]> {
  const groups: Record<string, WorldBookEntry[]> = {
    global: [],
    character: [],
    persona: [],
    chat: [],
  };

  for (const { entry, source } of entries) {
    groups[source].push(entry);
  }

  return groups as Record<WorldBookSource, WorldBookEntry[]>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   辅助函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 获取聊天历史（用于世界书匹配）
 * @param dialogueKey - 对话键
 * @param maxMessages - 最大消息数（默认 10）
 */
async function getChatHistoryForWorldBook(
  dialogueKey: string,
  maxMessages = 10,
): Promise<DialogueMessage[]> {
  try {
    const dialogueTree = await LocalCharacterDialogueOperations.getDialogueTreeById(
      dialogueKey,
    );
    if (!dialogueTree) {
      return [];
    }

    const nodePath =
      dialogueTree.current_nodeId !== "root"
        ? await LocalCharacterDialogueOperations.getDialoguePathToNode(
          dialogueKey,
          dialogueTree.current_nodeId,
        )
        : [];

    const messages: DialogueMessage[] = [];
    let messageId = 0;

    for (const node of nodePath) {
      if (node.userInput) {
        messages.push({ role: "user", content: node.userInput, id: messageId++ });
      }
      if (node.assistantResponse) {
        messages.push({
          role: "assistant",
          content: node.assistantResponse,
          id: messageId++,
        });
      }
    }

    return messages.slice(-maxMessages);
  } catch {
    return [];
  }
}

/**
 * 内容哈希（简单快速的哈希算法）
 */
function hashContent(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/* ═══════════════════════════════════════════════════════════════════════════
   将匹配的世界书条目写入向量记忆

   matched 参数：使用 WorldBookEntry[] 替代 any[]
   - 匹配的条目应该是类型明确的 WorldBookEntry
   - 消除 any 的类型污染
   设计理念：内部函数也要保持类型安全
   ═══════════════════════════════════════════════════════════════════════════ */
async function ingestToVectorMemory(
  dialogueKey: string,
  matched: WorldBookEntry[],
  wiBefore: string,
  wiAfter: string,
): Promise<void> {
  const vectorManager = getVectorMemoryManager();
  const now = Date.now();

  const vectorPayload = [];

  if (wiBefore) {
    vectorPayload.push({
      id: `wi_before_${dialogueKey}_${hashContent(wiBefore)}`,
      role: "system" as const,
      source: "world_info_before",
      content: wiBefore,
      createdAt: now,
    });
  }

  if (wiAfter) {
    vectorPayload.push({
      id: `wi_after_${dialogueKey}_${hashContent(wiAfter)}`,
      role: "system" as const,
      source: "world_info_after",
      content: wiAfter,
      createdAt: now,
    });
  }

  if (vectorPayload.length > 0) {
    vectorManager.ingest(dialogueKey, vectorPayload).catch((error) => {
      console.warn("[VectorMemory] world-book ingest failed:", error);
    });
  }
}
