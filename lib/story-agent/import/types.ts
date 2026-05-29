import type {
  AssetSource,
  ImportedAssetBundle,
  ImportDiagnostic,
} from "@/lib/adapters/import";
import type { SessionBlueprint } from "@/lib/story-agent/blueprint";
import type { Session } from "@/types/session";

export interface StoryAgentRawAsset {
  id: string;
  name: string;
  raw: unknown;
  source: AssetSource;
}

export interface StoryAgentImportInput {
  character: {
    raw: unknown;
    source: AssetSource;
  };
  avatar?: Blob;
  characterId?: string;
  blueprintId?: string;
  bundleId?: string;
  createdAt?: string;
  sessionName?: string;
  worldBooks?: StoryAgentRawAsset[];
  preset?: StoryAgentRawAsset;
  regexScripts?: StoryAgentRawAsset[];
}

export interface StoryAgentImportSummary {
  characterName: string;
  worldBookCount: number;
  worldBookEntryCount: number;
  regexScriptCount: number;
  renderRuleCount: number;
  promptMessageCount: number;
  diagnosticCount: number;
}

export interface StoryAgentConfirmation {
  required: boolean;
  reasons: string[];
}

export interface StoryAgentImportPreview {
  bundle: ImportedAssetBundle;
  blueprint: SessionBlueprint;
  summary: StoryAgentImportSummary;
  confirmation: StoryAgentConfirmation;
  diagnostics: ImportDiagnostic[];
}

export interface StoryAgentCommitInput {
  blueprint: SessionBlueprint;
  avatar?: Blob;
  sessionName?: string;
}

export interface StoryAgentImportResult {
  characterId: string;
  sessionId: string;
  blueprintId: string;
  blueprint: SessionBlueprint;
  session: Session;
  summary: StoryAgentImportSummary;
  confirmation: StoryAgentConfirmation;
  diagnostics: ImportDiagnostic[];
}
