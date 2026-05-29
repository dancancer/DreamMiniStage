import type {
  SessionBlueprint,
  WorldModuleEntry,
} from "@/lib/story-agent/blueprint";

export interface WorldActivationEntryState {
  stickyRemaining: number;
  cooldownRemaining: number;
  delayRemaining: number;
}

export type WorldActivationState = Record<string, WorldActivationEntryState>;

export interface WorldHit {
  moduleId: string;
  entryId: string;
  content: string;
  depth: number;
  insertionOrder: number;
  position: string | number;
  sourcePath: string;
  reason: "constant" | "keyword" | "sticky" | "delayed";
}

export interface WorldMatchResult {
  hits: WorldHit[];
  activationState: WorldActivationState;
}

export function matchWorldModules(
  blueprint: Pick<SessionBlueprint, "worldModules">,
  text: string,
  state: WorldActivationState = {},
): WorldMatchResult {
  const nextState: WorldActivationState = {};
  const hits = blueprint.worldModules.flatMap((module) =>
    module.entries.flatMap((entry) => {
      const key = stateKey(module.id, entry.id);
      const previous = state[key];
      const current = tickState(previous);
      const delayedReady = Boolean(previous?.delayRemaining && current.delayRemaining === 0);
      const matched = matchesEntry(entry, text);
      const hit = resolveHit(entry, module.id, module.sourcePath, current, matched, delayedReady);
      nextState[key] = nextEntryState(entry, current, hit?.reason, matched);
      return hit ? [hit] : [];
    }),
  );

  return {
    hits: hits.sort(compareHits),
    activationState: pruneState(nextState),
  };
}

function resolveHit(
  entry: WorldModuleEntry,
  moduleId: string,
  sourcePath: string,
  state: WorldActivationEntryState,
  matched: boolean,
  delayedReady: boolean,
): WorldHit | undefined {
  if (!entry.enabled) return undefined;
  if (state.stickyRemaining > 0) return worldHit(entry, moduleId, sourcePath, "sticky");
  if (delayedReady) return worldHit(entry, moduleId, sourcePath, "delayed");
  if (state.cooldownRemaining > 0 || state.delayRemaining > 0) return undefined;
  if (!matched) return undefined;
  if (entry.activation.delay > 0) return undefined;
  return worldHit(entry, moduleId, sourcePath, entry.constant ? "constant" : "keyword");
}

function matchesEntry(entry: WorldModuleEntry, text: string): boolean {
  if (entry.constant) return true;
  const primary = entry.primaryKeys.some((key) => matchesKey(entry, key, text));
  if (!primary) return false;
  if (!entry.selective) return true;

  const secondaryMatches = entry.secondaryKeys.map((key) => matchesKey(entry, key, text));
  if (secondaryMatches.length === 0) return false;

  if (entry.secondaryKeyLogic === "AND" || entry.secondaryKeyLogic === "AND_ALL") {
    return secondaryMatches.every(Boolean);
  }
  if (entry.secondaryKeyLogic === "NOT" || entry.secondaryKeyLogic === "NOT_ANY") {
    return secondaryMatches.every((matched) => !matched);
  }
  if (entry.secondaryKeyLogic === "NOT_ALL") {
    return !secondaryMatches.every(Boolean);
  }
  return secondaryMatches.some(Boolean);
}

function matchesKey(entry: WorldModuleEntry, key: string, text: string): boolean {
  if (entry.useRegex) return matchesRegex(key, text, entry.caseSensitive);
  const source = entry.caseSensitive ? text : text.toLowerCase();
  const target = entry.caseSensitive ? key : key.toLowerCase();
  if (!entry.matchWholeWords) return source.includes(target);
  return new RegExp(`\\b${escapeRegex(target)}\\b`, entry.caseSensitive ? "" : "i").test(text);
}

function matchesRegex(pattern: string, text: string, caseSensitive: boolean): boolean {
  try {
    return new RegExp(pattern, caseSensitive ? "" : "i").test(text);
  } catch {
    return false;
  }
}

function nextEntryState(
  entry: WorldModuleEntry,
  current: WorldActivationEntryState,
  hitReason: WorldHit["reason"] | undefined,
  matched: boolean,
): WorldActivationEntryState {
  if (hitReason === "sticky") return current;

  if (hitReason) {
    return {
      stickyRemaining: entry.activation.sticky,
      cooldownRemaining: entry.activation.cooldown,
      delayRemaining: 0,
    };
  }

  if (matchesDelayedStart(entry, current, matched)) {
    return {
      stickyRemaining: 0,
      cooldownRemaining: 0,
      delayRemaining: entry.activation.delay,
    };
  }

  return current;
}

function matchesDelayedStart(
  entry: WorldModuleEntry,
  current: WorldActivationEntryState,
  matched: boolean,
): boolean {
  return matched &&
    entry.activation.delay > 0 &&
    current.delayRemaining === 0 &&
    current.cooldownRemaining === 0;
}

function tickState(state: WorldActivationEntryState | undefined): WorldActivationEntryState {
  return {
    stickyRemaining: Math.max((state?.stickyRemaining ?? 0) - 1, 0),
    cooldownRemaining: Math.max((state?.cooldownRemaining ?? 0) - 1, 0),
    delayRemaining: Math.max((state?.delayRemaining ?? 0) - 1, 0),
  };
}

function worldHit(
  entry: WorldModuleEntry,
  moduleId: string,
  sourcePath: string,
  reason: WorldHit["reason"],
): WorldHit {
  return {
    moduleId,
    entryId: entry.id,
    content: entry.content,
    depth: entry.depth,
    insertionOrder: entry.insertionOrder,
    position: entry.position,
    sourcePath,
    reason,
  };
}

function pruneState(state: WorldActivationState): WorldActivationState {
  return Object.fromEntries(
    Object.entries(state).filter(([, value]) =>
      value.stickyRemaining > 0 || value.cooldownRemaining > 0 || value.delayRemaining > 0,
    ),
  );
}

function compareHits(left: WorldHit, right: WorldHit): number {
  return left.insertionOrder - right.insertionOrder ||
    left.depth - right.depth ||
    left.entryId.localeCompare(right.entryId);
}

function stateKey(moduleId: string, entryId: string): string {
  return `${moduleId}:${entryId}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
