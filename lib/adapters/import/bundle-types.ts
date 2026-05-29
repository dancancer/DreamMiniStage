import type { RegexScript } from "@/lib/models/regex-script-model";
import type { NormalizedPreset } from "./preset-import";
import type { NormalizedWorldBookEntry } from "./worldbook-import";

export const IMPORTED_ASSET_BUNDLE_SCHEMA_VERSION = 1;

export type AssetSourceKind =
  | "png-character"
  | "json-character"
  | "preset"
  | "worldbook"
  | "regex"
  | "script"
  | "manual";

export type ImportDiagnosticSeverity = "info" | "warning" | "error";

export type ExtensionArtifactKind =
  | "prompt-convention"
  | "variable-convention"
  | "script"
  | "unknown";

export interface AssetSource {
  sourcePath: string;
  sourceKind: AssetSourceKind;
  detectedFormat: string;
  sourceHash: string;
}

export interface FieldProvenance {
  targetPath: string;
  sourcePath: string;
  sourceField: string;
}

export interface ImportDiagnostic {
  code: string;
  severity: ImportDiagnosticSeverity;
  message: string;
  targetPath?: string;
  sourceField?: string;
}

export interface UnsupportedArtifact {
  code: string;
  reason: string;
  sourceField: string;
}

export interface ImportedPromptFragment {
  id: string;
  role: "system" | "user" | "assistant" | "unknown";
  content: string;
  sourceField: string;
}

export interface ImportedCharacterProfile {
  id: string;
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;
  firstMessage?: string;
  alternateGreetings: string[];
  exampleMessages?: string;
  creator?: string;
  version?: string;
  source: AssetSource;
  promptFragments: ImportedPromptFragment[];
  diagnostics: ImportDiagnostic[];
}

export interface ImportedWorldBook {
  id: string;
  name: string;
  source: AssetSource;
  entries: ImportedWorldBookEntry[];
  diagnostics: ImportDiagnostic[];
}

export interface ImportedWorldBookEntry {
  id: string;
  sourceBookId: string;
  normalized: NormalizedWorldBookEntry;
  provenance: FieldProvenance[];
  unsupported: UnsupportedArtifact[];
}

export interface ImportedPreset {
  id: string;
  name: string;
  normalized: NormalizedPreset;
  source: AssetSource;
  diagnostics: ImportDiagnostic[];
}

export interface ImportedRegexScript {
  id: string;
  source: AssetSource;
  raw: RegexScript;
  provenance: FieldProvenance[];
  diagnostics: ImportDiagnostic[];
}

export interface ImportedExtensionArtifact {
  id: string;
  source: AssetSource;
  extensionKey: string;
  kind: ExtensionArtifactKind;
  payloadHash: string;
  summary: string;
  supported: false;
  diagnostics: ImportDiagnostic[];
}

export interface ImportedAssetBundle {
  schemaVersion: typeof IMPORTED_ASSET_BUNDLE_SCHEMA_VERSION;
  bundleId: string;
  sourceHash: string;
  createdAt: string;
  character: ImportedCharacterProfile;
  worldBooks: ImportedWorldBook[];
  preset?: ImportedPreset;
  regexScripts: ImportedRegexScript[];
  extensionArtifacts: ImportedExtensionArtifact[];
  diagnostics: ImportDiagnostic[];
}
