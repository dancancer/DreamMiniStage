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
import { importPreset } from "./preset-import";
import { importRegexScripts } from "./regex-import";
import { importWorldBookEntries } from "./worldbook-import";

interface AssetInput {
  id: string;
  name: string;
  raw: unknown;
  source: AssetSource;
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
  const externalRegex = (input.regexScripts ?? []).flatMap(createRegexScripts);

  return {
    schemaVersion: IMPORTED_ASSET_BUNDLE_SCHEMA_VERSION,
    bundleId: input.bundleId,
    sourceHash: input.sourceHash,
    createdAt: input.createdAt,
    character,
    worldBooks: compact([embeddedWorldBook, ...externalWorldBooks]),
    preset: input.preset ? createPreset(input.preset) : undefined,
    regexScripts: [...embeddedRegex, ...externalRegex],
    extensionArtifacts: createExtensionArtifacts(card.data, input.character.source),
    diagnostics: [],
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
    promptFragment("first_mes", "assistant", data.first_mes),
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
): ImportedRegexScript[] {
  const extensions = asOptionalRecord(data.extensions);
  if (!extensions || !("regex_scripts" in extensions)) return [];
  return createRegexScripts({
    id: "character-regex",
    name: `${readString(data.name)} regex scripts`,
    raw: extensions.regex_scripts,
    source,
  });
}

function createRegexScripts(input: AssetInput): ImportedRegexScript[] {
  return importRegexScripts(input.raw).map((script, index) => {
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
  });
}

function createExtensionArtifacts(
  data: Record<string, unknown>,
  source: AssetSource,
): ImportedExtensionArtifact[] {
  const extensions = asOptionalRecord(data.extensions);
  if (!extensions) return [];

  return Object.entries(extensions)
    .filter(([key]) => key !== "regex_scripts")
    .map(([key, payload]) => ({
      id: `extension.${key}`,
      source,
      extensionKey: key,
      kind: classifyExtension(key),
      payloadHash: hashPayload(payload),
      summary: `Unsupported imported extension: ${key}`,
      supported: false,
      diagnostics: [unsupportedExtensionDiagnostic(key)],
    }));
}

function classifyExtension(key: string): ExtensionArtifactKind {
  if (key === "depth_prompt") return "prompt-convention";
  if (key.includes("TavernHelper") || key === "tavern_helper") return "script";
  return "unknown";
}

function unsupportedExtensionDiagnostic(key: string): ImportDiagnostic {
  return {
    code: "extension.unsupported",
    severity: "warning",
    message: `Extension "${key}" is preserved as an unsupported artifact.`,
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
