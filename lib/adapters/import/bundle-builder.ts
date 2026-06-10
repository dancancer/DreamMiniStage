import {
  IMPORTED_ASSET_BUNDLE_SCHEMA_VERSION,
  type AssetSource,
  type ExtensionArtifactKind,
  type ImportedAssetBundle,
  type ImportedCharacterProfile,
  type ImportedExtensionArtifact,
  type ImportedPreset,
  type ImportedRegexScript,
  type ImportedWorldBook,
  type ImportedWorldBookEntry,
  type ImportDiagnostic,
} from "./bundle-types";
import type { ImportDiagnosticCode } from "./bundle-diagnostics";
import { importPreset } from "./preset-import";
import { importRegexScripts } from "./regex-import";
import { importWorldBookEntries } from "./worldbook-import";

// MVU replay 序列字段：首轮只编译静态 initial，update/insert/expect 不执行（见 ADR-0010 / ADR-0007）。
const REPLAY_MUTATION_FIELDS = ["update", "insert", "expect"] as const;

interface AssetInput {
  id: string;
  name: string;
  raw: unknown;
  source: AssetSource;
}

interface ExtensionVariables {
  field: string;
  value: Record<string, unknown>;
}

export interface CreateImportedAssetBundleInput {
  bundleId: string;
  sourceHash: string;
  createdAt: string;
  characterId: string;
  character: {
    raw: unknown;
    source: AssetSource;
  };
  worldBooks?: AssetInput[];
  preset?: AssetInput;
  regexScripts?: AssetInput[];
}

export function createImportedAssetBundle(
  input: CreateImportedAssetBundleInput,
): ImportedAssetBundle {
  const card = readCard(input.character.raw);
  const character = createCharacter(input.characterId, card.data, input.character.source);
  const embeddedWorldBook = createEmbeddedWorldBook(card.data, input.character.source);
  const externalWorldBooks = (input.worldBooks ?? []).map(createWorldBook);
  const embeddedRegex = createEmbeddedRegexScripts(card.data, input.character.source);
  const externalRegex = (input.regexScripts ?? []).map(createRegexScripts);

  return {
    schemaVersion: IMPORTED_ASSET_BUNDLE_SCHEMA_VERSION,
    bundleId: input.bundleId,
    sourceHash: input.sourceHash,
    createdAt: input.createdAt,
    character,
    worldBooks: compact([embeddedWorldBook, ...externalWorldBooks]),
    preset: input.preset ? createPreset(input.preset) : undefined,
    regexScripts: [
      ...embeddedRegex.scripts,
      ...externalRegex.flatMap((result) => result.scripts),
    ],
    extensionArtifacts: createExtensionArtifacts(card.data, input.character.source),
    diagnostics: [
      ...embeddedRegex.diagnostics,
      ...externalRegex.flatMap((result) => result.diagnostics),
    ],
  };
}

function readCard(raw: unknown): { data: Record<string, unknown> } {
  const card = asRecord(raw, "character card");
  const data = asRecord(card.data ?? card, "character card data");
  if (typeof data.name !== "string" || data.name.trim().length === 0) {
    throw new Error("Character card is missing data.name");
  }
  return { data };
}

function createCharacter(
  id: string,
  data: Record<string, unknown>,
  source: AssetSource,
): ImportedCharacterProfile {
  return {
    id,
    name: readString(data.name),
    description: readOptionalString(data.description),
    personality: readOptionalString(data.personality),
    scenario: readOptionalString(data.scenario),
    firstMessage: readOptionalString(data.first_mes),
    alternateGreetings: readStringArray(data.alternate_greetings),
    exampleMessages: readOptionalString(data.mes_example),
    creator: readOptionalString(data.creator),
    version: readOptionalString(data.character_version ?? data.version),
    source,
    promptFragments: createPromptFragments(data),
    diagnostics: [],
  };
}

function createPromptFragments(data: Record<string, unknown>) {
  return [
    promptFragment("description", "system", data.description),
    promptFragment("personality", "system", data.personality),
    promptFragment("scenario", "system", data.scenario),
    promptFragment("mes_example", "unknown", data.mes_example),
  ].filter((fragment) => fragment.content.length > 0);
}

function promptFragment(sourceField: string, role: "system" | "assistant" | "unknown", value: unknown) {
  return {
    id: `character.${sourceField}`,
    role,
    content: typeof value === "string" ? value : "",
    sourceField: `data.${sourceField}`,
  };
}

function createEmbeddedWorldBook(
  data: Record<string, unknown>,
  source: AssetSource,
): ImportedWorldBook | undefined {
  const book = asOptionalRecord(data.character_book);
  if (!book || !("entries" in book)) return undefined;
  const raw = Array.isArray(book.entries) ? book.entries : { entries: book.entries };
  return createWorldBook({
    id: "character-book",
    name: `${readString(data.name)} character book`,
    raw,
    source,
  });
}

function createWorldBook(input: AssetInput): ImportedWorldBook {
  const entries = importWorldBookEntries(input.raw);
  return {
    id: input.id,
    name: input.name,
    source: input.source,
    entries: entries.map((normalized, index): ImportedWorldBookEntry => ({
      id: `${input.id}.entry.${index}`,
      sourceBookId: input.id,
      normalized,
      provenance: [{
        targetPath: `worldBooks.${input.id}.entries.${index}.normalized`,
        sourcePath: input.source.sourcePath,
        sourceField: `entries.${index}`,
      }],
      unsupported: [],
    })),
    diagnostics: [],
  };
}

function createPreset(input: AssetInput): ImportedPreset {
  const normalized = importPreset(input.raw);
  return {
    id: input.id,
    name: normalized.name || input.name,
    normalized,
    source: input.source,
    diagnostics: [],
  };
}

function createEmbeddedRegexScripts(
  data: Record<string, unknown>,
  source: AssetSource,
): { scripts: ImportedRegexScript[]; diagnostics: ImportDiagnostic[] } {
  const extensions = asOptionalRecord(data.extensions);
  if (!extensions || !("regex_scripts" in extensions)) {
    return { scripts: [], diagnostics: [] };
  }

  const raw = extensions.regex_scripts;
  if (!hasImportableRegexScript(raw)) {
    return {
      scripts: [],
      diagnostics: [embeddedRegexSkippedDiagnostic()],
    };
  }

  return createRegexScripts({
    id: "character-regex",
    name: `${readString(data.name)} regex scripts`,
    raw,
    source,
  });
}

function createRegexScripts(input: AssetInput): {
  scripts: ImportedRegexScript[];
  diagnostics: ImportDiagnostic[];
} {
  return {
    scripts: importRegexScripts(input.raw).map((script, index) => {
      const scriptKey = script.scriptKey || script.id || `${input.id}.regex.${index}`;
      const raw = { ...script, scriptKey };
      return {
        id: raw.id ?? scriptKey,
        source: input.source,
        raw,
        provenance: [{
          targetPath: `regexScripts.${input.id}.${index}.raw`,
          sourcePath: input.source.sourcePath,
          sourceField: `scripts.${index}`,
        }],
        diagnostics: [],
      };
    }),
    diagnostics: [],
  };
}

function hasImportableRegexScript(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasRegexPattern);
  if (!value || typeof value !== "object") return false;
  if (hasRegexPattern(value)) return true;
  return Object.values(value).some((item) =>
    Array.isArray(item)
      ? item.some(hasRegexPattern)
      : hasRegexPattern(item),
  );
}

function hasRegexPattern(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    "findRegex" in value &&
    typeof (value as { findRegex?: unknown }).findRegex === "string",
  );
}

function embeddedRegexSkippedDiagnostic(): ImportDiagnostic {
  return {
    code: "regex.embedded_empty_or_unsupported",
    severity: "info",
    message: "Embedded regex_scripts contains no importable regex scripts.",
    targetPath: "regexScripts.character-regex",
    sourceField: "data.extensions.regex_scripts",
  };
}

function createExtensionArtifacts(
  data: Record<string, unknown>,
  source: AssetSource,
): ImportedExtensionArtifact[] {
  const extensions = asOptionalRecord(data.extensions);
  if (!extensions) return [];

  return Object.entries(extensions)
    .filter(([key]) => key !== "regex_scripts")
    .flatMap(([key, payload]) => createExtensionArtifact(key, payload, source));
}

function createExtensionArtifact(
  key: string,
  payload: unknown,
  source: AssetSource,
): ImportedExtensionArtifact[] {
  const kind = classifyExtension(key);
  const variables = readExtensionVariables(payload);
  const needsUnsupportedArtifact = shouldPreserveUnsupportedExtension(kind, payload, variables);
  const unsupportedCode: ImportDiagnosticCode =
    kind === "variable-convention" && hasReplayMutationFields(payload)
      ? "extension.mvu_replay_mutation_unsupported"
      : "extension.unsupported";
  const unsupportedArtifact: ImportedExtensionArtifact = {
    id: `extension.${key}`,
    source,
    extensionKey: key,
    kind,
    payloadHash: hashPayload(payload),
    summary: `Unsupported imported extension: ${key}`,
    supported: false,
    diagnostics: [unsupportedExtensionDiagnostic(key, unsupportedCode)],
  };

  if (variables) {
    const variableArtifact: ImportedExtensionArtifact = {
      id: `extension.${key}.${variables.field}`,
      source,
      extensionKey: `${key}.${variables.field}`,
      kind: "variable-convention",
      payloadHash: hashPayload(variables.value),
      summary: `Imported variable convention from extension: ${key}`,
      supported: true,
      payload: variables.value,
      diagnostics: [],
    };
    return kind === "variable-convention" && !needsUnsupportedArtifact
      ? [variableArtifact]
      : [unsupportedArtifact, variableArtifact];
  }

  return [unsupportedArtifact];
}

function classifyExtension(key: string): ExtensionArtifactKind {
  if (key === "depth_prompt") return "prompt-convention";
  if (/mvu|variable/i.test(key)) return "variable-convention";
  if (key.includes("TavernHelper") || key === "tavern_helper") return "script";
  return "unknown";
}

function readExtensionVariables(payload: unknown): ExtensionVariables | undefined {
  const direct = asOptionalRecord(payload);
  if (direct) {
    const initial = readVariableRecord(direct.initial);
    if (initial) return { field: "initial", value: initial };
    const variables = readVariableRecord(direct.variables);
    if (variables) return { field: "variables", value: variables };
  }

  const pairs = readEntryPairs(payload);
  const variables = pairs ? readVariableRecord(pairs.variables) : undefined;
  return variables ? { field: "variables", value: variables } : undefined;
}

function readVariableRecord(value: unknown): Record<string, unknown> | undefined {
  const record = asOptionalRecord(value);
  return record && Object.keys(record).length > 0 ? record : undefined;
}

function readEntryPairs(value: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value
    .filter((item): item is [string, unknown] =>
      Array.isArray(item) && typeof item[0] === "string" && item.length >= 2,
    )
    .map(([key, entryValue]) => [key, entryValue] as const);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function shouldPreserveUnsupportedExtension(
  kind: ExtensionArtifactKind,
  payload: unknown,
  variables: ExtensionVariables | undefined,
): boolean {
  if (kind !== "variable-convention" || !variables) return true;
  const record = asOptionalRecord(payload);
  if (!record) return false;
  const supportedFields = new Set([variables.field, "name", "description", "scope"]);
  return Object.keys(record).some((key) => !supportedFields.has(key));
}

function hasReplayMutationFields(payload: unknown): boolean {
  // 归一化 object 与 pair-list 两种形态（与 readExtensionVariables 对齐），避免 pair-list
  // 形态的 MVU replay 漏检后退回通用 extension.unsupported。
  const record = asOptionalRecord(payload) ?? readEntryPairs(payload);
  if (!record) return false;
  return REPLAY_MUTATION_FIELDS.some((field) => field in record);
}

function unsupportedExtensionDiagnostic(
  key: string,
  code: ImportDiagnosticCode = "extension.unsupported",
): ImportDiagnostic {
  const message = code === "extension.mvu_replay_mutation_unsupported"
    ? `Extension "${key}" declares MVU replay mutation (update/insert/expect); only static initial variables are compiled.`
    : `Extension "${key}" is preserved as an unsupported artifact.`;
  return {
    code,
    severity: "warning",
    message,
    sourceField: `data.extensions.${key}`,
  };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value as Record<string, unknown>;
}

function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function compact<T>(values: Array<T | undefined>): T[] {
  return values.filter((value): value is T => value !== undefined);
}

function hashPayload(value: unknown): string {
  const text = JSON.stringify(value) ?? "";
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
