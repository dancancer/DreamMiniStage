import type {
  QuickReplyCreateOptions,
  QuickReplyLookup,
  QuickReplySetOptions,
  QuickReplySetScope,
  QuickReplySetVisibilityOptions,
  QuickReplySetSnapshot,
  QuickReplySnapshot,
} from "@/lib/slash-command/types";

// ============================================================================
//                              类型定义
// ============================================================================

interface QuickReplyContextBinding {
  name: string;
  chain: boolean;
}

export interface QuickReplyRecord extends QuickReplySnapshot {
  id: number;
  label: string;
  message: string;
  icon?: string;
  showLabel: boolean;
  title?: string;
  hidden: boolean;
  startup: boolean;
  user: boolean;
  bot: boolean;
  load: boolean;
  new: boolean;
  group: boolean;
  generation: boolean;
  automationId?: string;
  contextSets: QuickReplyContextBinding[];
  createdAt: string;
  updatedAt: string;
}

export interface QuickReplySetRecord extends QuickReplySetSnapshot {
  name: string;
  nosend: boolean;
  before: boolean;
  inject: boolean;
  replies: QuickReplyRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ActiveQuickReplySetEntry extends QuickReplySetSnapshot {
  name: string;
  visible: boolean;
  scope: Exclude<QuickReplySetScope, "all">;
}

export interface VisibleQuickReplyEntry {
  scope: Exclude<QuickReplySetScope, "all">;
  set: QuickReplySetRecord;
  reply: QuickReplyRecord;
}

export interface QuickReplyStoreState {
  nextReplyId: number;
  sets: Record<string, QuickReplySetRecord>;
  globalSets: Array<{ name: string; visible: boolean }>;
  chatSets: Record<string, Array<{ name: string; visible: boolean }>>;

  getQuickReplySet: (name: string) => QuickReplySetRecord | undefined;
  getAllQuickReplySets: () => QuickReplySetRecord[];
  listQuickReplySets: (scope?: QuickReplySetScope, dialogueId?: string) => ActiveQuickReplySetEntry[];
  listQuickReplies: (setName: string) => QuickReplyRecord[];
  getVisibleQuickReplies: (dialogueId?: string) => VisibleQuickReplyEntry[];
  resolveVisibleQuickReply: (dialogueId: string | undefined, index: number) => VisibleQuickReplyEntry;
  createQuickReplySet: (name: string, options?: QuickReplySetOptions) => QuickReplySetRecord;
  updateQuickReplySet: (name: string, options?: QuickReplySetOptions) => QuickReplySetRecord;
  deleteQuickReplySet: (name: string, dialogueId?: string) => void;
  toggleGlobalQuickReplySet: (name: string, options?: QuickReplySetVisibilityOptions) => void;
  addGlobalQuickReplySet: (name: string, options?: QuickReplySetVisibilityOptions) => void;
  removeGlobalQuickReplySet: (name: string) => void;
  toggleChatQuickReplySet: (dialogueId: string, name: string, options?: QuickReplySetVisibilityOptions) => void;
  addChatQuickReplySet: (dialogueId: string, name: string, options?: QuickReplySetVisibilityOptions) => void;
  removeChatQuickReplySet: (dialogueId: string, name: string) => void;
  createQuickReply: (
    setName: string,
    label: string,
    message: string,
    options?: QuickReplyCreateOptions,
  ) => QuickReplyRecord;
  getQuickReply: (setName: string, target: QuickReplyLookup) => QuickReplyRecord | undefined;
  updateQuickReply: (setName: string, target: QuickReplyLookup, options?: import("@/lib/slash-command/types").QuickReplyUpdateOptions) => QuickReplyRecord;
  deleteQuickReply: (setName: string, target: QuickReplyLookup) => void;
  addQuickReplyContextSet: (
    setName: string,
    target: QuickReplyLookup,
    contextSetName: string,
    options?: import("@/lib/slash-command/types").QuickReplyContextOptions,
  ) => QuickReplyRecord;
  removeQuickReplyContextSet: (setName: string, target: QuickReplyLookup, contextSetName: string) => QuickReplyRecord;
  clearQuickReplyContextSets: (setName: string, target: QuickReplyLookup) => QuickReplyRecord;
  activateContextSets: (dialogueId: string, reply: QuickReplyRecord) => void;
  reset: () => void;
}

// ============================================================================
//                              纯工具函数
// ============================================================================

export const emptyStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeName(name: string, label: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

export function cloneReply(reply: QuickReplyRecord): QuickReplyRecord {
  return {
    ...reply,
    contextSets: reply.contextSets.map((entry) => ({ ...entry })),
  };
}

export function cloneSet(set: QuickReplySetRecord): QuickReplySetRecord {
  return {
    ...set,
    replies: set.replies.map(cloneReply),
  };
}

export function ensureDialogueId(dialogueId: string | undefined): string {
  const normalized = dialogueId?.trim();
  if (!normalized) {
    throw new Error("Quick Reply chat scope requires dialogueId");
  }
  return normalized;
}

export function findReplyIndex(set: QuickReplySetRecord, target: QuickReplyLookup): number {
  if (typeof target.id === "number") {
    return set.replies.findIndex((reply) => reply.id === target.id);
  }

  const label = normalizeName(target.label || "", "quick reply label");
  return set.replies.findIndex((reply) => reply.label === label);
}

export function ensureSet(state: QuickReplyStoreState, name: string): QuickReplySetRecord {
  const normalized = normalizeName(name, "quick reply set name");
  const set = state.sets[normalized];
  if (!set) {
    throw new Error(`Quick Reply set not found: ${normalized}`);
  }
  return set;
}

export function ensureReply(set: QuickReplySetRecord, target: QuickReplyLookup): QuickReplyRecord {
  const index = findReplyIndex(set, target);
  if (index < 0) {
    throw new Error(`Quick Reply not found in set ${set.name}`);
  }
  return set.replies[index];
}

export function ensureUniqueLabel(set: QuickReplySetRecord, label: string, ignoreId?: number): void {
  const exists = set.replies.some((reply) => reply.label === label && reply.id !== ignoreId);
  if (exists) {
    throw new Error(`Quick Reply label already exists in set ${set.name}: ${label}`);
  }
}

export function normalizeVisibility(options?: QuickReplySetVisibilityOptions): boolean {
  return options?.visible ?? true;
}

export function normalizeCreateOptions(options?: QuickReplyCreateOptions): QuickReplyCreateOptions {
  return {
    icon: options?.icon,
    showLabel: options?.showLabel ?? true,
    title: options?.title,
    hidden: options?.hidden ?? false,
    startup: options?.startup ?? false,
    user: options?.user ?? false,
    bot: options?.bot ?? false,
    load: options?.load ?? false,
    new: options?.new ?? false,
    group: options?.group ?? false,
    generation: options?.generation ?? false,
    automationId: options?.automationId,
  };
}

export function normalizeSetOptions(options?: QuickReplySetOptions): QuickReplySetOptions {
  return {
    nosend: options?.nosend ?? false,
    before: options?.before ?? false,
    inject: options?.inject ?? false,
  };
}

export function upsertActiveSet(
  entries: Array<{ name: string; visible: boolean }>,
  name: string,
  visible: boolean,
): Array<{ name: string; visible: boolean }> {
  const index = entries.findIndex((entry) => entry.name === name);
  if (index < 0) {
    return [...entries, { name, visible }];
  }

  const next = entries.slice();
  next[index] = { name, visible };
  return next;
}

export function removeActiveSet(
  entries: Array<{ name: string; visible: boolean }>,
  name: string,
): Array<{ name: string; visible: boolean }> {
  return entries.filter((entry) => entry.name !== name);
}

export function resolveActiveQuickReplySets(
  state: Pick<QuickReplyStoreState, "globalSets" | "chatSets">,
  dialogueId?: string,
): ActiveQuickReplySetEntry[] {
  const resolved = new Map<string, ActiveQuickReplySetEntry>();

  for (const entry of state.globalSets) {
    resolved.set(entry.name, {
      ...entry,
      scope: "global",
    });
  }

  for (const entry of state.chatSets[dialogueId || ""] || []) {
    resolved.set(entry.name, {
      ...entry,
      scope: "chat",
    });
  }

  return Array.from(resolved.values());
}

export const initialState = {
  nextReplyId: 1,
  sets: {},
  globalSets: [],
  chatSets: {},
};

// ============================================================================
//                         QuickReply 构建器
// ============================================================================

export function buildNewReply(
  id: number,
  label: string,
  message: string,
  options?: QuickReplyCreateOptions,
): QuickReplyRecord {
  const normalized = normalizeCreateOptions(options);
  const createdAt = nowIso();
  return {
    id,
    label,
    message,
    icon: normalized.icon,
    showLabel: normalized.showLabel ?? true,
    title: normalized.title,
    hidden: normalized.hidden ?? false,
    startup: normalized.startup ?? false,
    user: normalized.user ?? false,
    bot: normalized.bot ?? false,
    load: normalized.load ?? false,
    new: normalized.new ?? false,
    group: normalized.group ?? false,
    generation: normalized.generation ?? false,
    automationId: normalized.automationId,
    contextSets: [],
    createdAt,
    updatedAt: createdAt,
  };
}

export function buildUpdatedReply(
  current: QuickReplyRecord,
  nextLabel: string,
  nextMessage: string,
  options?: QuickReplyCreateOptions,
): QuickReplyRecord {
  const normalized = normalizeCreateOptions(options);
  return {
    ...current,
    label: nextLabel,
    message: nextMessage,
    icon: normalized.icon,
    showLabel: normalized.showLabel ?? current.showLabel,
    title: normalized.title,
    hidden: normalized.hidden ?? current.hidden,
    startup: normalized.startup ?? current.startup,
    user: normalized.user ?? current.user,
    bot: normalized.bot ?? current.bot,
    load: normalized.load ?? current.load,
    new: normalized.new ?? current.new,
    group: normalized.group ?? current.group,
    generation: normalized.generation ?? current.generation,
    automationId: normalized.automationId,
    updatedAt: nowIso(),
  };
}

export function replaceReplyInSet(
  quickReplySet: QuickReplySetRecord,
  currentId: number,
  updated: QuickReplyRecord,
): QuickReplySetRecord {
  return {
    ...quickReplySet,
    replies: quickReplySet.replies.map((reply) => reply.id === currentId ? updated : reply),
    updatedAt: updated.updatedAt,
  };
}
