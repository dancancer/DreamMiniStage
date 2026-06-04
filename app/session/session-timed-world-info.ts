/**
 * @input  app/session/session-host-bridge, lib/data/roleplay/character-dialogue-operation, lib/data/roleplay/world-book-operation, lib/dialogue/chat-metadata
 * @output getSessionWorldInfoTimedEffect, setSessionWorldInfoTimedEffect
 * @pos    /session World Book timed effect 状态读写
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    Session World Book Timed Effects                      ║
 * ║                                                                           ║
 * ║  以 dialogue chat_metadata.timedWorldInfo 为单一路径，管理 World Book 条目的║
 * ║  sticky/cooldown/delay 运行时状态。                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { getDialogueChatMetadata, setDialogueChatMetadata } from "@/lib/dialogue/chat-metadata";
import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";
import type { WorldBookEntry } from "@/lib/models/world-book-model";
import {
  getConfiguredWorldBookTimedEffectValue,
  normalizeWorldBookTimedEffectState,
  readWorldBookTimedEffectValue,
  resolveNextWorldBookTimedEffectValue,
  writeWorldBookTimedEffectValue,
  type WorldBookTimedEffectFormat,
  type WorldBookTimedEffectName,
  type WorldBookTimedEffectState,
  type WorldBookTimedEffectStateMap,
} from "@/lib/world-book/timed-effects";

const TIMED_WORLD_BOOK_METADATA_KEY = "timedWorldInfo";

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
    throw new Error(`World Book not found: ${file}`);
  }

  const entryKey = resolveEntryKeyByUid(worldBook, uid);
  if (!entryKey) {
    throw new Error(`World Book entry not found: ${uid}`);
  }

  return worldBook[entryKey];
}

async function loadDialogueTimedWorldInfoState(dialogueId: string): Promise<{
  tree: NonNullable<Awaited<ReturnType<typeof LocalCharacterDialogueOperations.getDialogueTreeById>>>;
  state: WorldBookTimedEffectStateMap;
}> {
  const tree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueId);
  if (!tree) {
    throw new Error(`Dialogue not found: ${dialogueId}`);
  }

  const resolvedTree: NonNullable<typeof tree> = tree;
  const metadata = getDialogueChatMetadata(resolvedTree);
  return {
    tree: resolvedTree,
    state: normalizeWorldBookTimedEffectState(metadata[TIMED_WORLD_BOOK_METADATA_KEY]),
  };
}

export async function getSessionWorldInfoTimedEffect(input: {
  dialogueId: string;
  file: string;
  uid: string;
  effect: WorldBookTimedEffectName;
  format?: WorldBookTimedEffectFormat;
}): Promise<boolean | number> {
  await resolveTimedEffectEntry(input.file, input.uid);
  const { state } = await loadDialogueTimedWorldInfoState(input.dialogueId);
  const currentValue = readWorldBookTimedEffectValue(state, input.file, input.uid, input.effect);

  if (input.format === "number") {
    return currentValue;
  }
  return currentValue > 0;
}

export async function setSessionWorldInfoTimedEffect(input: {
  dialogueId: string;
  file: string;
  uid: string;
  effect: WorldBookTimedEffectName;
  state: WorldBookTimedEffectState;
}): Promise<void> {
  const entry = await resolveTimedEffectEntry(input.file, input.uid);
  const { tree, state } = await loadDialogueTimedWorldInfoState(input.dialogueId);
  const currentValue = readWorldBookTimedEffectValue(state, input.file, input.uid, input.effect);
  const configuredValue = getConfiguredWorldBookTimedEffectValue(entry, input.effect);
  const nextValue = resolveNextWorldBookTimedEffectValue({
    currentValue,
    configuredValue,
    effect: input.effect,
    state: input.state,
  });
  const nextState = writeWorldBookTimedEffectValue(state, input.file, input.uid, input.effect, nextValue);
  const metadata = getDialogueChatMetadata(tree);

  if (Object.keys(nextState).length === 0) {
    const nextMetadata = { ...metadata };
    delete nextMetadata[TIMED_WORLD_BOOK_METADATA_KEY];
    setDialogueChatMetadata(tree, nextMetadata);
  } else {
    setDialogueChatMetadata(tree, {
      ...metadata,
      [TIMED_WORLD_BOOK_METADATA_KEY]: nextState,
    });
  }

  await LocalCharacterDialogueOperations.updateDialogueTree(input.dialogueId, tree);
}
