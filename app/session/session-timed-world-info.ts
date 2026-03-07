/**
 * @input  app/session/session-host-bridge, lib/data/roleplay/character-dialogue-operation, lib/data/roleplay/world-book-operation, lib/dialogue/chat-metadata
 * @output getSessionWorldInfoTimedEffect, setSessionWorldInfoTimedEffect
 * @pos    /session timed world info 状态读写
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    Session Timed World Info State                        ║
 * ║                                                                           ║
 * ║  以 dialogue chat_metadata.timedWorldInfo 为单一路径，管理 lore 条目的      ║
 * ║  sticky/cooldown/delay 运行时状态。                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { getDialogueChatMetadata, setDialogueChatMetadata } from "@/lib/dialogue/chat-metadata";
import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";
import type { WorldBookEntry } from "@/lib/models/world-book-model";
import type {
  WorldInfoTimedEffectFormat,
  WorldInfoTimedEffectName,
  WorldInfoTimedEffectState,
} from "@/lib/slash-command/types";

const TIMED_WORLD_INFO_METADATA_KEY = "timedWorldInfo";

type TimedWorldInfoState = Record<string, Record<string, Partial<Record<WorldInfoTimedEffectName, number>>>>;

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeTimedWorldInfoState(value: unknown): TimedWorldInfoState {
  const next: TimedWorldInfoState = {};
  for (const [file, uidMap] of Object.entries(toRecord(value))) {
    const normalizedUidMap: Record<string, Partial<Record<WorldInfoTimedEffectName, number>>> = {};
    for (const [uid, rawEffects] of Object.entries(toRecord(uidMap))) {
      const normalizedEffects: Partial<Record<WorldInfoTimedEffectName, number>> = {};
      for (const effect of ["sticky", "cooldown", "delay"] as const) {
        const rawValue = toRecord(rawEffects)[effect];
        if (typeof rawValue !== "number" || !Number.isFinite(rawValue) || rawValue <= 0) {
          continue;
        }
        normalizedEffects[effect] = Math.trunc(rawValue);
      }
      if (Object.keys(normalizedEffects).length > 0) {
        normalizedUidMap[uid] = normalizedEffects;
      }
    }
    if (Object.keys(normalizedUidMap).length > 0) {
      next[file] = normalizedUidMap;
    }
  }
  return next;
}

function resolveEntryKeyByUid(entries: Record<string, WorldBookEntry>, uid: string): string | null {
  if (entries[uid]) {
    return uid;
  }

  for (const [entryKey, entry] of Object.entries(entries)) {
    const idCandidates = [entry.id, entry.entry_id].filter((candidate) => candidate !== undefined);
    if (idCandidates.some((candidate) => String(candidate) === uid)) {
      return entryKey;
    }
  }

  return null;
}

async function resolveTimedEffectEntry(file: string, uid: string): Promise<WorldBookEntry> {
  const worldBook = await WorldBookOperations.getWorldBook(file);
  if (!worldBook) {
    throw new Error(`Lorebook not found: ${file}`);
  }

  const entryKey = resolveEntryKeyByUid(worldBook, uid);
  if (!entryKey) {
    throw new Error(`Lorebook entry not found: ${uid}`);
  }

  return worldBook[entryKey];
}

function getConfiguredTimedEffectValue(entry: WorldBookEntry, effect: WorldInfoTimedEffectName): number {
  const rawValue = entry[effect];
  if (typeof rawValue !== "number" || !Number.isFinite(rawValue) || rawValue <= 0) {
    return 0;
  }
  return Math.trunc(rawValue);
}

function readTimedEffectValue(
  state: TimedWorldInfoState,
  file: string,
  uid: string,
  effect: WorldInfoTimedEffectName,
): number {
  return state[file]?.[uid]?.[effect] || 0;
}

function writeTimedEffectValue(
  state: TimedWorldInfoState,
  file: string,
  uid: string,
  effect: WorldInfoTimedEffectName,
  value: number,
): TimedWorldInfoState {
  const next = normalizeTimedWorldInfoState(state);

  if (value > 0) {
    next[file] = next[file] || {};
    next[file][uid] = next[file][uid] || {};
    next[file][uid][effect] = value;
    return next;
  }

  if (next[file]?.[uid]) {
    delete next[file][uid][effect];
    if (Object.keys(next[file][uid]).length === 0) {
      delete next[file][uid];
    }
    if (Object.keys(next[file]).length === 0) {
      delete next[file];
    }
  }

  return next;
}

function resolveNextTimedEffectValue(input: {
  currentValue: number;
  configuredValue: number;
  effect: WorldInfoTimedEffectName;
  state: WorldInfoTimedEffectState;
}): number {
  const { currentValue, configuredValue, effect, state } = input;

  if (state === "off") {
    return 0;
  }

  if (configuredValue <= 0) {
    throw new Error(`/wi-set-timed-effect effect is not configured on lore entry: ${effect}`);
  }

  if (state === "on") {
    return configuredValue;
  }

  return currentValue > 0 ? 0 : configuredValue;
}

async function loadDialogueTimedWorldInfoState(dialogueId: string): Promise<{
  tree: NonNullable<Awaited<ReturnType<typeof LocalCharacterDialogueOperations.getDialogueTreeById>>>;
  state: TimedWorldInfoState;
}> {
  const tree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueId);
  if (!tree) {
    throw new Error(`Dialogue not found: ${dialogueId}`);
  }

  const resolvedTree: NonNullable<typeof tree> = tree;
  const metadata = getDialogueChatMetadata(resolvedTree);
  return {
    tree: resolvedTree,
    state: normalizeTimedWorldInfoState(metadata[TIMED_WORLD_INFO_METADATA_KEY]),
  };
}

export async function getSessionWorldInfoTimedEffect(input: {
  dialogueId: string;
  file: string;
  uid: string;
  effect: WorldInfoTimedEffectName;
  format?: WorldInfoTimedEffectFormat;
}): Promise<boolean | number> {
  await resolveTimedEffectEntry(input.file, input.uid);
  const { state } = await loadDialogueTimedWorldInfoState(input.dialogueId);
  const currentValue = readTimedEffectValue(state, input.file, input.uid, input.effect);

  if (input.format === "number") {
    return currentValue;
  }
  return currentValue > 0;
}

export async function setSessionWorldInfoTimedEffect(input: {
  dialogueId: string;
  file: string;
  uid: string;
  effect: WorldInfoTimedEffectName;
  state: WorldInfoTimedEffectState;
}): Promise<void> {
  const entry = await resolveTimedEffectEntry(input.file, input.uid);
  const { tree, state } = await loadDialogueTimedWorldInfoState(input.dialogueId);
  const currentValue = readTimedEffectValue(state, input.file, input.uid, input.effect);
  const configuredValue = getConfiguredTimedEffectValue(entry, input.effect);
  const nextValue = resolveNextTimedEffectValue({
    currentValue,
    configuredValue,
    effect: input.effect,
    state: input.state,
  });
  const nextState = writeTimedEffectValue(state, input.file, input.uid, input.effect, nextValue);
  const metadata = getDialogueChatMetadata(tree);

  if (Object.keys(nextState).length === 0) {
    const nextMetadata = { ...metadata };
    delete nextMetadata[TIMED_WORLD_INFO_METADATA_KEY];
    setDialogueChatMetadata(tree, nextMetadata);
  } else {
    setDialogueChatMetadata(tree, {
      ...metadata,
      [TIMED_WORLD_INFO_METADATA_KEY]: nextState,
    });
  }

  await LocalCharacterDialogueOperations.updateDialogueTree(input.dialogueId, tree);
}
