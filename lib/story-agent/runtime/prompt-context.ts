import {
  assemblePromptMessages,
  type CompiledPromptMessage,
  type PromptMessageOverride,
  type SessionBlueprint,
} from "@/lib/story-agent/blueprint";
import type { WorldHit } from "./world-module";
import {
  renderPromptMacros,
  type PromptMacroContext,
} from "./prompt-macros";

export type PromptContextSource =
  | "prompt-stack"
  | "world"
  | "render"
  | "memory"
  | "history";

export interface PromptContextMessage {
  id: string;
  role: "system" | "user" | "assistant" | "unknown";
  content: string;
  source: PromptContextSource;
  sourcePath?: string;
  estimatedTokens: number;
}

export interface AssemblePromptContextInput {
  blueprint: Pick<SessionBlueprint, "promptStack">;
  worldHits?: WorldHit[];
  renderMessages?: string[];
  memoryMessages?: string[];
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  requiredHistoryIndexes?: number[];
  macroContext?: PromptMacroContext;
  maxTokens?: number;
  /** 会话级提示词条目覆盖（按 promptStack 条目 id）。 */
  promptOverrides?: Record<string, PromptMessageOverride>;
}

export interface AssemblePromptContextResult {
  messages: PromptContextMessage[];
  omitted: Array<{ id: string; source: PromptContextSource; estimatedTokens: number }>;
  totalTokens: number;
}

export function assemblePromptContext(
  input: AssemblePromptContextInput,
): AssemblePromptContextResult {
  const messages = renderPromptMacros([
    ...assemblePromptMessages(input.blueprint, input.promptOverrides).map(fromPromptStack),
    ...(input.worldHits ?? []).map(fromWorldHit),
    ...(input.renderMessages ?? []).map(fromRender),
    ...(input.memoryMessages ?? []).map(fromMemory),
    ...(input.history ?? []).map(fromHistory),
  ], input.macroContext);
  return fitBudget(messages, input.maxTokens ?? Infinity, requiredMessageIds(messages, input));
}

export function normalizePromptContextForModel(
  messages: PromptContextMessage[],
): PromptContextMessage[] {
  const latestUserContent = latestUserHistoryContent(messages);
  const normalized: PromptContextMessage[] = [];
  let contextBuffer: PromptContextMessage[] = [];

  for (const message of messages
    .map(asRuntimeContextMessage)
    .map((message) => removeContextUserEcho(message, latestUserContent))) {
    if (!message.content.trim()) continue;
    if (isMergeableSystemContext(message)) {
      contextBuffer.push(message);
    } else {
      normalized.push(...flushSystemContext(contextBuffer));
      contextBuffer = [];
      normalized.push(message);
    }
  }

  normalized.push(...flushSystemContext(contextBuffer));
  return normalized;
}

function fromPromptStack(message: CompiledPromptMessage): PromptContextMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    source: "prompt-stack",
    sourcePath: message.sourcePath,
    estimatedTokens: estimateTokens(message.content),
  };
}

function fromWorldHit(hit: WorldHit): PromptContextMessage {
  return {
    id: `world:${hit.moduleId}:${hit.entryId}`,
    role: "system",
    content: hit.content,
    source: "world",
    sourcePath: hit.sourcePath,
    estimatedTokens: estimateTokens(hit.content),
  };
}

function fromRender(content: string, index: number): PromptContextMessage {
  return {
    id: `render:${index}`,
    role: "system",
    content,
    source: "render",
    estimatedTokens: estimateTokens(content),
  };
}

function fromMemory(content: string, index: number): PromptContextMessage {
  return {
    id: `memory:${index}`,
    role: "system",
    content,
    source: "memory",
    estimatedTokens: estimateTokens(content),
  };
}

function fromHistory(
  message: { role: "user" | "assistant"; content: string },
  index: number,
): PromptContextMessage {
  return {
    id: `history:${index}`,
    role: message.role,
    content: message.content,
    source: "history",
    estimatedTokens: estimateTokens(message.content),
  };
}

function flushSystemContext(messages: PromptContextMessage[]): PromptContextMessage[] {
  if (messages.length === 0) return [];
  if (messages.length === 1) return messages;
  const content = formatSystemContext(messages);
  return [{
    id: `story-context:${messages[0]?.id ?? "start"}:${messages.at(-1)?.id ?? "end"}`,
    role: "system",
    content,
    source: "prompt-stack",
    sourcePath: "story-agent/runtime-normalized-context",
    estimatedTokens: estimateTokens(content),
  }];
}

function formatSystemContext(messages: PromptContextMessage[]): string {
  return groupAdjacentContextSections(messages)
    .map((section) => [
      `[${contextSectionTitle(section.source)}]`,
      section.messages
        .map((message) => message.content.trim())
        .filter(Boolean)
        .join("\n\n"),
    ].filter(Boolean).join("\n"))
    .join("\n\n");
}

function groupAdjacentContextSections(messages: PromptContextMessage[]): Array<{
  source: PromptContextSource;
  messages: PromptContextMessage[];
}> {
  return messages.reduce<Array<{ source: PromptContextSource; messages: PromptContextMessage[] }>>(
    (sections, message) => {
      const previous = sections.at(-1);
      if (previous?.source === message.source) {
        previous.messages.push(message);
      } else {
        sections.push({ source: message.source, messages: [message] });
      }
      return sections;
    },
    [],
  );
}

function contextSectionTitle(source: PromptContextSource): string {
  if (source === "prompt-stack") return "Story instructions";
  if (source === "world") return "World context";
  if (source === "render") return "UI render contracts";
  if (source === "memory") return "Session memory";
  return "Conversation";
}

function isMergeableSystemContext(message: PromptContextMessage): boolean {
  return message.role === "system" && message.source !== "history";
}

function asRuntimeContextMessage(message: PromptContextMessage): PromptContextMessage {
  if (message.source === "history") return message;
  return { ...message, role: "system" };
}

function latestUserHistoryContent(messages: PromptContextMessage[]): string {
  return [...messages]
    .reverse()
    .find((message) => message.source === "history" && message.role === "user")
    ?.content
    .trim() ?? "";
}

function removeContextUserEcho(
  message: PromptContextMessage,
  latestUserContent: string,
): PromptContextMessage {
  if (!latestUserContent || message.source === "history") return message;
  if (!message.content.includes(latestUserContent)) return message;
  const content = message.content.split(latestUserContent).join("").replace(/[ \t]{2,}/g, " ").trim();
  return {
    ...message,
    content,
    estimatedTokens: estimateTokens(content),
  };
}

function fitBudget(
  messages: PromptContextMessage[],
  maxTokens: number,
  requiredIds: string[] = [],
): AssemblePromptContextResult {
  // 入参 messages 已是最终期望顺序（prompt-stack → world → render → memory → history，
  // 各块内按插入顺序）。记录该原始下标，预算选择后据此还原顺序——绝不能靠 id 字符串排序，
  // 否则 history:10 会排到 history:2 之前（字典序），10 轮后对话历史被打乱、prompt 永远以
  // 第 9 条结尾，模型每轮都续写同一处（剧情卡死）。
  const originalOrder = new Map(messages.map((message, index) => [message.id, index]));
  const selected: PromptContextMessage[] = [];
  const omitted: AssemblePromptContextResult["omitted"] = [];
  const requiredSet = new Set(requiredIds);
  const required = messages.filter((message) => requiredSet.has(message.id));
  let totalTokens = 0;

  for (const message of required) {
    selected.push(message);
    totalTokens += message.estimatedTokens;
  }

  for (const message of [...messages].sort(comparePriority)) {
    if (requiredSet.has(message.id)) continue;
    if (totalTokens + message.estimatedTokens <= maxTokens) {
      selected.push(message);
      totalTokens += message.estimatedTokens;
    } else {
      omitted.push({
        id: message.id,
        source: message.source,
        estimatedTokens: message.estimatedTokens,
      });
    }
  }

  return {
    messages: selected.sort(
      (left, right) => (originalOrder.get(left.id) ?? 0) - (originalOrder.get(right.id) ?? 0),
    ),
    omitted,
    totalTokens,
  };
}

function requiredMessageIds(
  messages: PromptContextMessage[],
  input: AssemblePromptContextInput,
): string[] {
  return [
    ...messages.filter((message) => message.source === "render").map((message) => message.id),
    ...historyIds(input.requiredHistoryIndexes ?? []),
    latestUserHistoryId(messages),
  ].filter((id): id is string => Boolean(id));
}

function historyIds(indexes: number[]): string[] {
  return indexes.map((index) => `history:${index}`);
}

function latestUserHistoryId(messages: PromptContextMessage[]): string | undefined {
  return [...messages]
    .reverse()
    .find((message) => message.source === "history" && message.role === "user")
    ?.id;
}

// 预算驱逐的选择顺序：低优先级 source 先被考虑丢弃。tie-break 用 numeric-aware 比较，
// 使同 source 内按数字下标稳定（history:2 在 history:10 之前），与最终原始顺序一致。
function comparePriority(left: PromptContextMessage, right: PromptContextMessage): number {
  return priority(left.source) - priority(right.source) ||
    left.id.localeCompare(right.id, undefined, { numeric: true });
}

function priority(source: PromptContextSource): number {
  if (source === "prompt-stack") return 0;
  if (source === "world") return 1;
  if (source === "render") return 2;
  if (source === "memory") return 3;
  return 4;
}

function estimateTokens(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}
