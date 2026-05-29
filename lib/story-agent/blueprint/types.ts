import type {
  FieldProvenance,
  ImportDiagnostic,
} from "@/lib/adapters/import";
import type { SecondaryKeyLogic } from "@/lib/models/world-book-model";
import type { RenderIntent } from "@/lib/story-agent/render-intent";

export const SESSION_BLUEPRINT_SCHEMA_VERSION = 2;

export type DeferredPhase = "SAC-Phase 5" | "SAC-Phase 6b";
export type PromptRole = "system" | "user" | "assistant" | "unknown";
export type PromptSourceKind = "character" | "preset";
export type TransformDirection = "input" | "output" | "prompt";
export type ContentRuleKind = "markdown-only" | "html-ui-unsupported";

export interface DeferredContract {
  status: "deferred";
  phase: DeferredPhase;
  reason: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;
  firstMessage?: string;
  exampleMessages?: string;
  promptFragments: AgentPromptFragment[];
}

export interface AgentPromptFragment {
  id: string;
  role: PromptRole;
  content: string;
  sourceField: string;
}

export interface PromptStack {
  messages: PromptStackMessage[];
}

export interface PromptStackMessage {
  id: string;
  role: PromptRole;
  content: string;
  enabled: boolean;
  order: number;
  sourceKind: PromptSourceKind;
  sourcePath: string;
  sourceField: string;
}

export interface WorldModule {
  id: string;
  name: string;
  sourcePath: string;
  entries: WorldModuleEntry[];
}

export interface WorldModuleEntry {
  id: string;
  enabled: boolean;
  content: string;
  primaryKeys: string[];
  secondaryKeys: string[];
  secondaryKeyLogic: SecondaryKeyLogic;
  constant: boolean;
  selective: boolean;
  useRegex: boolean;
  position: string | number;
  depth: number;
  caseSensitive: boolean;
  matchWholeWords: boolean;
  scanDepth?: number;
  insertionOrder: number;
  probability?: number;
  group?: string;
  activation: WorldActivation;
  recursion: WorldRecursionPolicy;
  sourceField: string;
}

export interface WorldActivation {
  sticky: number;
  cooldown: number;
  delay: number;
}

export interface WorldRecursionPolicy {
  preventRecursion: boolean;
  excludeRecursion: boolean;
}

export interface TextTransform {
  id: string;
  name: string;
  direction: TransformDirection;
  enabled: boolean;
  pattern: string;
  replacement: string;
  sourcePath: string;
}

export interface ContentRule {
  id: string;
  kind: ContentRuleKind;
  enabled: boolean;
  summary: string;
  sourcePath: string;
}

export interface RepairReport {
  appliedPatches: string[];
  manualPatches: string[];
  rejectedPatches: string[];
}

export interface SessionBlueprint {
  id: string;
  schemaVersion: typeof SESSION_BLUEPRINT_SCHEMA_VERSION;
  sourceHash: string;
  createdAt: string;
  profile: AgentProfile;
  promptStack: PromptStack;
  worldModules: WorldModule[];
  inputTransforms: TextTransform[];
  outputTransforms: TextTransform[];
  promptTransforms: TextTransform[];
  contentRules: ContentRule[];
  renderRules: RenderIntent[];
  memoryPolicy: DeferredContract;
  diagnostics: ImportDiagnostic[];
  repairReport: RepairReport;
  provenance: FieldProvenance[];
}

export interface CompiledPromptMessage {
  id: string;
  role: PromptRole;
  content: string;
  sourcePath: string;
}
