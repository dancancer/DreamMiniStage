/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         SSE 流式响应处理器                                 ║
 * ║                                                                            ║
 * ║  职责：                                                                    ║
 * ║  1. 解析 Server-Sent Events 流                                            ║
 * ║  2. 处理 OpenAI/Claude 兼容格式的流式响应                                   ║
 * ║  3. 提供统一的流式数据回调接口                                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { ReasoningExtractor } from "./reasoning-extractor";

// ============================================================================
//                              类型定义
// ============================================================================

/** 流式事件类型 */
export type StreamEventType = "content" | "reasoning" | "done" | "error";

/** 流式事件数据 */
export interface StreamEvent {
  type: StreamEventType;
  content?: string;
  reasoning?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** 流式处理回调 */
export interface StreamCallbacks {
  onContent?: (content: string, accumulated: string) => void;
  onReasoning?: (reasoning: string, accumulated: string) => void;
  onDone?: (result: StreamResult) => void;
  onError?: (error: Error) => void;
}

/** 流式处理结果 */
export interface StreamResult {
  content: string;
  reasoning: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** OpenAI 流式 chunk 格式 */
interface OpenAIStreamChunk {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
//                              SSE 解析器
// ============================================================================

/**
 * 解析 SSE 流并处理每个事件
 *
 * 好品味：统一处理 OpenAI/Claude 格式，消除特殊情况
 */
export async function processSSEStream(
  response: Response,
  callbacks: StreamCallbacks,
): Promise<StreamResult> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }

  const decoder = new TextDecoder();
  const reasoningExtractor = new ReasoningExtractor();

  let accumulatedContent = "";
  let accumulatedReasoning = "";
  let usage: StreamResult["usage"] = undefined;
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      // 保留最后一行（可能不完整）
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();

        // 跳过空行和注释
        if (!trimmed || trimmed.startsWith(":")) continue;

        // 处理 SSE data 行
        if (trimmed.startsWith("data:")) {
          const data = trimmed.slice(5).trim();

          // 流结束标记
          if (data === "[DONE]") continue;

          try {
            const chunk = JSON.parse(data) as OpenAIStreamChunk;
            const result = processChunk(chunk, reasoningExtractor);

            if (result.content) {
              accumulatedContent += result.content;
              callbacks.onContent?.(result.content, accumulatedContent);
            }

            if (result.reasoning) {
              accumulatedReasoning += result.reasoning;
              callbacks.onReasoning?.(result.reasoning, accumulatedReasoning);
            }

            if (result.usage) {
              usage = result.usage;
            }
          } catch {
            // 忽略解析错误，可能是不完整的 JSON
          }
        }
      }
    }

    // 处理剩余 buffer
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("data:")) {
        const data = trimmed.slice(5).trim();
        if (data && data !== "[DONE]") {
          try {
            const chunk = JSON.parse(data) as OpenAIStreamChunk;
            const result = processChunk(chunk, reasoningExtractor);
            if (result.content) {
              accumulatedContent += result.content;
              callbacks.onContent?.(result.content, accumulatedContent);
            }
            if (result.reasoning) {
              accumulatedReasoning += result.reasoning;
              callbacks.onReasoning?.(result.reasoning, accumulatedReasoning);
            }
          } catch {
            // 忽略
          }
        }
      }
    }

    // 完成处理
    const finalResult: StreamResult = {
      content: accumulatedContent,
      reasoning: accumulatedReasoning,
      usage,
    };

    callbacks.onDone?.(finalResult);
    return finalResult;

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    callbacks.onError?.(err);
    throw err;
  } finally {
    reader.releaseLock();
  }
}

/**
 * 处理单个流式 chunk
 */
function processChunk(
  chunk: OpenAIStreamChunk,
  reasoningExtractor: ReasoningExtractor,
): { content?: string; reasoning?: string; usage?: StreamResult["usage"] } {
  const choice = chunk.choices?.[0];
  if (!choice) {
    return { usage: chunk.usage ? {
      promptTokens: chunk.usage.prompt_tokens,
      completionTokens: chunk.usage.completion_tokens,
      totalTokens: chunk.usage.total_tokens,
    } : undefined };
  }

  const delta = choice.delta;
  let content: string | undefined;
  let reasoning: string | undefined;

  // 处理 reasoning_content（Claude 格式）
  if (delta.reasoning_content) {
    reasoning = delta.reasoning_content;
  }

  // 处理 content，提取内嵌的 thinking 标签
  if (delta.content) {
    const extracted = reasoningExtractor.processChunk(delta.content);
    content = extracted.output || undefined;
    if (extracted.reasoning) {
      reasoning = (reasoning || "") + extracted.reasoning;
    }
  }

  return {
    content,
    reasoning,
    usage: chunk.usage ? {
      promptTokens: chunk.usage.prompt_tokens,
      completionTokens: chunk.usage.completion_tokens,
      totalTokens: chunk.usage.total_tokens,
    } : undefined,
  };
}

// ============================================================================
//                              创建 SSE Response
// ============================================================================

/**
 * 创建 SSE 格式的 Response
 *
 * 用于服务端返回流式响应
 */
export function createSSEResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

/**
 * 创建 SSE 数据行
 */
export function formatSSEData(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * 创建 SSE 结束标记
 */
export function formatSSEDone(): string {
  return "data: [DONE]\n\n";
}
