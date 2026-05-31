import type { PromptContextMessage } from "./prompt-context";

export interface PromptMacroContext {
  charName?: string;
  userName?: string;
  lastUserMessage?: string;
  storyStateVariables?: Record<string, unknown>;
}

export function renderPromptMacros(
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
        variables[set[1]] = renderMacros(set[2] ?? "", context, variables);
        return "";
      }
      const add = body.match(/^addvar::([^:}]+)::([\s\S]*)$/i);
      if (add?.[1]) {
        variables[add[1]] = `${variables[add[1]] ?? ""}${renderMacros(add[2] ?? "", context, variables)}`;
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
  const rendered = content.replace(/\{\{([\s\S]*?)\}\}/g, (_match, body: string) => {
    const scalar = renderKnownMacro(body, context, variables);
    return scalar ?? renderUnknownMacro(body);
  });

  return renderAnglePlaceholders(rendered, context);
}

function renderKnownMacro(
  body: string,
  context: PromptMacroContext,
  variables: Record<string, string>,
): string | undefined {
  const key = body.trim();
  if (/^setvar::/i.test(key) || /^addvar::/i.test(key)) return "";
  if (/^getvar::/i.test(key)) return variables[key.replace(/^getvar::/i, "").trim()] ?? "";
  if (/^get_message_variable::/i.test(key)) return renderMessageVariable(key, context);
  if (/^random::/i.test(key)) return pickDeterministicRandomValue(key, context);
  if (/^roll[:\s]/i.test(key)) return rollDeterministicDice(key, context);
  if (/^trim$/i.test(key)) return "";
  if (/^char$/i.test(key) || /^charIfNotGroup$/i.test(key)) return context.charName ?? "";
  if (/^user$/i.test(key)) return context.userName ?? "user";
  if (/^lastUserMessage$/i.test(key)) return context.lastUserMessage ?? "";
  return undefined;
}

function renderUnknownMacro(body: string): string {
  const key = body.trim();
  if (!key || key.startsWith("//")) return "";
  return `[${key}]`;
}

function renderMessageVariable(
  key: string,
  context: PromptMacroContext,
): string {
  const name = key.replace(/^get_message_variable::/i, "").trim();
  if (name === "stat_data") {
    return JSON.stringify(context.storyStateVariables ?? {}, null, 2);
  }
  return "";
}

function renderAnglePlaceholders(content: string, context: PromptMacroContext): string {
  return content
    .replace(/<char>/gi, context.charName ?? "")
    .replace(/<user>/gi, context.userName ?? "user");
}

function pickDeterministicRandomValue(
  key: string,
  context: PromptMacroContext,
): string {
  const rawOptions = key.replace(/^random::/i, "");
  const separator = rawOptions.includes("::") ? "::" : ",";
  const options = rawOptions
    .split(separator)
    .map((option) => option.trim())
    .filter(Boolean);
  if (options.length === 0) return "";
  return options[stableIndex(`${context.charName ?? ""}|${context.userName ?? ""}|${key}`, options.length)] ?? "";
}

function rollDeterministicDice(
  key: string,
  context: PromptMacroContext,
): string {
  const match = key.match(/^roll(?::|\s+)(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return "";
  const count = Number(match[1] || "1");
  const sides = Number(match[2]);
  const modifier = Number(match[3] || "0");
  if (!Number.isInteger(count) || !Number.isInteger(sides) || count <= 0 || sides <= 0) {
    return "";
  }
  let total = modifier;
  for (let index = 0; index < count; index += 1) {
    total += stableIndex(`${context.charName ?? ""}|${context.userName ?? ""}|${key}|${index}`, sides) + 1;
  }
  return String(total);
}

function stableIndex(seed: string, length: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash % length;
}

function estimateTokens(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}
