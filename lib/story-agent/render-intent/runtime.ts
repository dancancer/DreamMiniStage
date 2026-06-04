import type { RenderIntent } from "./types";

export interface RenderIntentMatch {
  intent: RenderIntent;
  values: Record<string, string>;
  sourceText: string;
}

export function extractRenderIntentMatches(
  text: string,
  intents: RenderIntent[],
): RenderIntentMatch[] {
  return intents.flatMap((intent) => matchIntent(text, intent));
}

export function cleanRenderIntentMatchValues(
  match: RenderIntentMatch,
  matches: RenderIntentMatch[],
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(match.values).map(([key, value]) => [
      key,
      stripNestedSourceText(value, match, matches).trim(),
    ]),
  );
}

export function stripRenderIntentSources(
  text: string,
  intents: RenderIntent[],
): string {
  const withoutMatchedSources = intents.reduce((result, intent) => {
    const sourcePattern = readSourcePattern(intent);
    if (!sourcePattern) return result;
    const regex = compileRegex(sourcePattern);
    return regex ? result.replace(regex, "").trim() : result;
  }, text);

  return stripUnsafeJsonSources(withoutMatchedSources);
}

function matchIntent(text: string, intent: RenderIntent): RenderIntentMatch[] {
  const sourcePattern = readSourcePattern(intent);
  if (!sourcePattern) return [];
  const regex = compileRegex(sourcePattern);
  if (!regex) return [];

  return Array.from(text.matchAll(regex)).map((match) => ({
    intent,
    values: captureValues(match),
    sourceText: match[0],
  }));
}

function captureValues(match: RegExpMatchArray): Record<string, string> {
  return Object.fromEntries(
    match.slice(1).map((value, index) => [String(index + 1), value ?? ""]),
  );
}

function stripNestedSourceText(
  value: string,
  parent: RenderIntentMatch,
  matches: RenderIntentMatch[],
): string {
  return matches.reduce(
    (result, match) => match === parent ? result : result.split(match.sourceText).join(""),
    value,
  );
}

function readSourcePattern(intent: RenderIntent): string | undefined {
  if (
    intent.kind === "collapsible-panel" ||
    intent.kind === "status-panel" ||
    intent.kind === "state-panel" ||
    intent.kind === "choice-list"
  ) {
    return intent.sourcePattern;
  }
  return undefined;
}

function compileRegex(pattern: string): RegExp | undefined {
  const slash = pattern.match(/^\/([\s\S]*)\/([a-z]*)$/i);
  try {
    if (slash) return new RegExp(slash[1] ?? "", ensureGlobalFlag(slash[2] ?? ""));
    return new RegExp(pattern, "g");
  } catch {
    return undefined;
  }
}

function ensureGlobalFlag(flags: string): string {
  return flags.includes("g") ? flags : `${flags}g`;
}

function stripUnsafeJsonSources(text: string): string {
  return stripLooseStatusJson(stripStatusLikeJsonTags(text)).trim();
}

function stripStatusLikeJsonTags(text: string): string {
  return text.replace(
    /<((?:[a-z][a-z0-9_-]*(?:status|state|dashboard|variables?)[a-z0-9_-]*)|status|state|dashboard|variables?|SFW|NSFW)>\s*([\[{][\s\S]*?[\]}])\s*<\/\1>/gi,
    (match, _tag: string, payload: string) =>
      parseJson(payload) === undefined ? match : "",
  );
}

function stripLooseStatusJson(text: string): string {
  const ranges = jsonRanges(text).filter(({ value }) => isStatusPayload(value));
  return ranges.reduceRight(
    (result, range) => `${result.slice(0, range.start)}${result.slice(range.end)}`,
    text,
  );
}

function jsonRanges(text: string): Array<{ start: number; end: number; value: unknown }> {
  const ranges: Array<{ start: number; end: number; value: unknown }> = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "{") continue;
    const end = findJsonObjectEnd(text, index);
    if (end < 0) continue;
    const value = parseJson(text.slice(index, end));
    if (value !== undefined) ranges.push({ start: index, end, value });
    index = end - 1;
  }
  return ranges;
}

function findJsonObjectEnd(text: string, start: number): number {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
    } else if (char === "\\") {
      escaped = quoted;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (!quoted && char === "{") {
      depth += 1;
    } else if (!quoted && char === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return -1;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isStatusPayload(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.characters) ||
    (typeof record.mode === "string" && hasStatusMeta(record));
}

function hasStatusMeta(record: Record<string, unknown>): boolean {
  return ["date", "time", "location", "characters"]
    .some((key) => key in record);
}
