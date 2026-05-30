export const STORY_STATE_SOURCE_TAG = "StoryState";

export type StoryStateCommandName = "set" | "add" | "remove" | "assign" | "insert";

export interface StoryStateUpdateEvent {
  op: StoryStateCommandName;
  path: string;
  value?: unknown;
}

export interface StoryStateData {
  variables: Record<string, unknown>;
  events: StoryStateUpdateEvent[];
  errors: string[];
  updatedAt: string;
}

export interface StoryStateUpdateResult {
  visibleText: string;
  screenText: string;
  state: StoryStateData;
  appliedEvents: StoryStateUpdateEvent[];
  errors: string[];
  sourceTag?: string;
}

interface ParsedCommand {
  op: StoryStateCommandName;
  args: string[];
}

const UPDATE_TAG = "UpdateVariable";
const HIDDEN_TAGS = [
  "thinking",
  "UpdateVariable",
  "CharacterCard",
  "本周目经历",
  "本周目核心记忆",
  "当前线索",
  "历史的投影",
  "角色提取",
  "action",
];
const BLOCK_PATTERN = `<${STORY_STATE_SOURCE_TAG}>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/${STORY_STATE_SOURCE_TAG}>`;
const DANGEROUS_PATH_PARTS = new Set(["__proto__", "prototype", "constructor"]);

export function createEmptyStoryState(now: string): StoryStateData {
  return {
    variables: {},
    events: [],
    errors: [],
    updatedAt: now,
  };
}

export function storyStateSourcePattern(): string {
  return BLOCK_PATTERN;
}

export function formatStoryStateMessages(state: StoryStateData): string[] {
  if (Object.keys(state.variables).length === 0) return [];
  return [
    [
      "Current structured story state:",
      "<status_current_variables>",
      JSON.stringify(state.variables, null, 2),
      "</status_current_variables>",
      "Use this state as factual continuity. Emit state changes only inside <UpdateVariable> commands.",
    ].join("\n"),
  ];
}

export function applyStoryStateUpdate(
  text: string,
  state: StoryStateData,
  options: { now: string; emitSourceTag: boolean },
): StoryStateUpdateResult {
  const blocks = extractTagBlocks(text, UPDATE_TAG);
  const commands = blocks.flatMap(extractCommands);
  const variables = cloneRecord(state.variables);
  const appliedEvents: StoryStateUpdateEvent[] = [];
  const errors: string[] = [];

  for (const command of commands) {
    const result = safeApplyCommand(variables, command);
    if (result.event) appliedEvents.push(result.event);
    if (result.error) errors.push(result.error);
  }

  const nextState: StoryStateData = {
    variables,
    events: [...state.events, ...appliedEvents].slice(-64),
    errors: errors.slice(-16),
    updatedAt: options.now,
  };
  const visibleText = extractVisibleStoryText(text);
  const sourceTag = options.emitSourceTag && appliedEvents.length > 0
    ? buildStateSourceTag(variables, appliedEvents, errors)
    : undefined;
  const screenText = sourceTag ? appendSourceTag(visibleText, sourceTag) : visibleText;

  return {
    visibleText,
    screenText,
    state: nextState,
    appliedEvents,
    errors,
    sourceTag,
  };
}

function safeApplyCommand(
  variables: Record<string, unknown>,
  command: ParsedCommand,
): { event?: StoryStateUpdateEvent; error?: string } {
  try {
    return applyCommand(variables, command);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { error: `${command.op}: ${message}` };
  }
}

function applyCommand(
  variables: Record<string, unknown>,
  command: ParsedCommand,
): { event?: StoryStateUpdateEvent; error?: string } {
  const path = readPath(command.args[0]);
  const pathError = validatePath(path);
  if (pathError) return { error: `${command.op}: ${pathError}` };

  if (command.op === "remove") {
    unsetPath(variables, path);
    return { event: { op: command.op, path } };
  }

  if (command.op === "add") {
    const delta = Number(parseValue(command.args[1]));
    if (!Number.isFinite(delta)) return { error: `add: ${path} delta is not numeric` };
    const current = Number(readPathValue(variables, path) ?? 0);
    if (!Number.isFinite(current)) return { error: `add: ${path} current value is not numeric` };
    const value = current + delta;
    writePathValue(variables, path, value);
    return { event: { op: command.op, path, value } };
  }

  if (command.op === "set") {
    const value = parseValue(command.args[1]);
    writePathValue(variables, path, value);
    return { event: { op: command.op, path, value } };
  }

  return applyObjectCommand(variables, command, path);
}

function applyObjectCommand(
  variables: Record<string, unknown>,
  command: ParsedCommand,
  path: string,
): { event?: StoryStateUpdateEvent; error?: string } {
  const hasEntryName = command.args.length >= 3;
  const rawValue = hasEntryName ? command.args[2] : command.args[1];
  const value = parseValue(rawValue);
  if (!isRecord(value)) return { error: `${command.op}: ${path} value is not an object` };

  if (hasEntryName) {
    const entryName = normalizeEntryName(readPath(command.args[1]));
    const fullPath = `${path}.${entryName}`;
    const pathError = validatePath(fullPath);
    if (pathError) return { error: `${command.op}: ${pathError}` };
    writePathValue(variables, fullPath, value);
    return { event: { op: command.op, path: fullPath, value } };
  }

  const current = readPathValue(variables, path);
  const merged = isRecord(current) ? { ...current, ...value } : value;
  writePathValue(variables, path, merged);
  return { event: { op: command.op, path, value: merged } };
}

function extractCommands(input: string): ParsedCommand[] {
  const text = stripLineComments(input);
  const commands: ParsedCommand[] = [];
  let index = 0;

  while (index < text.length) {
    const match = text.slice(index).match(/_\.(set|add|remove|assign|insert)\(/);
    if (!match?.[1] || match.index === undefined) break;
    const start = index + match.index;
    const argsStart = start + match[0].length;
    const argsEnd = findClosingParen(text, argsStart);
    if (argsEnd === -1) break;
    commands.push({
      op: match[1] as StoryStateCommandName,
      args: splitArgs(text.slice(argsStart, argsEnd)),
    });
    index = argsEnd + 1;
  }

  return commands;
}

function findClosingParen(text: string, start: number): number {
  let depth = 1;
  let quote = "";
  for (let index = start; index < text.length; index += 1) {
    const char = text[index] ?? "";
    const prev = text[index - 1] ?? "";
    if (quote) {
      if (char === quote && prev !== "\\") quote = "";
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
    } else if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function splitArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote = "";
  let depth = 0;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index] ?? "";
    const prev = input[index - 1] ?? "";
    if (quote) {
      current += char;
      if (char === quote && prev !== "\\") quote = "";
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") quote = char;
    if ("([{".includes(char)) depth += 1;
    if (")]}".includes(char)) depth -= 1;
    if (char === "," && depth === 0) {
      args.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function parseValue(input: string | undefined): unknown {
  if (input === undefined) return undefined;
  const value = input.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "undefined") return undefined;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (isQuoted(value)) return unquote(value);
  if (/^[\[{]/.test(value)) return parseJsonLike(value);
  return value;
}

function parseJsonLike(value: string): unknown {
  const json = value
    .replace(/([{,]\s*)([\p{L}_$][\p{L}\p{N}_$-]*)(\s*:)/gu, "$1\"$2\"$3")
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, body: string) =>
      JSON.stringify(body.replace(/\\'/g, "'")),
    );
  return JSON.parse(json);
}

function extractVisibleStoryText(text: string): string {
  const gameText = extractLastTagBlock(text, "gametxt");
  if (gameText !== undefined) return cleanVisibleText(gameText);
  return cleanVisibleText(HIDDEN_TAGS.reduce(stripTag, text));
}

function stripTag(result: string, tag: string): string {
  return result.replace(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, "gi"), "");
}

function cleanVisibleText(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<safe>[\s\S]*?<\/safe>/gi, "")
    .trim();
}

function extractTagBlocks(text: string, tag: string): string[] {
  return Array.from(text.matchAll(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*<\\/${tag}>`, "gi")))
    .map((match) => match[1] ?? "");
}

function extractLastTagBlock(text: string, tag: string): string | undefined {
  return extractTagBlocks(text, tag).at(-1)?.trim();
}

function buildStateSourceTag(
  variables: Record<string, unknown>,
  events: StoryStateUpdateEvent[],
  errors: string[],
): string {
  const data = {
    updated: events,
    snapshot: compactSnapshot(variables, events),
    errors,
  };
  return `<${STORY_STATE_SOURCE_TAG}>${JSON.stringify(data)}</${STORY_STATE_SOURCE_TAG}>`;
}

function appendSourceTag(text: string, sourceTag: string): string {
  return [text.trim(), sourceTag].filter(Boolean).join("\n\n");
}

function compactSnapshot(
  variables: Record<string, unknown>,
  events: StoryStateUpdateEvent[],
): Record<string, unknown> {
  const topKeys = [...new Set(events.map((event) => event.path.split(".")[0]).filter(Boolean))];
  return Object.fromEntries(topKeys.map((key) => [key, limitValue(variables[key], 2)]));
}

function limitValue(value: unknown, depth: number): unknown {
  if (depth <= 0 || !isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 12)
      .map(([key, item]) => [key, limitValue(item, depth - 1)]),
  );
}

function readPath(input: string | undefined): string {
  const value = parseValue(input);
  return typeof value === "string" ? value.trim() : "";
}

function validatePath(path: string): string | undefined {
  if (!path || path.length > 200) return "invalid path";
  const parts = path.split(".");
  if (parts.some((part) => !part || DANGEROUS_PATH_PARTS.has(part))) return "unsafe path";
  return undefined;
}

function readPathValue(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) =>
    isRecord(current) ? current[key] : undefined, source);
}

function writePathValue(source: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  const last = parts.pop();
  if (!last) return;
  const target = parts.reduce<Record<string, unknown>>((current, key) => {
    if (!isRecord(current[key])) current[key] = {};
    return current[key] as Record<string, unknown>;
  }, source);
  target[last] = value;
}

function unsetPath(source: Record<string, unknown>, path: string): void {
  const parts = path.split(".");
  const last = parts.pop();
  const target = parts.reduce<unknown>((current, key) =>
    isRecord(current) ? current[key] : undefined, source);
  if (last && isRecord(target)) delete target[last];
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function normalizeEntryName(value: string): string {
  return /^\d+$/.test(value) ? `entry_${value}` : value;
}

function stripLineComments(value: string): string {
  return value.replace(/\/\/.*$/gm, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isQuoted(value: string): boolean {
  return (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith("`") && value.endsWith("`"))
  );
}

function unquote(value: string): string {
  return value.slice(1, -1).replace(/\\(["'`])/g, "$1");
}
