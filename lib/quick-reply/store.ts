import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
  QuickReplyContextOptions,
  QuickReplyCreateOptions,
  QuickReplyLookup,
  QuickReplySetOptions,
  QuickReplySetScope,
  QuickReplySetSnapshot,
  QuickReplySetVisibilityOptions,
  QuickReplySnapshot,
  QuickReplyUpdateOptions,
} from "@/lib/slash-command/types";

const QUICK_REPLY_STORAGE_KEY = "dreamministage-quick-replies";

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

interface QuickReplyStoreState {
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
  updateQuickReply: (setName: string, target: QuickReplyLookup, options?: QuickReplyUpdateOptions) => QuickReplyRecord;
  deleteQuickReply: (setName: string, target: QuickReplyLookup) => void;
  addQuickReplyContextSet: (
    setName: string,
    target: QuickReplyLookup,
    contextSetName: string,
    options?: QuickReplyContextOptions,
  ) => QuickReplyRecord;
  removeQuickReplyContextSet: (setName: string, target: QuickReplyLookup, contextSetName: string) => QuickReplyRecord;
  clearQuickReplyContextSets: (setName: string, target: QuickReplyLookup) => QuickReplyRecord;
  activateContextSets: (dialogueId: string, reply: QuickReplyRecord) => void;
  reset: () => void;
}

const emptyStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeName(name: string, label: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

function cloneReply(reply: QuickReplyRecord): QuickReplyRecord {
  return {
    ...reply,
    contextSets: reply.contextSets.map((entry) => ({ ...entry })),
  };
}

function cloneSet(set: QuickReplySetRecord): QuickReplySetRecord {
  return {
    ...set,
    replies: set.replies.map(cloneReply),
  };
}

function ensureDialogueId(dialogueId: string | undefined): string {
  const normalized = dialogueId?.trim();
  if (!normalized) {
    throw new Error("Quick Reply chat scope requires dialogueId");
  }
  return normalized;
}

function findReplyIndex(set: QuickReplySetRecord, target: QuickReplyLookup): number {
  if (typeof target.id === "number") {
    return set.replies.findIndex((reply) => reply.id === target.id);
  }

  const label = normalizeName(target.label || "", "quick reply label");
  return set.replies.findIndex((reply) => reply.label === label);
}

function ensureSet(state: QuickReplyStoreState, name: string): QuickReplySetRecord {
  const normalized = normalizeName(name, "quick reply set name");
  const set = state.sets[normalized];
  if (!set) {
    throw new Error(`Quick Reply set not found: ${normalized}`);
  }
  return set;
}

function ensureReply(set: QuickReplySetRecord, target: QuickReplyLookup): QuickReplyRecord {
  const index = findReplyIndex(set, target);
  if (index < 0) {
    throw new Error(`Quick Reply not found in set ${set.name}`);
  }
  return set.replies[index];
}

function ensureUniqueLabel(set: QuickReplySetRecord, label: string, ignoreId?: number): void {
  const exists = set.replies.some((reply) => reply.label === label && reply.id !== ignoreId);
  if (exists) {
    throw new Error(`Quick Reply label already exists in set ${set.name}: ${label}`);
  }
}

function normalizeVisibility(options?: QuickReplySetVisibilityOptions): boolean {
  return options?.visible ?? true;
}

function normalizeCreateOptions(options?: QuickReplyCreateOptions): QuickReplyCreateOptions {
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

function normalizeSetOptions(options?: QuickReplySetOptions): QuickReplySetOptions {
  return {
    nosend: options?.nosend ?? false,
    before: options?.before ?? false,
    inject: options?.inject ?? false,
  };
}

function upsertActiveSet(
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

function removeActiveSet(
  entries: Array<{ name: string; visible: boolean }>,
  name: string,
): Array<{ name: string; visible: boolean }> {
  return entries.filter((entry) => entry.name !== name);
}

const initialState = {
  nextReplyId: 1,
  sets: {},
  globalSets: [],
  chatSets: {},
};

export const useQuickReplyStore = create<QuickReplyStoreState>()(
  persist((set, get) => ({
    ...initialState,

    getQuickReplySet: (name) => {
      const quickReplySet = get().sets[normalizeName(name, "quick reply set name")];
      return quickReplySet ? cloneSet(quickReplySet) : undefined;
    },

    getAllQuickReplySets: () => {
      return Object.values(get().sets)
        .map(cloneSet)
        .sort((left, right) => left.name.localeCompare(right.name));
    },

    listQuickReplySets: (scope = "all", dialogueId) => {
      const state = get();
      const globalSets = scope === "all" || scope === "global"
        ? state.globalSets.map((entry) => ({ ...entry, scope: "global" as const }))
        : [];
      const chatEntries = scope === "all" || scope === "chat"
        ? (state.chatSets[dialogueId || ""] || []).map((entry) => ({ ...entry, scope: "chat" as const }))
        : [];
      return [...globalSets, ...chatEntries];
    },

    listQuickReplies: (setName) => {
      return ensureSet(get(), setName).replies.map(cloneReply);
    },

    getVisibleQuickReplies: (dialogueId) => {
      return get()
        .listQuickReplySets("all", dialogueId)
        .filter((entry) => entry.visible)
        .flatMap((entry) => {
          const quickReplySet = ensureSet(get(), entry.name);
          return quickReplySet.replies
            .filter((reply) => !reply.hidden)
            .map((reply) => ({
              scope: entry.scope,
              set: cloneSet(quickReplySet),
              reply: cloneReply(reply),
            }));
        });
    },

    resolveVisibleQuickReply: (dialogueId, index) => {
      const visible = get().getVisibleQuickReplies(dialogueId);
      const entry = visible[index];
      if (!entry) {
        throw new Error(`Quick Reply visible index out of range: ${index}`);
      }
      return entry;
    },

    createQuickReplySet: (name, options) => {
      const setName = normalizeName(name, "quick reply set name");
      if (get().sets[setName]) {
        throw new Error(`Quick Reply set already exists: ${setName}`);
      }

      const normalized = normalizeSetOptions(options);
      const createdAt = nowIso();
      const quickReplySet: QuickReplySetRecord = {
        name: setName,
        nosend: normalized.nosend ?? false,
        before: normalized.before ?? false,
        inject: normalized.inject ?? false,
        replies: [],
        createdAt,
        updatedAt: createdAt,
      };

      set((state) => ({
        sets: { ...state.sets, [setName]: quickReplySet },
      }));

      return cloneSet(quickReplySet);
    },

    updateQuickReplySet: (name, options) => {
      const setName = normalizeName(name, "quick reply set name");
      const existing = ensureSet(get(), setName);
      const nextOptions = normalizeSetOptions({
        nosend: options?.nosend ?? existing.nosend,
        before: options?.before ?? existing.before,
        inject: options?.inject ?? existing.inject,
      });
      const nextSet: QuickReplySetRecord = {
        ...existing,
        nosend: nextOptions.nosend ?? existing.nosend,
        before: nextOptions.before ?? existing.before,
        inject: nextOptions.inject ?? existing.inject,
        updatedAt: nowIso(),
      };

      set((state) => ({
        sets: { ...state.sets, [setName]: nextSet },
      }));

      return cloneSet(nextSet);
    },

    deleteQuickReplySet: (name) => {
      const setName = normalizeName(name, "quick reply set name");
      ensureSet(get(), setName);

      set((state) => {
        const { [setName]: removed, ...restSets } = state.sets;
        const nextChatSets = Object.fromEntries(
          Object.entries(state.chatSets)
            .map(([dialogueId, entries]) => [dialogueId, removeActiveSet(entries, setName)])
            .filter(([, entries]) => entries.length > 0),
        );
        const cleanedSets = Object.fromEntries(
          Object.entries(restSets).map(([currentName, setRecord]) => [
            currentName,
            {
              ...setRecord,
              replies: setRecord.replies.map((reply) => ({
                ...reply,
                contextSets: reply.contextSets.filter((entry) => entry.name !== setName),
              })),
            },
          ]),
        );

        return {
          sets: cleanedSets,
          globalSets: removeActiveSet(state.globalSets, setName),
          chatSets: nextChatSets,
        };
      });
    },

    toggleGlobalQuickReplySet: (name, options) => {
      const setName = normalizeName(name, "quick reply set name");
      ensureSet(get(), setName);
      const current = get().globalSets.some((entry) => entry.name === setName);
      if (current) {
        get().removeGlobalQuickReplySet(setName);
        return;
      }
      get().addGlobalQuickReplySet(setName, options);
    },

    addGlobalQuickReplySet: (name, options) => {
      const setName = normalizeName(name, "quick reply set name");
      ensureSet(get(), setName);
      const visible = normalizeVisibility(options);
      set((state) => ({
        globalSets: upsertActiveSet(state.globalSets, setName, visible),
      }));
    },

    removeGlobalQuickReplySet: (name) => {
      const setName = normalizeName(name, "quick reply set name");
      set((state) => ({
        globalSets: removeActiveSet(state.globalSets, setName),
      }));
    },

    toggleChatQuickReplySet: (dialogueId, name, options) => {
      const resolvedDialogueId = ensureDialogueId(dialogueId);
      const setName = normalizeName(name, "quick reply set name");
      ensureSet(get(), setName);
      const current = (get().chatSets[resolvedDialogueId] || []).some((entry) => entry.name === setName);
      if (current) {
        get().removeChatQuickReplySet(resolvedDialogueId, setName);
        return;
      }
      get().addChatQuickReplySet(resolvedDialogueId, setName, options);
    },

    addChatQuickReplySet: (dialogueId, name, options) => {
      const resolvedDialogueId = ensureDialogueId(dialogueId);
      const setName = normalizeName(name, "quick reply set name");
      ensureSet(get(), setName);
      const visible = normalizeVisibility(options);
      set((state) => ({
        chatSets: {
          ...state.chatSets,
          [resolvedDialogueId]: upsertActiveSet(state.chatSets[resolvedDialogueId] || [], setName, visible),
        },
      }));
    },

    removeChatQuickReplySet: (dialogueId, name) => {
      const resolvedDialogueId = ensureDialogueId(dialogueId);
      const setName = normalizeName(name, "quick reply set name");
      set((state) => {
        const nextEntries = removeActiveSet(state.chatSets[resolvedDialogueId] || [], setName);
        const nextChatSets = { ...state.chatSets };
        if (nextEntries.length > 0) {
          nextChatSets[resolvedDialogueId] = nextEntries;
        } else {
          delete nextChatSets[resolvedDialogueId];
        }
        return { chatSets: nextChatSets };
      });
    },

    createQuickReply: (setName, label, message, options) => {
      const normalizedSetName = normalizeName(setName, "quick reply set name");
      const normalizedLabel = normalizeName(label, "quick reply label");
      const normalizedMessage = normalizeName(message, "quick reply message");
      const existing = ensureSet(get(), normalizedSetName);
      ensureUniqueLabel(existing, normalizedLabel);
      const nextId = get().nextReplyId;
      const createdAt = nowIso();
      const normalizedOptions = normalizeCreateOptions(options);
      const quickReply: QuickReplyRecord = {
        id: nextId,
        label: normalizedLabel,
        message: normalizedMessage,
        icon: normalizedOptions.icon,
        showLabel: normalizedOptions.showLabel ?? true,
        title: normalizedOptions.title,
        hidden: normalizedOptions.hidden ?? false,
        startup: normalizedOptions.startup ?? false,
        user: normalizedOptions.user ?? false,
        bot: normalizedOptions.bot ?? false,
        load: normalizedOptions.load ?? false,
        new: normalizedOptions.new ?? false,
        group: normalizedOptions.group ?? false,
        generation: normalizedOptions.generation ?? false,
        automationId: normalizedOptions.automationId,
        contextSets: [],
        createdAt,
        updatedAt: createdAt,
      };

      const nextSet: QuickReplySetRecord = {
        ...existing,
        replies: [...existing.replies, quickReply],
        updatedAt: createdAt,
      };

      set((state) => ({
        nextReplyId: state.nextReplyId + 1,
        sets: { ...state.sets, [normalizedSetName]: nextSet },
      }));

      return cloneReply(quickReply);
    },

    getQuickReply: (setName, target) => {
      const quickReplySet = ensureSet(get(), setName);
      const index = findReplyIndex(quickReplySet, target);
      return index >= 0 ? cloneReply(quickReplySet.replies[index]) : undefined;
    },

    updateQuickReply: (setName, target, options) => {
      const quickReplySet = ensureSet(get(), setName);
      const current = ensureReply(quickReplySet, target);
      const nextLabel = options?.newLabel ? normalizeName(options.newLabel, "quick reply label") : current.label;
      ensureUniqueLabel(quickReplySet, nextLabel, current.id);
      const nextMessage = options?.message ? normalizeName(options.message, "quick reply message") : current.message;
      const nextOptions = normalizeCreateOptions({
        icon: options?.icon ?? current.icon,
        showLabel: options?.showLabel ?? current.showLabel,
        title: options?.title ?? current.title,
        hidden: options?.hidden ?? current.hidden,
        startup: options?.startup ?? current.startup,
        user: options?.user ?? current.user,
        bot: options?.bot ?? current.bot,
        load: options?.load ?? current.load,
        new: options?.new ?? current.new,
        group: options?.group ?? current.group,
        generation: options?.generation ?? current.generation,
        automationId: options?.automationId ?? current.automationId,
      });
      const updated: QuickReplyRecord = {
        ...current,
        label: nextLabel,
        message: nextMessage,
        icon: nextOptions.icon,
        showLabel: nextOptions.showLabel ?? current.showLabel,
        title: nextOptions.title,
        hidden: nextOptions.hidden ?? current.hidden,
        startup: nextOptions.startup ?? current.startup,
        user: nextOptions.user ?? current.user,
        bot: nextOptions.bot ?? current.bot,
        load: nextOptions.load ?? current.load,
        new: nextOptions.new ?? current.new,
        group: nextOptions.group ?? current.group,
        generation: nextOptions.generation ?? current.generation,
        automationId: nextOptions.automationId,
        updatedAt: nowIso(),
      };
      const nextSet: QuickReplySetRecord = {
        ...quickReplySet,
        replies: quickReplySet.replies.map((reply) => reply.id === current.id ? updated : reply),
        updatedAt: updated.updatedAt,
      };

      set((state) => ({
        sets: { ...state.sets, [quickReplySet.name]: nextSet },
      }));

      return cloneReply(updated);
    },

    deleteQuickReply: (setName, target) => {
      const quickReplySet = ensureSet(get(), setName);
      const current = ensureReply(quickReplySet, target);
      const nextSet: QuickReplySetRecord = {
        ...quickReplySet,
        replies: quickReplySet.replies.filter((reply) => reply.id !== current.id),
        updatedAt: nowIso(),
      };

      set((state) => ({
        sets: { ...state.sets, [quickReplySet.name]: nextSet },
      }));
    },

    addQuickReplyContextSet: (setName, target, contextSetName, options) => {
      const quickReplySet = ensureSet(get(), setName);
      ensureSet(get(), contextSetName);
      const current = ensureReply(quickReplySet, target);
      const bindingName = normalizeName(contextSetName, "context quick reply set name");
      const nextBindings = current.contextSets.filter((entry) => entry.name !== bindingName);
      nextBindings.push({ name: bindingName, chain: options?.chain ?? false });
      const updated: QuickReplyRecord = {
        ...current,
        contextSets: nextBindings,
        updatedAt: nowIso(),
      };
      const nextSet: QuickReplySetRecord = {
        ...quickReplySet,
        replies: quickReplySet.replies.map((reply) => reply.id === current.id ? updated : reply),
        updatedAt: updated.updatedAt,
      };
      set((state) => ({
        sets: { ...state.sets, [quickReplySet.name]: nextSet },
      }));
      return cloneReply(updated);
    },

    removeQuickReplyContextSet: (setName, target, contextSetName) => {
      const quickReplySet = ensureSet(get(), setName);
      const current = ensureReply(quickReplySet, target);
      const bindingName = normalizeName(contextSetName, "context quick reply set name");
      const updated: QuickReplyRecord = {
        ...current,
        contextSets: current.contextSets.filter((entry) => entry.name !== bindingName),
        updatedAt: nowIso(),
      };
      const nextSet: QuickReplySetRecord = {
        ...quickReplySet,
        replies: quickReplySet.replies.map((reply) => reply.id === current.id ? updated : reply),
        updatedAt: updated.updatedAt,
      };
      set((state) => ({
        sets: { ...state.sets, [quickReplySet.name]: nextSet },
      }));
      return cloneReply(updated);
    },

    clearQuickReplyContextSets: (setName, target) => {
      const quickReplySet = ensureSet(get(), setName);
      const current = ensureReply(quickReplySet, target);
      const updated: QuickReplyRecord = {
        ...current,
        contextSets: [],
        updatedAt: nowIso(),
      };
      const nextSet: QuickReplySetRecord = {
        ...quickReplySet,
        replies: quickReplySet.replies.map((reply) => reply.id === current.id ? updated : reply),
        updatedAt: updated.updatedAt,
      };
      set((state) => ({
        sets: { ...state.sets, [quickReplySet.name]: nextSet },
      }));
      return cloneReply(updated);
    },

    activateContextSets: (dialogueId, reply) => {
      const resolvedDialogueId = ensureDialogueId(dialogueId);
      for (const entry of reply.contextSets) {
        get().addChatQuickReplySet(resolvedDialogueId, entry.name, { visible: true });
      }
    },

    reset: () => set(initialState),
  }), {
    name: QUICK_REPLY_STORAGE_KEY,
    storage: createJSONStorage(() => typeof window !== "undefined" ? window.localStorage : emptyStorage),
    partialize: (state) => ({
      nextReplyId: state.nextReplyId,
      sets: state.sets,
      globalSets: state.globalSets,
      chatSets: state.chatSets,
    }),
  }),
);

export function resetQuickReplyStore(): void {
  useQuickReplyStore.getState().reset();
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(QUICK_REPLY_STORAGE_KEY);
  }
}
