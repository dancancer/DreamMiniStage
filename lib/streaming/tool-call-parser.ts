/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         流式 Tool Call 解析器                              ║
 * ║                                                                            ║
 * ║  解析流式响应中的 tool_calls                                                ║
 * ║  支持并行工具调用和增量解析                                                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              类型定义
// ============================================================================

/** Tool Call 状态 */
export type ToolCallStatus = "pending" | "streaming" | "complete" | "error";

/** Tool Call 条目 */
export interface ToolCallEntry {
  id: string;
  index: number;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
  status: ToolCallStatus;
  parsedArguments?: unknown;
  error?: string;
}

/** 流式 Delta */
export interface StreamDelta {
  content?: string;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: "function";
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

/** 解析结果 */
export interface ParseResult {
  content: string;
  toolCalls: ToolCallEntry[];
  isComplete: boolean;
  hasToolCalls: boolean;
}

// ============================================================================
//                              Tool Call 解析器
// ============================================================================

/** 流式 Tool Call 解析器 */
export class ToolCallParser {
  private content = "";
  private toolCalls: Map<number, ToolCallEntry> = new Map();
  private isComplete = false;

  /** 处理流式 delta */
  processDelta(delta: StreamDelta): void {
    if (delta.content) {
      this.content += delta.content;
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        this.processToolCallDelta(tc);
      }
    }
  }

  /** 处理 tool_calls delta */
  private processToolCallDelta(tc: NonNullable<StreamDelta["tool_calls"]>[number]): void {
    let entry = this.toolCalls.get(tc.index);

    if (!entry) {
      entry = {
        id: tc.id || `tool_${tc.index}`,
        index: tc.index,
        type: "function",
        function: { name: "", arguments: "" },
        status: "streaming",
      };
      this.toolCalls.set(tc.index, entry);
    }

    if (tc.id) entry.id = tc.id;
    if (tc.function?.name) entry.function.name += tc.function.name;
    if (tc.function?.arguments) entry.function.arguments += tc.function.arguments;
  }

  /** 标记完成 */
  markComplete(): void {
    this.isComplete = true;

    for (const entry of this.toolCalls.values()) {
      this.finalizeToolCall(entry);
    }
  }

  /** 完成单个 tool call */
  private finalizeToolCall(entry: ToolCallEntry): void {
    entry.status = "complete";

    try {
      if (entry.function.arguments) {
        entry.parsedArguments = JSON.parse(entry.function.arguments);
      }
    } catch (e) {
      entry.status = "error";
      entry.error = `JSON 解析失败: ${(e as Error).message}`;
    }
  }

  /** 获取解析结果 */
  getResult(): ParseResult {
    const toolCalls = this.collectToolCalls();

    return {
      content: this.content,
      toolCalls,
      isComplete: this.isComplete,
      hasToolCalls: toolCalls.length > 0,
    };
  }

  /** 获取内容 */
  getContent(): string {
    return this.content;
  }

  /** 获取 tool calls */
  getToolCalls(): ToolCallEntry[] {
    return this.collectToolCalls(false);
  }

  /** 检查是否有 tool calls */
  hasToolCalls(): boolean {
    return this.toolCalls.size > 0;
  }

  /** 重置解析器 */
  reset(): void {
    this.content = "";
    this.toolCalls.clear();
    this.isComplete = false;
  }

  /** 汇总并去重 tool calls */
  private collectToolCalls(shouldLog = true): ToolCallEntry[] {
    return dedupeToolCalls(
      Array.from(this.toolCalls.values()),
      shouldLog ? { logSource: "ToolCallParser" } : undefined,
    );
  }
}

// ============================================================================
//                              Tool Call 执行器
// ============================================================================

/** Tool 定义 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: unknown) => Promise<unknown>;
}

/** Tool 执行结果 */
export interface ToolExecutionResult {
  toolCallId: string;
  name: string;
  result?: unknown;
  error?: string;
  duration: number;
}

/** Tool Call 执行器 */
export class ToolCallExecutor {
  private tools: Map<string, ToolDefinition> = new Map();

  /** 注册工具 */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /** 批量注册工具 */
  registerTools(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /** 获取工具 */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /** 获取所有工具定义 (用于 API 请求) */
  getToolDefinitions(): Array<{ type: "function"; function: Omit<ToolDefinition, "handler"> }> {
    return Array.from(this.tools.values()).map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /** 执行单个 tool call */
  async executeToolCall(entry: ToolCallEntry): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const tool = this.tools.get(entry.function.name);

    if (!tool) {
      return {
        toolCallId: entry.id,
        name: entry.function.name,
        error: `未知工具: ${entry.function.name}`,
        duration: Date.now() - startTime,
      };
    }

    try {
      const args = entry.parsedArguments ?? JSON.parse(entry.function.arguments);
      const result = await tool.handler(args);

      return {
        toolCallId: entry.id,
        name: entry.function.name,
        result,
        duration: Date.now() - startTime,
      };
    } catch (e) {
      return {
        toolCallId: entry.id,
        name: entry.function.name,
        error: (e as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  /** 并行执行多个 tool calls */
  async executeToolCalls(entries: ToolCallEntry[]): Promise<ToolExecutionResult[]> {
    const dedupedEntries = dedupeToolCalls(entries, { logSource: "ToolCallExecutor" });
    return Promise.all(dedupedEntries.map((entry) => this.executeToolCall(entry)));
  }

  /** 格式化执行结果为消息 */
  formatResultsAsMessages(
    results: ToolExecutionResult[],
  ): Array<{ role: "tool"; tool_call_id: string; content: string }> {
    return results.map((result) => ({
      role: "tool" as const,
      tool_call_id: result.toolCallId,
      content: result.error
        ? JSON.stringify({ error: result.error })
        : JSON.stringify(result.result),
    }));
  }
}

// ============================================================================
//                              便捷函数
// ============================================================================

/** 创建 Tool Call 解析器 */
export function createToolCallParser(): ToolCallParser {
  return new ToolCallParser();
}

/** 创建 Tool Call 执行器 */
export function createToolCallExecutor(): ToolCallExecutor {
  return new ToolCallExecutor();
}

/** 从完整响应中提取 tool calls */
export function extractToolCallsFromResponse(response: {
  choices?: Array<{
    message?: {
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
  }>;
}): ToolCallEntry[] {
  const choice = response.choices?.[0];
  if (!choice?.message) return [];

  const toolCalls = choice.message.tool_calls || [];
  const rawEntries: ToolCallEntry[] = [];

  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i];
    rawEntries.push({
      id: tc.id,
      index: i,
      type: "function",
      function: tc.function,
      status: "complete",
      parsedArguments: safeJsonParse(tc.function.arguments),
    });
  }

  return dedupeToolCalls(rawEntries, { logSource: "ToolCallParser" });
}

function safeJsonParse(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return undefined;
  }
}

/** 构建去重键：函数名 + 参数签名 */
function buildToolCallKey(entry: ToolCallEntry): string {
  const name = entry.function.name || "";
  const argsSource = entry.parsedArguments !== undefined
    ? stableStringify(entry.parsedArguments)
    : (entry.function.arguments || "");
  return `${name}::${argsSource}`;
}

/** 稳定序列化，确保对象键顺序一致 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return String(value);
  }

  try {
    const sorted = Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>(
      (acc, key) => {
        acc[key] = (value as Record<string, unknown>)[key];
        return acc;
      },
      {},
    );
    return JSON.stringify(sorted);
  } catch {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
}

/** 去重工具调用，保留首个出现项 */
function dedupeToolCalls(entries: ToolCallEntry[], options?: { logSource?: string }): ToolCallEntry[] {
  const seen = new Set<string>();
  const result: ToolCallEntry[] = [];

  for (const entry of entries) {
    const key = buildToolCallKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }

  if (options?.logSource && entries.length !== result.length) {
    console.warn(`[${options.logSource}] Deduped ${entries.length - result.length} duplicate tool call(s)`);
  }

  return result;
}
