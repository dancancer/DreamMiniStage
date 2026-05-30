export const STORY_ACTIONS_SOURCE_TAG = "StoryActions";

export interface StoryActionOption {
  id: string;
  label: string;
  description?: string;
  value: string;
}

export interface StoryActionOptionsResult {
  options: StoryActionOption[];
  sourceTag?: string;
}

const BLOCK_PATTERN = `<${STORY_ACTIONS_SOURCE_TAG}>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/${STORY_ACTIONS_SOURCE_TAG}>`;
const PLACEHOLDER_PATTERN = /此处必须填入|provide|placeholder/i;

export function storyActionsSourcePattern(): string {
  return BLOCK_PATTERN;
}

export function applyStoryActionOptions(
  text: string,
  options: { emitSourceTag: boolean },
): StoryActionOptionsResult {
  const actions = extractStoryActionOptions(text);
  return {
    options: actions,
    sourceTag: options.emitSourceTag && actions.length > 0
      ? buildStoryActionsSourceTag(actions)
      : undefined,
  };
}

export function appendStoryActionsSourceTag(text: string, sourceTag?: string): string {
  return [text.trim(), sourceTag].filter(Boolean).join("\n\n");
}

export function extractStoryActionOptions(text: string): StoryActionOption[] {
  return extractTagBlocks(text, "action")
    .flatMap(parseActionBlock)
    .slice(0, 8)
    .map((line, index) => actionOption(line, index));
}

function parseActionBlock(block: string): string[] {
  return splitActionLines(block)
    .map(cleanActionLine)
    .filter((line) => line.length > 0 && !PLACEHOLDER_PATTERN.test(line));
}

function splitActionLines(block: string): string[] {
  const normalized = block
    .replace(/\r/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .trim();
  const lines = normalized.split(/\n+/).filter((line) => line.trim().length > 0);
  if (lines.length > 1) return lines;
  return normalized.split(/(?:^|\s)(?=[①②③④⑤⑥⑦⑧⑨⑩]|\d+[.)、])/u);
}

function cleanActionLine(line: string): string {
  return line
    .replace(/^\s*[-*•]\s*/u, "")
    .replace(/^\s*(?:[①②③④⑤⑥⑦⑧⑨⑩]|\d+[.)、])\s*/u, "")
    .replace(/^\s*[\[【(（]\s*/u, "")
    .replace(/\s*[\]】)）]\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function actionOption(line: string, index: number): StoryActionOption {
  const parts = line.split(/\s+-\s+|[:：]\s*/u);
  const label = limitText(parts[0] ?? line, 80);
  const description = parts.length > 1 ? limitText(parts.slice(1).join(" - "), 120) : undefined;
  return {
    id: `action-${index + 1}`,
    label,
    description,
    value: line,
  };
}

function buildStoryActionsSourceTag(options: StoryActionOption[]): string {
  return `<${STORY_ACTIONS_SOURCE_TAG}>${JSON.stringify({ options })}</${STORY_ACTIONS_SOURCE_TAG}>`;
}

function extractTagBlocks(text: string, tag: string): string[] {
  return Array.from(text.matchAll(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*<\\/${tag}>`, "gi")))
    .map((match) => match[1] ?? "");
}

function limitText(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}
