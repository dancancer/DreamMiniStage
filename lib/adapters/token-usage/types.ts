/* ═══════════════════════════════════════════════════════════════════════════
   Token Usage 适配器类型定义

   设计理念：
   - 统一不同 LLM 提供商的 token 统计格式
   - 使用适配器链处理多种响应格式
   - 提供一致的 null 返回值语义
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────────────────────
   Token Usage 数据结构
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 统一的 Token 使用量数据结构
 *
 * 所有 LLM 提供商的 token 统计都将转换为此格式
 */
export interface TokenUsage {
  /** 输入/提示词消耗的 token 数 */
  promptTokens: number;

  /** 输出/完成消耗的 token 数 */
  completionTokens: number;

  /** 总 token 数 */
  totalTokens: number;
}

/* ─────────────────────────────────────────────────────────────────────────────
   适配器接口定义
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Token Usage 适配器接口
 *
 * 职责：
 * - 检测 LLM 响应是否包含特定格式的 token 使用量
 * - 提取并转换为统一的 TokenUsage 格式
 *
 * 设计原则：
 * - canHandle 必须是纯函数，无副作用
 * - extract 在无 token 信息时返回 null
 * - 每个适配器只处理一种提供商/格式
 */
export interface TokenUsageAdapter {
  /** 检测响应是否匹配此适配器 */
  canHandle(response: unknown): boolean;

  /** 提取 token 使用量，不存在时返回 null */
  extract(response: unknown): TokenUsage | null;

  /** 适配器名称，用于日志和调试 */
  readonly name: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   提取器接口定义
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Token Usage 提取器接口
 *
 * 职责：
 * - 管理多个适配器
 * - 自动选择匹配的适配器提取 token 使用量
 */
export interface TokenUsageExtractor {
  /** 注册新适配器 */
  register(adapter: TokenUsageAdapter): void;

  /** 从响应中提取 token 使用量 */
  extract(response: unknown): TokenUsage | null;

  /** 获取所有已注册的适配器名称 */
  getAdapterNames(): string[];
}

/* ─────────────────────────────────────────────────────────────────────────────
   提取器实现
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Token Usage 提取器实现类
 *
 * 设计要点：
 * - 适配器按注册顺序检测
 * - 第一个匹配的适配器用于提取
 * - 无匹配时返回 null（而非抛出错误）
 */
class TokenUsageExtractorImpl implements TokenUsageExtractor {
  private adapters: TokenUsageAdapter[] = [];

  constructor(adapters: TokenUsageAdapter[] = []) {
    this.adapters = [...adapters];
  }

  register(adapter: TokenUsageAdapter): void {
    this.adapters.push(adapter);
  }

  extract(response: unknown): TokenUsage | null {
    for (const adapter of this.adapters) {
      if (adapter.canHandle(response)) {
        return adapter.extract(response);
      }
    }
    return null;
  }

  getAdapterNames(): string[] {
    return this.adapters.map((a) => a.name);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   工厂函数
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 创建 Token Usage 提取器
 *
 * @param adapters - 初始适配器列表
 * @returns 新的提取器实例
 *
 * @example
 * const extractor = createTokenUsageExtractor([
 *   openaiAdapter,
 *   anthropicAdapter,
 *   googleAdapter,
 * ]);
 * const usage = extractor.extract(llmResponse);
 */
export function createTokenUsageExtractor(
  adapters: TokenUsageAdapter[] = [],
): TokenUsageExtractor {
  return new TokenUsageExtractorImpl(adapters);
}

/* ─────────────────────────────────────────────────────────────────────────────
   类型守卫辅助函数
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 检查值是否为非空对象
 */
export function isNonNullObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 安全获取嵌套属性
 */
export function getNestedProperty(
  obj: unknown,
  path: string[],
): unknown {
  let current = obj;
  for (const key of path) {
    if (!isNonNullObject(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
