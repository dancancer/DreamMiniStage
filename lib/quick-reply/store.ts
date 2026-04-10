import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  emptyStorage,
  nowIso,
  normalizeName,
  cloneReply,
  cloneSet,
  ensureDialogueId,
  findReplyIndex,
  ensureSet,
  ensureReply,
  ensureUniqueLabel,
  normalizeVisibility,
  normalizeCreateOptions,
  normalizeSetOptions,
  upsertActiveSet,
  removeActiveSet,
  resolveActiveQuickReplySets,
  initialState,
  buildNewReply,
  buildUpdatedReply,
  replaceReplyInSet,
} from "./store-helpers";

import type {
  QuickReplyRecord,
  QuickReplySetRecord,
  ActiveQuickReplySetEntry,
  VisibleQuickReplyEntry,
  QuickReplyStoreState,
} from "./store-helpers";

// ============================================================================
//                              重导出类型
// ============================================================================

export type {
  QuickReplyRecord,
  QuickReplySetRecord,
  ActiveQuickReplySetEntry,
  VisibleQuickReplyEntry,
};

const QUICK_REPLY_STORAGE_KEY = "dreamministage-quick-replies";

// ============================================================================
//                              Zustand Store
// ============================================================================

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
      if (scope === "all") {
        return resolveActiveQuickReplySets(state, dialogueId);
      }

      const globalSets = scope === "global"
        ? state.globalSets.map((entry) => ({ ...entry, scope: "global" as const }))
        : [];
      const chatEntries = scope === "chat"
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
      const quickReply = buildNewReply(get().nextReplyId, normalizedLabel, normalizedMessage, options);
      const nextSet: QuickReplySetRecord = {
        ...existing,
        replies: [...existing.replies, quickReply],
        updatedAt: quickReply.createdAt,
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
      const updated = buildUpdatedReply(current, nextLabel, nextMessage, {
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
      const nextSet = replaceReplyInSet(quickReplySet, current.id, updated);

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
      const updated: QuickReplyRecord = { ...current, contextSets: nextBindings, updatedAt: nowIso() };
      const nextSet = replaceReplyInSet(quickReplySet, current.id, updated);
      set((state) => ({ sets: { ...state.sets, [quickReplySet.name]: nextSet } }));
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
      const nextSet = replaceReplyInSet(quickReplySet, current.id, updated);
      set((state) => ({ sets: { ...state.sets, [quickReplySet.name]: nextSet } }));
      return cloneReply(updated);
    },

    clearQuickReplyContextSets: (setName, target) => {
      const quickReplySet = ensureSet(get(), setName);
      const current = ensureReply(quickReplySet, target);
      const updated: QuickReplyRecord = { ...current, contextSets: [], updatedAt: nowIso() };
      const nextSet = replaceReplyInSet(quickReplySet, current.id, updated);
      set((state) => ({ sets: { ...state.sets, [quickReplySet.name]: nextSet } }));
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
