import {
  diagnoseImportedAssetBundle,
  type FieldProvenance,
  type ImportedAssetBundle,
  type ImportedRegexScript,
  type ImportedWorldBook,
  type ImportedWorldBookEntry,
} from "@/lib/adapters/import";
import { RegexPlacement } from "@/lib/models/regex-script-model";
import {
  SESSION_BLUEPRINT_SCHEMA_VERSION,
  type AgentProfile,
  type ContentRule,
  type DeferredContract,
  type PromptRole,
  type PromptStack,
  type PromptStackMessage,
  type RepairReport,
  type SessionBlueprint,
  type TextTransform,
  type TransformDirection,
  type WorldActivation,
  type WorldModule,
  type WorldModuleEntry,
} from "./types";

export interface CompileSessionBlueprintOptions {
  id?: string;
  createdAt?: string;
}

export function compileSessionBlueprint(
  bundle: ImportedAssetBundle,
  options: CompileSessionBlueprintOptions = {},
): SessionBlueprint {
  const core = {
    schemaVersion: SESSION_BLUEPRINT_SCHEMA_VERSION as typeof SESSION_BLUEPRINT_SCHEMA_VERSION,
    profile: compileProfile(bundle),
    promptStack: compilePromptStack(bundle),
    worldModules: bundle.worldBooks.map(compileWorldModule),
    inputTransforms: compileTransforms(bundle.regexScripts, "input"),
    outputTransforms: compileTransforms(bundle.regexScripts, "output"),
    promptTransforms: compileTransforms(bundle.regexScripts, "prompt"),
    contentRules: compileContentRules(bundle.regexScripts),
    diagnostics: diagnoseImportedAssetBundle(bundle),
    repairReport: emptyRepairReport(),
    provenance: collectProvenance(bundle),
  };
  const sourceHash = stableHash(core);

  return {
    id: options.id ?? `blueprint:${sourceHash.slice(0, 12)}`,
    sourceHash,
    createdAt: options.createdAt ?? bundle.createdAt,
    renderRules: deferred("SAC-Phase 5", "RenderIntent schema is defined in SAC-Phase 5."),
    memoryPolicy: deferred("SAC-Phase 6b", "Long-term memory policy is defined in SAC-Phase 6b."),
    ...core,
  };
}

function compileProfile(bundle: ImportedAssetBundle): AgentProfile {
  const character = bundle.character;
  return {
    id: character.id,
    name: character.name,
    description: character.description,
    personality: character.personality,
    scenario: character.scenario,
    firstMessage: character.firstMessage,
    exampleMessages: character.exampleMessages,
    promptFragments: character.promptFragments.map((fragment) => ({
      id: fragment.id,
      role: fragment.role,
      content: fragment.content,
      sourceField: fragment.sourceField,
    })),
  };
}

function compilePromptStack(bundle: ImportedAssetBundle): PromptStack {
  const characterMessages = bundle.character.promptFragments.map((fragment, index) => ({
    id: `character:${fragment.id}`,
    role: fragment.role,
    content: fragment.content,
    enabled: fragment.content.trim().length > 0,
    order: index,
    sourceKind: "character" as const,
    sourcePath: bundle.character.source.sourcePath,
    sourceField: fragment.sourceField,
  }));

  const presetMessages = [...(bundle.preset?.normalized.prompts ?? [])]
    .sort(comparePresetPrompts)
    .map((prompt, index): PromptStackMessage => ({
      id: `preset:${prompt.identifier}`,
      role: normalizeRole(prompt.role),
      content: prompt.content ?? "",
      enabled: prompt.enabled !== false,
      order: characterMessages.length + index,
      sourceKind: "preset",
      sourcePath: bundle.preset?.source.sourcePath ?? "",
      sourceField: `prompts.${index}`,
    }));

  return { messages: [...characterMessages, ...presetMessages] };
}

function compileWorldModule(book: ImportedWorldBook): WorldModule {
  return {
    id: book.id,
    name: book.name,
    sourcePath: book.source.sourcePath,
    entries: book.entries.map(compileWorldEntry),
  };
}

function compileWorldEntry(entry: ImportedWorldBookEntry): WorldModuleEntry {
  const item = entry.normalized;
  return {
    id: entry.id,
    enabled: item.enabled,
    content: item.content,
    primaryKeys: item.keys,
    secondaryKeys: item.secondary_keys,
    secondaryKeyLogic: item.selectiveLogic ?? "AND_ANY",
    constant: Boolean(item.constant),
    selective: Boolean(item.selective),
    useRegex: Boolean(item.use_regex),
    position: item.position,
    depth: item.depth ?? 1,
    caseSensitive: item.caseSensitive ?? false,
    matchWholeWords: item.matchWholeWords ?? false,
    scanDepth: item.scanDepth,
    insertionOrder: item.insertion_order ?? 0,
    probability: item.probability,
    group: item.group,
    activation: compileActivation(item),
    sourceField: entry.provenance[0]?.sourceField ?? "entries",
  };
}

function compileTransforms(
  scripts: ImportedRegexScript[],
  direction: TransformDirection,
): TextTransform[] {
  return scripts
    .filter((script) => transformDirections(script).includes(direction))
    .map((script) => ({
      id: script.id,
      name: script.raw.scriptName || script.id,
      direction,
      enabled: script.raw.disabled !== true,
      pattern: script.raw.findRegex,
      replacement: script.raw.replaceString ?? "",
      sourcePath: script.source.sourcePath,
    }));
}

function compileContentRules(scripts: ImportedRegexScript[]): ContentRule[] {
  return scripts.flatMap((script) => {
    const rules: ContentRule[] = [];
    if (script.raw.markdownOnly) {
      rules.push(contentRule(script, "markdown-only", "Apply only after markdown rendering."));
    }
    if (containsHtmlDocument(script.raw.replaceString)) {
      rules.push(contentRule(script, "html-ui-unsupported", "HTML UI output is deferred to RenderIntent."));
    }
    return rules;
  });
}

function transformDirections(script: ImportedRegexScript): TransformDirection[] {
  const directions = new Set<TransformDirection>();
  if (script.raw.promptOnly || script.raw.placement.includes(RegexPlacement.WORLD_INFO)) {
    directions.add("prompt");
  }
  if (script.raw.placement.includes(RegexPlacement.USER_INPUT)) directions.add("input");
  if (script.raw.placement.includes(RegexPlacement.AI_OUTPUT)) directions.add("output");
  return [...directions].sort();
}

function compileActivation(value: {
  sticky?: number;
  cooldown?: number;
  delay?: number;
}): WorldActivation {
  return {
    sticky: value.sticky ?? 0,
    cooldown: value.cooldown ?? 0,
    delay: value.delay ?? 0,
  };
}

function collectProvenance(bundle: ImportedAssetBundle): FieldProvenance[] {
  return [
    ...bundle.character.promptFragments.map((fragment) => ({
      targetPath: `profile.promptFragments.${fragment.id}`,
      sourcePath: bundle.character.source.sourcePath,
      sourceField: fragment.sourceField,
    })),
    ...bundle.worldBooks.flatMap((book) => book.entries.flatMap((entry) => entry.provenance)),
    ...bundle.regexScripts.flatMap((script) => script.provenance),
  ].sort((left, right) => left.targetPath.localeCompare(right.targetPath));
}

function comparePresetPrompts(
  left: { group_id: string | number; position: number; identifier: string },
  right: { group_id: string | number; position: number; identifier: string },
): number {
  return String(left.group_id).localeCompare(String(right.group_id)) ||
    left.position - right.position ||
    left.identifier.localeCompare(right.identifier);
}

function normalizeRole(role: string | undefined): PromptRole {
  if (role === "system" || role === "user" || role === "assistant") return role;
  return "unknown";
}

function contentRule(
  script: ImportedRegexScript,
  kind: ContentRule["kind"],
  summary: string,
): ContentRule {
  return {
    id: `${script.id}:${kind}`,
    kind,
    enabled: script.raw.disabled !== true,
    summary,
    sourcePath: script.source.sourcePath,
  };
}

function containsHtmlDocument(value: string | null | undefined): boolean {
  if (!value) return false;
  return /<!doctype html|<html[\s>]|<style[\s>]|<script[\s>]/i.test(value);
}

function emptyRepairReport(): RepairReport {
  return {
    appliedPatches: [],
    manualPatches: [],
    rejectedPatches: [],
  };
}

function deferred(phase: DeferredContract["phase"], reason: string): DeferredContract {
  return { status: "deferred", phase, reason };
}

function stableHash(value: unknown): string {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}
