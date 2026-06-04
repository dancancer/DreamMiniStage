/**
 * @input  none
 * @output WorldBookRecordScope, createWorldBookRecordKey, createWorldBookSettingsRecordKey, isWorldBookSettingsRecordKey
 * @pos    世界书本地 record key 规则
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       World Book Record Keys                             ║
 * ║                                                                           ║
 * ║  集中定义 World Book 在本地 record store 中的 key 语义，避免调用者手拼。   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

export type WorldBookRecordScope = "global" | "character" | "dialogue";

export const WORLD_BOOK_SETTINGS_SUFFIX = "_settings" as const;
export const WORLD_BOOK_RECORD_PREFIX_BY_SCOPE: Record<WorldBookRecordScope, string> = {
  global: "global:",
  character: "character:",
  dialogue: "dialogue:",
};

const WORLD_BOOK_RECORD_PREFIXES = Object.values(WORLD_BOOK_RECORD_PREFIX_BY_SCOPE);

function normalizeWorldBookRecordId(scope: WorldBookRecordScope, id: string): string {
  const normalized = id.trim();
  if (!normalized) {
    throw new Error(`World Book ${scope} id is required`);
  }
  if (WORLD_BOOK_RECORD_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error(`World Book ${scope} id must not include a record prefix: ${normalized}`);
  }
  return normalized;
}

export function getWorldBookRecordPrefix(scope: WorldBookRecordScope): string {
  return WORLD_BOOK_RECORD_PREFIX_BY_SCOPE[scope];
}

export function createWorldBookRecordKey(scope: WorldBookRecordScope, id: string): string {
  return `${getWorldBookRecordPrefix(scope)}${normalizeWorldBookRecordId(scope, id)}`;
}

export function createCharacterWorldBookRecordKey(characterId: string): string {
  return createWorldBookRecordKey("character", characterId);
}

export function createDialogueWorldBookRecordKey(dialogueId: string): string {
  return createWorldBookRecordKey("dialogue", dialogueId);
}

export function createGlobalWorldBookRecordKey(globalId: string): string {
  return createWorldBookRecordKey("global", globalId);
}

export function createUniqueGlobalWorldBookRecordKey(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return createGlobalWorldBookRecordKey(`${timestamp}_${random}`);
}

export function isWorldBookSettingsRecordKey(key: string): boolean {
  return key.endsWith(WORLD_BOOK_SETTINGS_SUFFIX);
}

export function createWorldBookSettingsRecordKey(worldBookKey: string): string {
  if (isWorldBookSettingsRecordKey(worldBookKey)) {
    throw new Error(`World Book settings key must be derived from a content key: ${worldBookKey}`);
  }
  return `${worldBookKey}${WORLD_BOOK_SETTINGS_SUFFIX}`;
}

export function isGlobalWorldBookRecordKey(key: string): boolean {
  return key.startsWith(getWorldBookRecordPrefix("global")) && !isWorldBookSettingsRecordKey(key);
}
