import type {
  ImportedAssetBundle,
  ImportedExtensionArtifact,
  ImportedWorldBook,
  ImportedWorldBookEntry,
  ImportDiagnostic,
} from "@/lib/adapters/import";
import { extractFirstJsonObject } from "@/lib/utils/extract-json";
import type { StoryInitialState } from "./types";

interface InitialStateSource {
  source: string;
  content?: string;
  data?: Record<string, unknown>;
}

const STATE_SNAPSHOT_TAGS = ["status_current_variables", "StoryState"] as const;

export function compileInitialState(bundle: ImportedAssetBundle): StoryInitialState {
  const state: StoryInitialState = {
    variables: {},
    sources: [],
    errors: [],
  };

  collectInitSources(bundle).forEach((source) => {
    const parsed = source.data
      ? { data: cloneJson(source.data) }
      : parseInitialVariables(source.content ?? "");
    if (!parsed.data) {
      state.errors.push(`${source.source}: ${parsed.error}`);
      return;
    }
    state.variables = deepMerge(state.variables, parsed.data);
    state.sources.push(source.source);
  });

  return state;
}

export function diagnoseInitialStateSources(bundle: ImportedAssetBundle): ImportDiagnostic[] {
  return [
    ...bundle.worldBooks.flatMap(diagnoseWorldBookStateSources),
    ...diagnoseTextStateSources({
      content: bundle.character.firstMessage ?? "",
      source: `${bundle.character.source.sourcePath}:data.first_mes`,
    }),
  ];
}

// Variable Convention 注册表（见 CONTEXT.md / ADR-0010）：按约定识别初始变量，而非逐卡定制。
// 新增一种约定 = 往这里加一条；识别一种约定即覆盖所有遵循它的角色卡。
// 顺序即 deepMerge 优先级，后者覆盖前者——调整顺序会改变同名变量的最终取值。
interface VariableConvention {
  name: string;
  describe: string;
  collect: (bundle: ImportedAssetBundle) => InitialStateSource[];
}

const VARIABLE_CONVENTIONS: VariableConvention[] = [
  {
    name: "worldbook-inline",
    describe: "世界书条目里的 [InitVar] 与 <status_current_variables>/<StoryState> JSON 快照",
    collect: (bundle) =>
      bundle.worldBooks.flatMap((book) =>
        book.entries.flatMap((entry) => [
          ...readInitVarSource(book, entry),
          ...readStateSnapshotSources(entry.normalized.content, entrySource(book, entry)),
        ]),
      ),
  },
  {
    name: "greeting-initvar",
    describe: "开场白（first_mes）中的 <initvar> 块",
    collect: (bundle) => readGreetingInitSource(bundle.character.firstMessage, "data.first_mes"),
  },
  {
    name: "greeting-snapshot",
    describe: "开场白中的 <status_current_variables>/<StoryState> JSON 快照",
    collect: (bundle) =>
      readStateSnapshotSources(bundle.character.firstMessage ?? "", "data.first_mes"),
  },
  {
    name: "extension-variable",
    describe: "受支持的 variable-convention 扩展产物（MVU initial、TavernHelper variables 等）",
    collect: (bundle) => bundle.extensionArtifacts.flatMap(readExtensionInitSource),
  },
];

function collectInitSources(bundle: ImportedAssetBundle): InitialStateSource[] {
  return VARIABLE_CONVENTIONS.flatMap((convention) => convention.collect(bundle));
}

function readInitVarSource(
  book: ImportedWorldBook,
  entry: ImportedWorldBookEntry,
): InitialStateSource[] {
  if (!isInitVarEntry(entry)) return [];
  return [{
    source: entrySource(book, entry),
    content: entry.normalized.content,
  }];
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

function readStateSnapshotSources(content: string, source: string): InitialStateSource[] {
  return STATE_SNAPSHOT_TAGS.flatMap((tag) => {
    const block = readTaggedJsonBlock(content, tag);
    return block ? [{ source: `${source}:${tag}`, content: block }] : [];
  });
}

function readExtensionInitSource(artifact: ImportedExtensionArtifact): InitialStateSource[] {
  if (artifact.kind !== "variable-convention" || !isRecord(artifact.payload)) return [];
  return [{
    source: `${artifact.source.sourcePath}:data.extensions.${artifact.extensionKey}`,
    data: artifact.payload,
  }];
}

function diagnoseWorldBookStateSources(book: ImportedWorldBook): ImportDiagnostic[] {
  return book.entries.flatMap((entry) =>
    diagnoseTextStateSources({
      content: entry.normalized.content,
      source: entrySource(book, entry),
    }),
  );
}

function diagnoseTextStateSources(input: {
  content: string;
  source: string;
}): ImportDiagnostic[] {
  const dynamicTags = STATE_SNAPSHOT_TAGS.filter((tag) =>
    hasTag(input.content, tag) && !readTaggedJsonBlock(input.content, tag),
  );
  const diagnostics = dynamicTags.map((tag) =>
    stateDiagnostic(
      "story.initial_state.dynamic_source_unsupported",
      `State source <${tag}> is dynamic or non-JSON and cannot seed initial story variables.`,
      input.source,
    ),
  );

  if (hasStateTemplate(input.content) && dynamicTags.length === 0) {
    diagnostics.push(stateDiagnostic(
      "story.initial_state.template_only",
      "State template was detected, but it does not contain static initial variable values.",
      input.source,
    ));
  }

  return diagnostics;
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

function readTaggedJsonBlock(content: string, tag: string): string | undefined {
  const pattern = new RegExp(`<${tag}>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/${tag}>`, "i");
  const block = content.match(pattern)?.[1];
  return block?.startsWith("{{") ? undefined : block;
}

function hasTag(content: string, tag: string): boolean {
  return new RegExp(`<${tag}[\\s>]|<\\/${tag}>`, "i").test(content);
}

function hasStateTemplate(content: string): boolean {
  return /<StatusDashboard>|<UnitCard>|<SaveFile>|GLOBAL SNAPSHOT PROTOCOL|Tactical Terminal/i
    .test(content);
}

function extractCodeBlock(content: string): string {
  const match = content.match(/```(?:json|yaml|json5)?\s*([\s\S]*?)\s*```/i);
  return match?.[1] ?? content;
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

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function entrySource(book: ImportedWorldBook, entry: ImportedWorldBookEntry): string {
  return `${book.source.sourcePath}:${entry.normalized.comment || entry.id}`;
}

function stateDiagnostic(
  code: string,
  message: string,
  sourceField: string,
): ImportDiagnostic {
  return {
    code,
    severity: "warning",
    message,
    targetPath: "initialState.variables",
    sourceField,
  };
}
