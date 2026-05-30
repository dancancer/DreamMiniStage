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

export function stripRenderIntentSources(
  text: string,
  intents: RenderIntent[],
): string {
  return intents.reduce((result, intent) => {
    const sourcePattern = readSourcePattern(intent);
    if (!sourcePattern) return result;
    const regex = compileRegex(sourcePattern);
    return regex ? result.replace(regex, "").trim() : result;
  }, text);
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

function readSourcePattern(intent: RenderIntent): string | undefined {
  if (intent.kind === "status-panel" || intent.kind === "state-panel") {
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
