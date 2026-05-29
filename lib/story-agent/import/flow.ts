import {
  createImportedAssetBundle,
  type ImportDiagnostic,
} from "@/lib/adapters/import";
import { setBlob } from "@/lib/data/local-storage";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import {
  compileSessionBlueprint,
  type SessionBlueprint,
} from "@/lib/story-agent/blueprint";
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
  const blueprint = compileSessionBlueprint(bundle, {
    id: input.blueprintId,
    createdAt,
  });

  return {
    bundle,
    blueprint,
    summary: summarizeStoryAgentImport(bundle, blueprint),
    confirmation: createConfirmation(blueprint),
    diagnostics: [...bundle.diagnostics, ...blueprint.diagnostics],
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
    diagnosticCount: blueprint.diagnostics.length,
  };
}

function createConfirmation(blueprint: SessionBlueprint): StoryAgentConfirmation {
  const reasons = [
    ...blueprint.repairReport.manualPatches.map((patch) => `Manual repair required: ${patch}`),
    ...blueprint.diagnostics
      .filter((diagnostic: ImportDiagnostic) => diagnostic.severity === "error")
      .map((diagnostic) => diagnostic.message),
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
