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
  requiredHistoryIndexes?: number[];
  macroContext?: PromptMacroContext;
  maxTokens?: number;
}

export interface PromptMacroContext {
  charName?: string;
  userName?: string;
  lastUserMessage?: string;
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
    ...assemblePromptMessages(input.blueprint).map(fromPromptStack),
    ...(input.worldHits ?? []).map(fromWorldHit),
    ...(input.memoryMessages ?? []).map(fromMemory),
    ...(input.history ?? []).map(fromHistory),
  ], input.macroContext);
  return fitBudget(messages, input.maxTokens ?? Infinity, requiredMessageIds(messages, input));
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
  requiredIds: string[] = [],
): AssemblePromptContextResult {
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
    messages: selected.sort(compareOriginalOrder),
    omitted,
    totalTokens,
  };
}

function renderPromptMacros(
  messages: PromptContextMessage[],
  context: PromptMacroContext = {},
): PromptContextMessage[] {
  const variables = collectPromptVariables(messages, context);
  return messages.map((message) => {
    const content = renderMacros(message.content, context, variables);
    return {
      ...message,
      content,
      estimatedTokens: estimateTokens(content),
    };
  });
}

function collectPromptVariables(
  messages: PromptContextMessage[],
  context: PromptMacroContext,
): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const message of messages) {
    message.content.replace(/\{\{([\s\S]*?)\}\}/g, (_match, body: string) => {
      const set = body.match(/^setvar::([^:}]+)::([\s\S]*)$/i);
      if (set?.[1]) {
        variables[set[1]] = renderScalarMacros(set[2] ?? "", context, variables);
        return "";
      }
      const add = body.match(/^addvar::([^:}]+)::([\s\S]*)$/i);
      if (add?.[1]) {
        variables[add[1]] = `${variables[add[1]] ?? ""}${renderScalarMacros(add[2] ?? "", context, variables)}`;
      }
      return "";
    });
  }
  return variables;
}

function renderMacros(
  content: string,
  context: PromptMacroContext,
  variables: Record<string, string>,
): string {
  return content.replace(/\{\{([\s\S]*?)\}\}/g, (_match, body: string) => {
    const scalar = renderKnownMacro(body, context, variables);
    return scalar ?? (body.trim().startsWith("//") ? "" : "");
  });
}

function renderScalarMacros(
  content: string,
  context: PromptMacroContext,
  variables: Record<string, string>,
): string {
  return renderMacros(content, context, variables);
}

function renderKnownMacro(
  body: string,
  context: PromptMacroContext,
  variables: Record<string, string>,
): string | undefined {
  const key = body.trim();
  if (/^setvar::/i.test(key) || /^addvar::/i.test(key)) return "";
  if (/^getvar::/i.test(key)) return variables[key.replace(/^getvar::/i, "")] ?? "";
  if (/^trim$/i.test(key)) return "";
  if (/^char$/i.test(key) || /^charIfNotGroup$/i.test(key)) return context.charName ?? "";
  if (/^user$/i.test(key)) return context.userName ?? "user";
  if (/^lastUserMessage$/i.test(key)) return context.lastUserMessage ?? "";
  return undefined;
}

function requiredMessageIds(
  messages: PromptContextMessage[],
  input: AssemblePromptContextInput,
): string[] {
  return [
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
