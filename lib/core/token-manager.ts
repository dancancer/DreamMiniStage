/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Token 管理系统                                     ║
 * ║                                                                            ║
 * ║  实现 Token 计数、预算管理和消息截断                                         ║
 * ║  支持多种模型的 Token 计算                                                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              类型定义
// ============================================================================

/** Token 计数结果 */
export interface TokenCount {
  total: number;
  byRole: {
    system: number;
    user: number;
    assistant: number;
  };
  byMessage: number[];
}

/** Token 预算配置 */
export interface TokenBudgetConfig {
  maxContext: number;
  maxResponse: number;
  reservedForResponse: number;
  reservedForSystem: number;
}

/** 消息截断策略 */
export type TruncationStrategy = "oldest" | "middle" | "smart";

/** 截断选项 */
export interface TruncationOptions {
  strategy: TruncationStrategy;
  preserveSystemMessages: boolean;
  preserveRecentMessages: number;
  minMessagesToKeep: number;
}

/** 截断结果 */
export interface TruncationResult {
  messages: Array<{ role: string; content: string }>;
  removedCount: number;
  tokensSaved: number;
  withinBudget: boolean;
}

// ============================================================================
//                              默认配置
// ============================================================================

export const DEFAULT_TOKEN_BUDGET: TokenBudgetConfig = {
  maxContext: 4096,
  maxResponse: 1024,
  reservedForResponse: 1024,
  reservedForSystem: 500,
};

export const DEFAULT_TRUNCATION_OPTIONS: TruncationOptions = {
  strategy: "oldest",
  preserveSystemMessages: true,
  preserveRecentMessages: 4,
  minMessagesToKeep: 2,
};

// ============================================================================
//                              Token 计数器
// ============================================================================

/** Token 计数器接口 */
export interface TokenCounter {
  count(text: string): number;
  countMessages(messages: Array<{ role: string; content: string }>): TokenCount;
}

/** 简单 Token 计数器 (基于字符估算) */
export class SimpleTokenCounter implements TokenCounter {
  private charsPerToken: number;

  constructor(charsPerToken = 4) {
    this.charsPerToken = charsPerToken;
  }

  count(text: string): number {
    return Math.ceil(text.length / this.charsPerToken);
  }

  countMessages(messages: Array<{ role: string; content: string }>): TokenCount {
    const byMessage: number[] = [];
    const byRole = { system: 0, user: 0, assistant: 0 };
    let total = 0;

    for (const msg of messages) {
      const tokens = this.count(msg.content) + 4;
      byMessage.push(tokens);
      total += tokens;

      if (msg.role === "system") byRole.system += tokens;
      else if (msg.role === "user") byRole.user += tokens;
      else if (msg.role === "assistant") byRole.assistant += tokens;
    }

    total += 3;

    return { total, byRole, byMessage };
  }
}

/** CL100K Token 计数器 (GPT-4/3.5 估算) */
export class CL100KTokenCounter implements TokenCounter {
  count(text: string): number {
    let tokens = 0;
    let i = 0;

    while (i < text.length) {
      const char = text.charCodeAt(i);

      if (char >= 0x4E00 && char <= 0x9FFF) {
        tokens += 2;
        i++;
      } else if (char >= 0x3040 && char <= 0x30FF) {
        tokens += 2;
        i++;
      } else if (char >= 0xAC00 && char <= 0xD7AF) {
        tokens += 2;
        i++;
      } else if (char < 128) {
        let wordEnd = i;
        while (wordEnd < text.length && text.charCodeAt(wordEnd) < 128 &&
               /\w/.test(text[wordEnd])) {
          wordEnd++;
        }
        if (wordEnd > i) {
          tokens += Math.ceil((wordEnd - i) / 4);
          i = wordEnd;
        } else {
          tokens += 1;
          i++;
        }
      } else {
        tokens += 1;
        i++;
      }
    }

    return Math.max(1, tokens);
  }

  countMessages(messages: Array<{ role: string; content: string }>): TokenCount {
    const byMessage: number[] = [];
    const byRole = { system: 0, user: 0, assistant: 0 };
    let total = 0;

    for (const msg of messages) {
      const contentTokens = this.count(msg.content);
      const messageTokens = contentTokens + 4;
      byMessage.push(messageTokens);
      total += messageTokens;

      if (msg.role === "system") byRole.system += messageTokens;
      else if (msg.role === "user") byRole.user += messageTokens;
      else if (msg.role === "assistant") byRole.assistant += messageTokens;
    }

    total += 3;

    return { total, byRole, byMessage };
  }
}

// ============================================================================
//                              带缓存的 Token 计数器
// ============================================================================

/** 缓存统计 */
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

/** 带 LRU 缓存的 Token 计数器 */
export class CachedTokenCounter implements TokenCounter {
  private cache: Map<string, number> = new Map();
  private accessOrder: string[] = [];
  private maxCacheSize: number;
  private baseCounter: TokenCounter;
  private minCacheLength: number;

  private hits = 0;
  private misses = 0;

  constructor(
    baseCounter?: TokenCounter,
    options: { maxCacheSize?: number; minCacheLength?: number } = {},
  ) {
    this.baseCounter = baseCounter || new CL100KTokenCounter();
    this.maxCacheSize = options.maxCacheSize ?? 1000;
    this.minCacheLength = options.minCacheLength ?? 50;
  }

  count(text: string): number {
    if (text.length < this.minCacheLength) {
      return this.baseCounter.count(text);
    }

    const key = this.hashText(text);

    if (this.cache.has(key)) {
      this.hits++;
      this.updateAccessOrder(key);
      return this.cache.get(key)!;
    }

    this.misses++;
    const tokens = this.baseCounter.count(text);
    this.setCache(key, tokens);
    return tokens;
  }

  countMessages(messages: Array<{ role: string; content: string }>): TokenCount {
    const byMessage: number[] = [];
    const byRole = { system: 0, user: 0, assistant: 0 };
    let total = 0;

    for (const msg of messages) {
      const contentTokens = this.count(msg.content);
      const messageTokens = contentTokens + 4;
      byMessage.push(messageTokens);
      total += messageTokens;

      if (msg.role === "system") byRole.system += messageTokens;
      else if (msg.role === "user") byRole.user += messageTokens;
      else if (msg.role === "assistant") byRole.assistant += messageTokens;
    }

    total += 3;
    return { total, byRole, byMessage };
  }

  private hashText(text: string): string {
    const len = text.length;
    const head = text.slice(0, 32);
    const tail = text.slice(-32);
    const mid = text.slice(Math.floor(len / 2) - 16, Math.floor(len / 2) + 16);
    return `${len}:${this.simpleHash(head + mid + tail)}`;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash >>> 0;
  }

  private setCache(key: string, value: number): void {
    if (this.cache.size >= this.maxCacheSize) {
      const oldest = this.accessOrder.shift();
      if (oldest) this.cache.delete(oldest);
    }

    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  private updateAccessOrder(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx > -1) {
      this.accessOrder.splice(idx, 1);
      this.accessOrder.push(key);
    }
  }

  warmup(texts: string[]): void {
    for (const text of texts) {
      this.count(text);
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }
}

// ============================================================================
//                              Token 管理器
// ============================================================================

/** Token 管理器 */
export class TokenManager {
  private counter: TokenCounter;
  private budget: TokenBudgetConfig;

  constructor(counter?: TokenCounter, budget?: Partial<TokenBudgetConfig>) {
    this.counter = counter || new CL100KTokenCounter();
    this.budget = { ...DEFAULT_TOKEN_BUDGET, ...budget };
  }

  /** 计算文本 Token 数 */
  countTokens(text: string): number {
    return this.counter.count(text);
  }

  /** 计算消息 Token 数 */
  countMessageTokens(messages: Array<{ role: string; content: string }>): TokenCount {
    return this.counter.countMessages(messages);
  }

  /** 获取可用 Token 预算 */
  getAvailableBudget(): number {
    return this.budget.maxContext - this.budget.reservedForResponse;
  }

  /** 检查是否在预算内 */
  isWithinBudget(messages: Array<{ role: string; content: string }>): boolean {
    const count = this.counter.countMessages(messages);
    return count.total <= this.getAvailableBudget();
  }

  /** 截断消息以适应预算 */
  truncateMessages(
    messages: Array<{ role: string; content: string }>,
    options?: Partial<TruncationOptions>,
  ): TruncationResult {
    const opts = { ...DEFAULT_TRUNCATION_OPTIONS, ...options };
    const budget = this.getAvailableBudget();

    let currentCount = this.counter.countMessages(messages);
    if (currentCount.total <= budget) {
      return {
        messages: [...messages],
        removedCount: 0,
        tokensSaved: 0,
        withinBudget: true,
      };
    }

    const result = [...messages];
    let removedCount = 0;
    let tokensSaved = 0;

    switch (opts.strategy) {
    case "oldest":
      return this.truncateOldest(result, budget, opts);
    case "middle":
      return this.truncateMiddle(result, budget, opts);
    case "smart":
      return this.truncateSmart(result, budget, opts);
    default:
      return this.truncateOldest(result, budget, opts);
    }
  }

  /** 从最旧消息开始截断 */
  private truncateOldest(
    messages: Array<{ role: string; content: string }>,
    budget: number,
    options: TruncationOptions,
  ): TruncationResult {
    const result: Array<{ role: string; content: string }> = [];
    let removedCount = 0;
    let tokensSaved = 0;

    const systemMessages = options.preserveSystemMessages
      ? messages.filter((m) => m.role === "system")
      : [];

    const nonSystemMessages = options.preserveSystemMessages
      ? messages.filter((m) => m.role !== "system")
      : [...messages];

    const recentMessages = nonSystemMessages.slice(-options.preserveRecentMessages);
    const olderMessages = nonSystemMessages.slice(0, -options.preserveRecentMessages);

    result.push(...systemMessages);
    result.push(...recentMessages);

    let currentTokens = this.counter.countMessages(result).total;

    for (let i = olderMessages.length - 1; i >= 0; i--) {
      const msgTokens = this.counter.count(olderMessages[i].content) + 4;
      if (currentTokens + msgTokens <= budget) {
        result.splice(systemMessages.length, 0, olderMessages[i]);
        currentTokens += msgTokens;
      } else {
        removedCount++;
        tokensSaved += msgTokens;
      }
    }

    return {
      messages: result,
      removedCount,
      tokensSaved,
      withinBudget: currentTokens <= budget,
    };
  }

  /** 从中间截断 */
  private truncateMiddle(
    messages: Array<{ role: string; content: string }>,
    budget: number,
    options: TruncationOptions,
  ): TruncationResult {
    const systemMessages = options.preserveSystemMessages
      ? messages.filter((m) => m.role === "system")
      : [];

    const nonSystemMessages = options.preserveSystemMessages
      ? messages.filter((m) => m.role !== "system")
      : [...messages];

    const keepStart = Math.max(2, options.minMessagesToKeep);
    const keepEnd = options.preserveRecentMessages;

    const startMessages = nonSystemMessages.slice(0, keepStart);
    const endMessages = nonSystemMessages.slice(-keepEnd);
    const middleMessages = nonSystemMessages.slice(keepStart, -keepEnd);

    const result = [...systemMessages, ...startMessages, ...endMessages];
    let currentTokens = this.counter.countMessages(result).total;
    let removedCount = 0;
    let tokensSaved = 0;

    for (const msg of middleMessages) {
      const msgTokens = this.counter.count(msg.content) + 4;
      removedCount++;
      tokensSaved += msgTokens;
    }

    return {
      messages: result,
      removedCount,
      tokensSaved,
      withinBudget: currentTokens <= budget,
    };
  }

  /** 智能截断 (优先保留重要消息) */
  private truncateSmart(
    messages: Array<{ role: string; content: string }>,
    budget: number,
    options: TruncationOptions,
  ): TruncationResult {
    const scored = messages.map((msg, index) => ({
      msg,
      index,
      score: this.scoreMessage(msg, index, messages.length),
      tokens: this.counter.count(msg.content) + 4,
    }));

    scored.sort((a, b) => b.score - a.score);

    const selected: typeof scored = [];
    let currentTokens = 3;
    let removedCount = 0;
    let tokensSaved = 0;

    for (const item of scored) {
      if (currentTokens + item.tokens <= budget) {
        selected.push(item);
        currentTokens += item.tokens;
      } else {
        removedCount++;
        tokensSaved += item.tokens;
      }
    }

    selected.sort((a, b) => a.index - b.index);

    return {
      messages: selected.map((s) => s.msg),
      removedCount,
      tokensSaved,
      withinBudget: currentTokens <= budget,
    };
  }

  /** 计算消息重要性分数 */
  private scoreMessage(
    msg: { role: string; content: string },
    index: number,
    total: number,
  ): number {
    let score = 0;

    if (msg.role === "system") score += 100;

    const recency = (index + 1) / total;
    score += recency * 50;

    if (msg.content.includes("?")) score += 5;
    if (msg.content.length > 200) score += 10;

    return score;
  }

  /** 更新预算配置 */
  updateBudget(budget: Partial<TokenBudgetConfig>): void {
    this.budget = { ...this.budget, ...budget };
  }

  /** 获取预算配置 */
  getBudget(): TokenBudgetConfig {
    return { ...this.budget };
  }
}

// ============================================================================
//                              便捷函数
// ============================================================================

/** 创建 Token 管理器 */
export function createTokenManager(
  budget?: Partial<TokenBudgetConfig>,
): TokenManager {
  return new TokenManager(undefined, budget);
}

/** 创建带缓存的 Token 管理器 */
export function createCachedTokenManager(
  budget?: Partial<TokenBudgetConfig>,
  cacheOptions?: { maxCacheSize?: number; minCacheLength?: number },
): TokenManager {
  const counter = new CachedTokenCounter(undefined, cacheOptions);
  return new TokenManager(counter, budget);
}

/** 快速计算 Token 数 */
export function quickTokenCount(text: string): number {
  return new CL100KTokenCounter().count(text);
}

/** 快速检查是否超出预算 */
export function isOverBudget(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
): boolean {
  const counter = new CL100KTokenCounter();
  return counter.countMessages(messages).total > maxTokens;
}
