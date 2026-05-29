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
    if (intent.kind !== "status-panel" || !intent.sourcePattern) return result;
    const regex = compileRegex(intent.sourcePattern);
    return regex ? result.replace(regex, "").trim() : result;
  }, text);
}

function matchIntent(text: string, intent: RenderIntent): RenderIntentMatch[] {
  if (intent.kind !== "status-panel" || !intent.sourcePattern) return [];
  const regex = compileRegex(intent.sourcePattern);
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
