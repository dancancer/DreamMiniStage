import type {
  ImportedAssetBundle,
  ImportedWorldBookEntry,
} from "@/lib/adapters/import";
import type { StoryInitialState } from "./types";

export function compileInitialState(bundle: ImportedAssetBundle): StoryInitialState {
  const state: StoryInitialState = {
    variables: {},
    sources: [],
    errors: [],
  };

  collectInitSources(bundle).forEach((source) => {
    const parsed = parseInitialVariables(source.content);
    if (!parsed.data) {
      state.errors.push(`${source.source}: ${parsed.error}`);
      return;
    }
    state.variables = deepMerge(state.variables, parsed.data);
    state.sources.push(source.source);
  });

  return state;
}

function collectInitSources(bundle: ImportedAssetBundle): Array<{
  source: string;
  content: string;
}> {
  return [
    ...bundle.worldBooks.flatMap((book) =>
      book.entries.filter(isInitVarEntry).map((entry) => ({
        source: `${book.source.sourcePath}:${entry.normalized.comment || entry.id}`,
        content: entry.normalized.content,
      })),
    ),
    ...readGreetingInitSource(bundle.character.firstMessage, "data.first_mes"),
  ];
}

function isInitVarEntry(entry: ImportedWorldBookEntry): boolean {
  const marker = "[InitVar]";
  const comment = entry.normalized.comment ?? "";
  return (
    comment.includes(marker) ||
    entry.normalized.keys.some((key) => key.includes(marker))
  );
}

function readGreetingInitSource(content: string | undefined, source: string) {
  if (!content || !/<initvar>/i.test(content)) return [];
  return [{ source, content }];
}

function parseInitialVariables(content: string): {
  data?: Record<string, unknown>;
  error?: string;
} {
  const json = extractFirstJsonObject(extractCodeBlock(extractInitVarBlock(content)));
  if (!json) return { error: "no JSON object found" };

  try {
    const value = JSON.parse(json);
    if (isRecord(value)) return { data: value };
    return { error: "JSON root is not an object" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "invalid JSON" };
  }
}

function extractInitVarBlock(content: string): string {
  const match = content.match(/<initvar>\s*([\s\S]*?)\s*<\/initvar>/i);
  return match?.[1] ?? content;
}

function extractCodeBlock(content: string): string {
  const match = content.match(/```(?:json|yaml|json5)?\s*([\s\S]*?)\s*```/i);
  return match?.[1] ?? content;
}

function extractFirstJsonObject(content: string): string | undefined {
  const start = content.indexOf("{");
  if (start < 0) return undefined;

  let depth = 0;
  let quote = "";
  for (let index = start; index < content.length; index += 1) {
    const char = content[index] ?? "";
    const prev = content[index - 1] ?? "";
    if (quote) {
      if (char === quote && prev !== "\\") quote = "";
      continue;
    }
    if (char === "\"" || char === "'") quote = char;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return content.slice(start, index + 1);
  }

  return undefined;
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries([
    ...Object.entries(target),
    ...Object.entries(source).map(([key, value]) => [
      key,
      isRecord(value) && isRecord(target[key])
        ? deepMerge(target[key] as Record<string, unknown>, value)
        : value,
    ]),
  ]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
