/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Summarize 扩展                                     ║
 * ║                                                                            ║
 * ║  实现聊天摘要生成和管理                                                      ║
 * ║  支持增量摘要和摘要压缩                                                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              类型定义
// ============================================================================

/** 摘要配置 */
export interface SummarizeConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 触发摘要的消息数阈值 */
  triggerThreshold: number;
  /** 每次摘要的消息数 */
  messagesPerSummary: number;
  /** 摘要最大长度 */
  maxSummaryLength: number;
  /** 摘要深度 (注入位置) */
  injectionDepth: number;
  /** 摘要提示词模板 */
  promptTemplate: string;
  /** 是否保留最近消息 */
  preserveRecentMessages: number;
}

/** 摘要条目 */
export interface SummaryEntry {
  id: string;
  content: string;
  messageRange: { start: number; end: number };
  timestamp: number;
  tokenCount?: number;
}

/** 摘要状态 */
export interface SummarizeState {
  summaries: SummaryEntry[];
  lastSummarizedMessageId: number;
  totalTokensSaved: number;
}

/** 摘要生成请求 */
export interface SummarizeRequest {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  startMessageId: number;
  endMessageId: number;
  context?: {
    characterName?: string;
    userName?: string;
    scenario?: string;
  };
}

/** 摘要生成结果 */
export interface SummarizeResult {
  success: boolean;
  summary?: string;
  tokenCount?: number;
  error?: string;
}

// ============================================================================
//                              默认配置
// ============================================================================

export const DEFAULT_SUMMARIZE_CONFIG: SummarizeConfig = {
  enabled: true,
  triggerThreshold: 20,
  messagesPerSummary: 10,
  maxSummaryLength: 500,
  injectionDepth: 2,
  preserveRecentMessages: 5,
  promptTemplate: `请将以下对话内容总结为简洁的摘要，保留关键信息和情节发展：

{{messages}}

要求：
1. 保留重要的情节转折和角色互动
2. 记录关键的决定和事件
3. 保持第三人称叙述
4. 控制在 {{maxLength}} 字以内`,
};

/** 默认摘要状态 */
export const DEFAULT_SUMMARIZE_STATE: SummarizeState = {
  summaries: [],
  lastSummarizedMessageId: 0,
  totalTokensSaved: 0,
};

// ============================================================================
//                              摘要管理器
// ============================================================================

/** 摘要生成函数类型 */
export type SummaryGenerator = (request: SummarizeRequest) => Promise<SummarizeResult>;

/** 摘要管理器 */
export class SummarizeManager {
  private config: SummarizeConfig;
  private state: SummarizeState;
  private generator?: SummaryGenerator;

  constructor(config?: Partial<SummarizeConfig>, state?: Partial<SummarizeState>) {
    this.config = { ...DEFAULT_SUMMARIZE_CONFIG, ...config };
    this.state = { ...DEFAULT_SUMMARIZE_STATE, ...state };
  }

  /** 设置摘要生成器 */
  setGenerator(generator: SummaryGenerator): void {
    this.generator = generator;
  }

  /** 检查是否需要生成摘要 */
  shouldSummarize(currentMessageCount: number): boolean {
    if (!this.config.enabled) return false;

    const unsummarizedCount = currentMessageCount - this.state.lastSummarizedMessageId;
    return unsummarizedCount >= this.config.triggerThreshold;
  }

  /** 生成摘要 */
  async summarize(request: SummarizeRequest): Promise<SummarizeResult> {
    if (!this.generator) {
      return { success: false, error: "摘要生成器未设置" };
    }

    const result = await this.generator(request);

    if (result.success && result.summary) {
      const entry: SummaryEntry = {
        id: `summary_${Date.now()}`,
        content: result.summary,
        messageRange: { start: request.startMessageId, end: request.endMessageId },
        timestamp: Date.now(),
        tokenCount: result.tokenCount,
      };

      this.state.summaries.push(entry);
      this.state.lastSummarizedMessageId = request.endMessageId;

      if (result.tokenCount) {
        this.state.totalTokensSaved += result.tokenCount;
      }
    }

    return result;
  }

  /** 获取合并后的摘要 */
  getCombinedSummary(): string {
    if (this.state.summaries.length === 0) return "";

    return this.state.summaries
      .map((s) => s.content)
      .join("\n\n---\n\n");
  }

  /** 获取最新摘要 */
  getLatestSummary(): SummaryEntry | undefined {
    return this.state.summaries[this.state.summaries.length - 1];
  }

  /** 压缩摘要 (合并多个摘要为一个) */
  async compressSummaries(): Promise<SummarizeResult> {
    if (this.state.summaries.length < 2) {
      return { success: true, summary: this.getCombinedSummary() };
    }

    if (!this.generator) {
      return { success: false, error: "摘要生成器未设置" };
    }

    const combinedContent = this.getCombinedSummary();
    const request: SummarizeRequest = {
      messages: [{ role: "system", content: combinedContent }],
      startMessageId: this.state.summaries[0].messageRange.start,
      endMessageId: this.state.summaries[this.state.summaries.length - 1].messageRange.end,
    };

    const result = await this.generator(request);

    if (result.success && result.summary) {
      const compressedEntry: SummaryEntry = {
        id: `summary_compressed_${Date.now()}`,
        content: result.summary,
        messageRange: {
          start: request.startMessageId,
          end: request.endMessageId,
        },
        timestamp: Date.now(),
        tokenCount: result.tokenCount,
      };

      this.state.summaries = [compressedEntry];
    }

    return result;
  }

  /** 清除指定消息之后的摘要 */
  clearSummariesAfter(messageId: number): number {
    const before = this.state.summaries.length;
    this.state.summaries = this.state.summaries.filter(
      (s) => s.messageRange.end <= messageId,
    );

    if (this.state.summaries.length > 0) {
      this.state.lastSummarizedMessageId =
        this.state.summaries[this.state.summaries.length - 1].messageRange.end;
    } else {
      this.state.lastSummarizedMessageId = 0;
    }

    return before - this.state.summaries.length;
  }

  /** 获取配置 */
  getConfig(): SummarizeConfig {
    return { ...this.config };
  }

  /** 更新配置 */
  updateConfig(config: Partial<SummarizeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** 获取状态 */
  getState(): SummarizeState {
    return {
      ...this.state,
      summaries: [...this.state.summaries],
    };
  }

  /** 导入状态 */
  importState(state: Partial<SummarizeState>): void {
    this.state = { ...this.state, ...state };
  }

  /** 清空所有摘要 */
  clear(): void {
    this.state = { ...DEFAULT_SUMMARIZE_STATE };
  }

  /** 获取统计信息 */
  getStats(): {
    summaryCount: number;
    totalLength: number;
    lastSummarizedMessageId: number;
    tokensSaved: number;
    } {
    return {
      summaryCount: this.state.summaries.length,
      totalLength: this.state.summaries.reduce((sum, s) => sum + s.content.length, 0),
      lastSummarizedMessageId: this.state.lastSummarizedMessageId,
      tokensSaved: this.state.totalTokensSaved,
    };
  }
}

// ============================================================================
//                              摘要提示词构建
// ============================================================================

/** 构建摘要提示词 */
export function buildSummarizePrompt(
  messages: Array<{ role: string; content: string }>,
  config: SummarizeConfig,
  context?: { characterName?: string; userName?: string },
): string {
  const formattedMessages = messages
    .map((m) => {
      const speaker = m.role === "user"
        ? (context?.userName || "User")
        : m.role === "assistant"
          ? (context?.characterName || "Assistant")
          : "System";
      return `${speaker}: ${m.content}`;
    })
    .join("\n\n");

  return config.promptTemplate
    .replace("{{messages}}", formattedMessages)
    .replace("{{maxLength}}", String(config.maxSummaryLength));
}

/** 估算消息 token 数 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/** 选择需要摘要的消息 */
export function selectMessagesForSummary(
  messages: Array<{ role: string; content: string }>,
  config: SummarizeConfig,
  startIndex: number,
): Array<{ role: string; content: string }> {
  const endIndex = Math.min(
    startIndex + config.messagesPerSummary,
    messages.length - config.preserveRecentMessages,
  );

  if (endIndex <= startIndex) return [];

  return messages.slice(startIndex, endIndex);
}

// ============================================================================
//                              便捷函数
// ============================================================================

/** 创建摘要管理器 */
export function createSummarizeManager(
  config?: Partial<SummarizeConfig>,
  state?: Partial<SummarizeState>,
): SummarizeManager {
  return new SummarizeManager(config, state);
}

/** 创建默认摘要生成器 (需要传入 LLM 调用函数) */
export function createDefaultGenerator(
  llmCall: (prompt: string) => Promise<string>,
  config: SummarizeConfig = DEFAULT_SUMMARIZE_CONFIG,
): SummaryGenerator {
  return async (request: SummarizeRequest): Promise<SummarizeResult> => {
    try {
      const prompt = buildSummarizePrompt(request.messages, config, request.context);
      const summary = await llmCall(prompt);
      const tokenCount = estimateTokenCount(request.messages.map((m) => m.content).join(""));

      return {
        success: true,
        summary: summary.slice(0, config.maxSummaryLength),
        tokenCount,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
}

// ============================================================================
//                              1_memory 扩展集成
// ============================================================================

/** Memory 存储配置 */
export interface MemoryStorageConfig {
  storageKey: string;
  maxEntries: number;
  autoSave: boolean;
}

/** 默认 Memory 存储配置 */
export const DEFAULT_MEMORY_STORAGE_CONFIG: MemoryStorageConfig = {
  storageKey: "dreamministage_memory",
  maxEntries: 100,
  autoSave: true,
};

/** Memory 存储管理器 - 集成 1_memory 扩展 */
export class MemoryStorageManager {
  private config: MemoryStorageConfig;
  private summarizeManager: SummarizeManager;
  private storage: Storage | null;

  constructor(
    summarizeManager: SummarizeManager,
    config?: Partial<MemoryStorageConfig>,
    storage?: Storage,
  ) {
    this.config = { ...DEFAULT_MEMORY_STORAGE_CONFIG, ...config };
    this.summarizeManager = summarizeManager;
    this.storage = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  }

  /** 保存摘要到存储 */
  save(): boolean {
    if (!this.storage) return false;

    try {
      const state = this.summarizeManager.getState();
      this.storage.setItem(this.config.storageKey, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  /** 从存储加载摘要 */
  load(): boolean {
    if (!this.storage) return false;

    try {
      const data = this.storage.getItem(this.config.storageKey);
      if (!data) return false;

      const state = JSON.parse(data) as Partial<SummarizeState>;
      this.summarizeManager.importState(state);
      return true;
    } catch {
      return false;
    }
  }

  /** 清除存储 */
  clear(): void {
    if (this.storage) {
      this.storage.removeItem(this.config.storageKey);
    }
    this.summarizeManager.clear();
  }

  /** 获取用于注入的摘要内容 */
  getInjectionContent(): string {
    const summary = this.summarizeManager.getCombinedSummary();
    if (!summary) return "";
    return `[Story Summary]\n${summary}`;
  }

  /** 检查并自动生成摘要 */
  async checkAndSummarize(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    currentMessageId: number,
  ): Promise<boolean> {
    if (!this.summarizeManager.shouldSummarize(currentMessageId)) {
      return false;
    }

    const config = this.summarizeManager.getConfig();
    const state = this.summarizeManager.getState();
    const startId = state.lastSummarizedMessageId;
    const endId = Math.min(startId + config.messagesPerSummary, currentMessageId - config.preserveRecentMessages);

    if (endId <= startId) return false;

    const messagesToSummarize = messages.slice(startId, endId);
    if (messagesToSummarize.length === 0) return false;

    const result = await this.summarizeManager.summarize({
      messages: messagesToSummarize,
      startMessageId: startId,
      endMessageId: endId,
    });

    if (result.success && this.config.autoSave) {
      this.save();
    }

    return result.success;
  }
}

/** 创建 Memory 存储管理器 */
export function createMemoryStorageManager(
  summarizeManager: SummarizeManager,
  config?: Partial<MemoryStorageConfig>,
): MemoryStorageManager {
  return new MemoryStorageManager(summarizeManager, config);
}
