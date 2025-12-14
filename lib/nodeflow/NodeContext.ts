/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NodeContext - 节点上下文存储
 *
 * 好品味：类型安全的键值存储，消除 any 的不确定性
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * 节点数据值类型（支持 JSON 可序列化）
 */
export type NodeValue = unknown;

/**
 * 节点上下文存储类
 *
 * 管理节点的输入、缓存和输出数据
 */
export class NodeContext {
  private inputStore: Map<string, NodeValue>;
  private cacheStore: Map<string, NodeValue>;
  private outputStore: Map<string, NodeValue>;

  constructor(
    inputData?: Record<string, NodeValue>,
    cacheData?: Record<string, NodeValue>,
    outputData?: Record<string, NodeValue>,
  ) {
    this.inputStore = new Map(Object.entries(inputData || {}));
    this.cacheStore = new Map(Object.entries(cacheData || {}));
    this.outputStore = new Map(Object.entries(outputData || {}));
  }

  // ========================================
  // Cache 操作
  // ========================================

  setCache(key: string, value: NodeValue): void {
    this.cacheStore.set(key, value);
  }

  getCache(key: string): NodeValue {
    return this.cacheStore.get(key);
  }

  hasCache(key: string): boolean {
    return this.cacheStore.has(key);
  }

  // ========================================
  // Input 操作
  // ========================================

  setInput(key: string, value: NodeValue): void {
    this.inputStore.set(key, value);
  }

  getInput(key: string): NodeValue {
    return this.inputStore.get(key);
  }

  hasInput(key: string): boolean {
    return this.inputStore.has(key);
  }

  // ========================================
  // Output 操作
  // ========================================

  setOutput(key: string, value: NodeValue): void {
    this.outputStore.set(key, value);
  }

  getOutput(key: string): NodeValue {
    return this.outputStore.get(key);
  }

  hasOutput(key: string): boolean {
    return this.outputStore.has(key);
  }

  // ========================================
  // 清理操作
  // ========================================

  clearOutput(): void {
    this.outputStore.clear();
  }

  clearInput(): void {
    this.inputStore.clear();
  }

  clearCache(): void {
    this.cacheStore.clear();
  }

  clear(): void {
    this.inputStore.clear();
    this.cacheStore.clear();
    this.outputStore.clear();
  }

  // ========================================
  // 序列化
  // ========================================

  toJSON(): Record<string, NodeValue> {
    return {
      inputStore: Object.fromEntries(this.inputStore),
      cacheStore: Object.fromEntries(this.cacheStore),
      outputStore: Object.fromEntries(this.outputStore),
    };
  }

  static fromJSON(json: Record<string, NodeValue>): NodeContext {
    const context = new NodeContext(
      json.inputStore as Record<string, NodeValue>,
      json.cacheStore as Record<string, NodeValue>,
      json.outputStore as Record<string, NodeValue>,
    );
    return context;
  }
}
