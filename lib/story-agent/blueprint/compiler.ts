import {
  diagnoseImportedAssetBundle,
  type FieldProvenance,
  type ImportedAssetBundle,
  type ImportedRegexScript,
  type ImportedWorldBook,
  type ImportedWorldBookEntry,
} from "@/lib/adapters/import";
import { normalizeModelAdvancedSettings, type ModelAdvancedSettings } from "@/lib/model-runtime";
import { RegexPlacement } from "@/lib/models/regex-script-model";
import { defaultMemoryPolicy } from "@/lib/story-agent/memory";
import {
  convertRegexScriptsToRenderIntents,
  convertRegexToRenderIntent,
  RENDER_INTENT_SCHEMA_VERSION,
  type RenderIntent,
} from "@/lib/story-agent/render-intent";
import { containsHtml } from "@/lib/story-agent/render-intent/classifier";
import { storyActionsSourcePattern } from "@/lib/story-agent/runtime/action/options";
import { storyStateSourcePattern } from "@/lib/story-agent/runtime/state/update";
import {
  SESSION_BLUEPRINT_SCHEMA_VERSION,
  type AgentProfile,
  type ContentRule,
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
    modelPolicy: compileModelPolicy(bundle),
    worldModules: bundle.worldBooks.map(compileWorldModule),
    inputTransforms: compileTransforms(bundle.regexScripts, "input"),
    outputTransforms: compileTransforms(bundle.regexScripts, "output"),
    promptTransforms: compileTransforms(bundle.regexScripts, "prompt"),
    contentRules: compileContentRules(bundle.regexScripts),
    renderRules: compileRenderRules(bundle.regexScripts),
    memoryPolicy: defaultMemoryPolicy(),
    diagnostics: diagnoseImportedAssetBundle(bundle),
    repairReport: emptyRepairReport(),
    provenance: collectProvenance(bundle),
  };
  const sourceHash = stableHash(core);

  return {
    id: options.id ?? `blueprint:${sourceHash.slice(0, 12)}`,
    sourceHash,
    createdAt: options.createdAt ?? bundle.createdAt,
    ...core,
  };
}

function compileModelPolicy(bundle: ImportedAssetBundle): ModelAdvancedSettings {
  return normalizeModelAdvancedSettings(bundle.preset?.normalized.sampling);
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
    openings: compileOpenings(character),
    exampleMessages: character.exampleMessages,
    promptFragments: character.promptFragments.map((fragment) => ({
      id: fragment.id,
      role: fragment.role,
      content: fragment.content,
      sourceField: fragment.sourceField,
    })),
  };
}

function compileOpenings(character: ImportedAssetBundle["character"]) {
  const first = character.firstMessage ? [{
    id: "opening:first_mes",
    content: character.firstMessage,
    sourceField: "data.first_mes",
  }] : [];
  const alternates = character.alternateGreetings.map((content, index) => ({
    id: `opening:alternate:${index}`,
    content,
    sourceField: `data.alternate_greetings.${index}`,
  }));
  return [...first, ...alternates];
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
    recursion: {
      preventRecursion: Boolean(item.preventRecursion),
      excludeRecursion: Boolean(item.extensions?.excludeRecursion),
    },
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
    const conversion = convertRegexToRenderIntent(script.raw);
    if (conversion.fallback && isHtmlUiConversion(conversion)) {
      rules.push(contentRule(script, "html-ui-unsupported", conversion.fallback.reason));
    }
    return rules;
  });
}

function compileRenderRules(scripts: ImportedRegexScript[]): RenderIntent[] {
  const renderIntents = convertRegexScriptsToRenderIntents(scripts
    .filter((script) => script.raw.disabled !== true && script.raw.promptOnly !== true)
    .map((script) => script.raw))
    .flatMap((conversion) => conversion.intent ? [conversion.intent] : []);
  return [
    ...renderIntents,
    ...compileStatePanelRules(scripts),
    ...compileActionChoiceRules(scripts),
  ];
}

function transformDirections(script: ImportedRegexScript): TransformDirection[] {
  const directions = new Set<TransformDirection>();
  if (script.raw.promptOnly) {
    directions.add("prompt");
    return [...directions].sort();
  }
  if (script.raw.placement.includes(RegexPlacement.WORLD_INFO)) {
    directions.add("prompt");
  }
  if (script.raw.placement.includes(RegexPlacement.USER_INPUT)) directions.add("input");
  if (
    script.raw.placement.includes(RegexPlacement.AI_OUTPUT) &&
    !containsHtml(script.raw.replaceString ?? "") &&
    !isStatusSourceRegex(script.raw.findRegex)
  ) {
    directions.add("output");
  }
  return [...directions].sort();
}

function isStatusSourceRegex(pattern: string): boolean {
  return /<SFW>|<NSFW>/i.test(pattern) && /\\\{/.test(pattern);
}

function compileStatePanelRules(scripts: ImportedRegexScript[]): RenderIntent[] {
  const script = scripts.find(isStateUpdateCleanupRule) ?? scripts.find(hasStateUpdateConvention);
  if (!script) return [];
  return [{
    schemaVersion: RENDER_INTENT_SCHEMA_VERSION,
    id: `${script.id}:state-panel`,
    kind: "state-panel",
    sourceScriptId: script.id,
    title: "Story State",
    confidence: 0.78,
    dataTemplate: "$1",
    sourcePattern: storyStateSourcePattern(),
  }];
}

function isStateUpdateCleanupRule(script: ImportedRegexScript): boolean {
  return /UpdateVariable/i.test(script.raw.findRegex) &&
    (script.raw.replaceString ?? "").trim().length === 0;
}

function hasStateUpdateConvention(script: ImportedRegexScript): boolean {
  return /UpdateVariable/i.test(script.raw.findRegex) ||
    /UpdateVariable/i.test(script.raw.replaceString ?? "") ||
    /变量更新/.test(script.raw.scriptName);
}

function compileActionChoiceRules(scripts: ImportedRegexScript[]): RenderIntent[] {
  const script = scripts.find(isActionCleanupRule) ?? scripts.find(hasActionConvention);
  if (!script) return [];
  return [{
    schemaVersion: RENDER_INTENT_SCHEMA_VERSION,
    id: `${script.id}:action-options`,
    kind: "choice-list",
    sourceScriptId: script.id,
    title: "Actions",
    confidence: 0.76,
    options: [],
    dataTemplate: "$1",
    sourcePattern: storyActionsSourcePattern(),
  }];
}

function isActionCleanupRule(script: ImportedRegexScript): boolean {
  return /<action>/i.test(script.raw.findRegex) &&
    (script.raw.replaceString ?? "").trim().length === 0;
}

function hasActionConvention(script: ImportedRegexScript): boolean {
  return /<action>/i.test(script.raw.findRegex) ||
    /<action>/i.test(script.raw.replaceString ?? "") ||
    /动作选项/.test(script.raw.scriptName);
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

function isHtmlUiConversion(conversion: ReturnType<typeof convertRegexToRenderIntent>): boolean {
  return conversion.classification.reasons.includes("html replacement");
}

function emptyRepairReport(): RepairReport {
  return {
    appliedPatches: [],
    manualPatches: [],
    rejectedPatches: [],
  };
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
