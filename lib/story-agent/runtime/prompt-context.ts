import {
  assemblePromptMessages,
  type CompiledPromptMessage,
  type SessionBlueprint,
} from "@/lib/story-agent/blueprint";
import type { WorldHit } from "./world-module";

export type PromptContextSource =
  | "prompt-stack"
  | "world"
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
  memoryMessages?: string[];
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
}

export interface AssemblePromptContextResult {
  messages: PromptContextMessage[];
  omitted: Array<{ id: string; source: PromptContextSource; estimatedTokens: number }>;
  totalTokens: number;
}

export function assemblePromptContext(
  input: AssemblePromptContextInput,
): AssemblePromptContextResult {
  const messages = [
    ...assemblePromptMessages(input.blueprint).map(fromPromptStack),
    ...(input.worldHits ?? []).map(fromWorldHit),
    ...(input.memoryMessages ?? []).map(fromMemory),
    ...(input.history ?? []).map(fromHistory),
  ];
  return fitBudget(messages, input.maxTokens ?? Infinity);
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

function fitBudget(
  messages: PromptContextMessage[],
  maxTokens: number,
): AssemblePromptContextResult {
  const selected: PromptContextMessage[] = [];
  const omitted: AssemblePromptContextResult["omitted"] = [];
  let totalTokens = 0;

  for (const message of messages.sort(comparePriority)) {
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
    messages: selected.sort(compareOriginalOrder),
    omitted,
    totalTokens,
  };
}

function comparePriority(left: PromptContextMessage, right: PromptContextMessage): number {
  return priority(left.source) - priority(right.source) ||
    left.id.localeCompare(right.id);
}

function compareOriginalOrder(left: PromptContextMessage, right: PromptContextMessage): number {
  return sourceOrder(left.source) - sourceOrder(right.source) ||
    left.id.localeCompare(right.id);
}

function priority(source: PromptContextSource): number {
  if (source === "prompt-stack") return 0;
  if (source === "world") return 1;
  if (source === "memory") return 2;
  return 3;
}

function sourceOrder(source: PromptContextSource): number {
  if (source === "prompt-stack") return 0;
  if (source === "world") return 1;
  if (source === "memory") return 2;
  return 3;
}

function estimateTokens(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}
