/**
 * @input  lib/models/world-book-model, lib/slash-command/types
 * @output WorldBookTimedEffectName, normalizeWorldBookTimedEffectState, writeWorldBookTimedEffectValue
 * @pos    World Book timed effect 规则 - sticky/cooldown/delay 状态归一与切换
 */

import type { WorldBookEntry } from "@/lib/models/world-book-model";
import type {
  WorldInfoTimedEffectFormat,
  WorldInfoTimedEffectName,
  WorldInfoTimedEffectState,
} from "@/lib/slash-command/types";

export const WORLD_BOOK_TIMED_EFFECTS = ["sticky", "cooldown", "delay"] as const;

export type WorldBookTimedEffectName = WorldInfoTimedEffectName;
export type WorldBookTimedEffectFormat = WorldInfoTimedEffectFormat;
export type WorldBookTimedEffectState = WorldInfoTimedEffectState;
export type WorldBookTimedEffectStateMap = Record<
  string,
  Record<string, Partial<Record<WorldBookTimedEffectName, number>>>
>;

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeEffectValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.trunc(value);
}

export function decrementWorldBookTimedEffectValue(value: unknown): number {
  return Math.max(normalizeEffectValue(value) - 1, 0);
}

export function normalizeWorldBookTimedEffectState(
  value: unknown,
): WorldBookTimedEffectStateMap {
  const next: WorldBookTimedEffectStateMap = {};
  for (const [file, uidMap] of Object.entries(toRecord(value))) {
    const normalizedUidMap: Record<string, Partial<Record<WorldBookTimedEffectName, number>>> = {};
    for (const [uid, rawEffects] of Object.entries(toRecord(uidMap))) {
      const normalizedEffects: Partial<Record<WorldBookTimedEffectName, number>> = {};
      for (const effect of WORLD_BOOK_TIMED_EFFECTS) {
        const effectValue = normalizeEffectValue(toRecord(rawEffects)[effect]);
        if (effectValue > 0) {
          normalizedEffects[effect] = effectValue;
        }
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

export function readWorldBookTimedEffectValue(
  state: WorldBookTimedEffectStateMap,
  file: string,
  uid: string,
  effect: WorldBookTimedEffectName,
): number {
  return state[file]?.[uid]?.[effect] || 0;
}

export function writeWorldBookTimedEffectValue(
  state: WorldBookTimedEffectStateMap,
  file: string,
  uid: string,
  effect: WorldBookTimedEffectName,
  value: number,
): WorldBookTimedEffectStateMap {
  const next = normalizeWorldBookTimedEffectState(state);

  if (value > 0) {
    next[file] = next[file] || {};
    next[file][uid] = next[file][uid] || {};
    next[file][uid][effect] = Math.trunc(value);
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

export function getConfiguredWorldBookTimedEffectValue(
  entry: WorldBookEntry,
  effect: WorldBookTimedEffectName,
): number {
  return normalizeEffectValue(entry[effect]);
}

export function resolveNextWorldBookTimedEffectValue(input: {
  currentValue: number;
  configuredValue: number;
  effect: WorldBookTimedEffectName;
  state: WorldBookTimedEffectState;
}): number {
  if (input.state === "off") {
    return 0;
  }

  if (input.configuredValue <= 0) {
    throw new Error(`/wi-set-timed-effect effect is not configured on World Book entry: ${input.effect}`);
  }

  if (input.state === "on") {
    return input.configuredValue;
  }

  return input.currentValue > 0 ? 0 : input.configuredValue;
}
