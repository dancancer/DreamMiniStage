import {
  createImportedAssetBundle,
  runImportQaRepair,
  type ImportDiagnostic,
  type ImportedAssetBundle,
  type QaModelPort,
  type ValidatedRepairPatch,
} from "@/lib/adapters/import";
import { setBlob } from "@/lib/data/local-storage";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import {
  compileSessionBlueprint,
  type SessionBlueprint,
} from "@/lib/story-agent/blueprint";
import { diagnoseInitialStateSources } from "@/lib/story-agent/blueprint/initial-state";
import {
  createStoryAgentCharacterData,
  createStorySessionForCharacter,
  saveStoryBlueprint,
} from "@/lib/story-agent/session";
import type {
  StoryAgentCommitInput,
  StoryAgentConfirmation,
  StoryAgentImportInput,
  StoryAgentImportPreview,
  StoryAgentImportResult,
  StoryAgentImportSummary,
  StoryAgentRawAsset,
} from "./types";

export function compileStoryAgentImport(
  input: StoryAgentImportInput,
): StoryAgentImportPreview {
  const { bundle, createdAt } = buildImportedBundle(input);
  return previewFromBundle(bundle, input.blueprintId, createdAt);
}

// 走 QA-repair LLM 质检的导入预览：bundle 构建后先跑 QA-repair（low-risk 自动应用、
// medium/high 留待确认），再用修复后的 bundle 编译 blueprint。qaModel 是注入的端口，
// 不在此发起真实模型调用——prod 由调用方传入 model-gateway adapter，测试传 fake。
export async function compileStoryAgentImportWithQaRepair(
  input: StoryAgentImportInput,
  qaModel: QaModelPort,
): Promise<StoryAgentImportPreview> {
  const { bundle, createdAt } = buildImportedBundle(input);
  // 把 blueprint 层的 initial-state / 未知约定诊断也喂给 QA 模型，使其能看到变量约定缺口
  // （这些诊断在 bundle 层不可见）。QA 仍只在编译期运行，不进运行时（INV-6）。
  const qaRepair = await runImportQaRepair(bundle, qaModel, {
    extraDiagnostics: diagnoseInitialStateSources(bundle),
  });
  return previewFromBundle(qaRepair.bundle, input.blueprintId, createdAt, {
    autoApplied: qaRepair.autoApplied,
    pendingConfirmation: qaRepair.pendingConfirmation,
  });
}

function buildImportedBundle(
  input: StoryAgentImportInput,
): { bundle: ImportedAssetBundle; createdAt: string } {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const characterId = input.characterId ?? createCharacterId(input.character.source.sourceHash);
  const bundle = createImportedAssetBundle({
    bundleId: input.bundleId ?? `bundle:${characterId}`,
    sourceHash: createBundleHash(input),
    createdAt,
    characterId,
    character: input.character,
    worldBooks: input.worldBooks,
    preset: input.preset,
    regexScripts: input.regexScripts,
  });
  return { bundle, createdAt };
}

function previewFromBundle(
  bundle: ImportedAssetBundle,
  blueprintId: string | undefined,
  createdAt: string,
  qaRepair?: StoryAgentImportPreview["qaRepair"],
): StoryAgentImportPreview {
  const blueprint = compileSessionBlueprint(bundle, { id: blueprintId, createdAt });
  return {
    bundle,
    blueprint,
    summary: summarizeStoryAgentImport(bundle, blueprint),
    confirmation: createConfirmation(blueprint, qaRepair?.pendingConfirmation),
    diagnostics: [...bundle.diagnostics, ...blueprint.diagnostics],
    qaRepair,
  };
}

export async function commitStoryAgentImport(
  input: StoryAgentCommitInput,
): Promise<StoryAgentImportResult> {
  const { blueprint } = input;
  await saveStoryBlueprint(blueprint);
  await LocalCharacterRecordOperations.createCharacter(
    blueprint.profile.id,
    createStoryAgentCharacterData(blueprint),
    avatarPath(input),
  );

  if (input.avatar) {
    await setBlob(avatarPath(input), input.avatar);
  }

  const session = await createStorySessionForCharacter(blueprint.profile.id, {
    name: input.sessionName,
  });

  return {
    characterId: blueprint.profile.id,
    sessionId: session.id,
    blueprintId: blueprint.id,
    blueprint,
    session,
    summary: summarizeBlueprint(blueprint),
    confirmation: createConfirmation(blueprint),
    diagnostics: blueprint.diagnostics,
  };
}

export async function importStoryAgentSession(
  input: StoryAgentImportInput,
): Promise<StoryAgentImportResult> {
  const preview = compileStoryAgentImport(input);
  return commitStoryAgentImport({
    blueprint: preview.blueprint,
    avatar: input.avatar,
    sessionName: input.sessionName,
  });
}

function summarizeStoryAgentImport(
  bundle: StoryAgentImportPreview["bundle"],
  blueprint: SessionBlueprint,
): StoryAgentImportSummary {
  return {
    ...summarizeBlueprint(blueprint),
    worldBookCount: bundle.worldBooks.length,
    worldBookEntryCount: bundle.worldBooks.reduce((total, book) => total + book.entries.length, 0),
    regexScriptCount: bundle.regexScripts.length,
  };
}

function summarizeBlueprint(blueprint: SessionBlueprint): StoryAgentImportSummary {
  return {
    characterName: blueprint.profile.name,
    worldBookCount: blueprint.worldModules.length,
    worldBookEntryCount: blueprint.worldModules.reduce((total, module) => total + module.entries.length, 0),
    regexScriptCount:
      blueprint.inputTransforms.length +
      blueprint.outputTransforms.length +
      blueprint.promptTransforms.length,
    renderRuleCount: blueprint.renderRules.length,
    promptMessageCount: blueprint.promptStack.messages.length,
    openingCount: blueprint.profile.openings.length,
    diagnosticCount: blueprint.diagnostics.length,
  };
}

function createConfirmation(
  blueprint: SessionBlueprint,
  pendingPatches: ValidatedRepairPatch[] = [],
): StoryAgentConfirmation {
  const reasons = [
    ...blueprint.repairReport.manualPatches.map((patch) => `Manual repair required: ${patch}`),
    ...blueprint.diagnostics
      .filter((diagnostic: ImportDiagnostic) => diagnostic.severity === "error")
      .map((diagnostic) => diagnostic.message),
    ...pendingPatches.map(
      (entry) =>
        `QA repair NOT applied — manual review required (${entry.computedRisk}): ${entry.patch.targetPath} — ${entry.patch.reason}`,
    ),
  ];

  return {
    required: reasons.length > 0,
    reasons,
  };
}

function avatarPath(input: Pick<StoryAgentCommitInput, "blueprint" | "avatar">): string {
  return input.avatar ? `${input.blueprint.profile.id}.png` : "";
}

function createCharacterId(sourceHash: string): string {
  return `agent_${sanitizeId(sourceHash).slice(0, 24)}`;
}

function createBundleHash(input: StoryAgentImportInput): string {
  return [
    input.character.source.sourceHash,
    ...(input.worldBooks ?? []).map(sourceHash),
    ...(input.regexScripts ?? []).map(sourceHash),
    input.preset?.source.sourceHash ?? "",
  ].filter(Boolean).join("|");
}

function sourceHash(asset: StoryAgentRawAsset): string {
  return asset.source.sourceHash;
}

function sanitizeId(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, "_");
  return sanitized || `story_${Date.now()}`;
}
