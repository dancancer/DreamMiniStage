/**
 * @input  lib/quick-reply/store, lib/slash-command/types
 * @output createSessionQuickReplyExecutorStore
 * @pos    /session Quick Reply slash 适配
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    Session Quick Reply Store                             ║
 * ║                                                                           ║
 * ║  把 Zustand Quick Reply store 适配为 slash 执行器所需接口。                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { useQuickReplyStore } from "@/lib/quick-reply/store";
import type {
  QuickReplyContextOptions,
  QuickReplyCreateOptions,
  QuickReplyLookup,
  QuickReplySetOptions,
  QuickReplySetScope,
  QuickReplySetVisibilityOptions,
  QuickReplyUpdateOptions,
} from "@/lib/slash-command/types";

export function createSessionQuickReplyExecutorStore(sessionId: string | null) {
  const store = useQuickReplyStore.getState();

  return {
    resolveVisibleQuickReply: store.resolveVisibleQuickReply,
    activateContextSets: store.activateContextSets,
    toggleGlobalQuickReplySet: store.toggleGlobalQuickReplySet,
    addGlobalQuickReplySet: store.addGlobalQuickReplySet,
    removeGlobalQuickReplySet: store.removeGlobalQuickReplySet,
    toggleChatQuickReplySet: async (name: string, options?: QuickReplySetVisibilityOptions) =>
      store.toggleChatQuickReplySet(sessionId || "", name, options),
    addChatQuickReplySet: async (name: string, options?: QuickReplySetVisibilityOptions) =>
      store.addChatQuickReplySet(sessionId || "", name, options),
    removeChatQuickReplySet: async (name: string) =>
      store.removeChatQuickReplySet(sessionId || "", name),
    listQuickReplySets: async (scope?: QuickReplySetScope) =>
      store.listQuickReplySets(scope, sessionId || undefined),
    listQuickReplies: async (setName: string) => store.listQuickReplies(setName),
    getQuickReply: async (setName: string, target: QuickReplyLookup) => store.getQuickReply(setName, target),
    createQuickReply: async (setName: string, label: string, message: string, options?: QuickReplyCreateOptions) =>
      void store.createQuickReply(setName, label, message, options),
    updateQuickReply: async (setName: string, target: QuickReplyLookup, options?: QuickReplyUpdateOptions) =>
      void store.updateQuickReply(setName, target, options),
    deleteQuickReply: async (setName: string, target: QuickReplyLookup) =>
      void store.deleteQuickReply(setName, target),
    addQuickReplyContextSet: async (setName: string, target: QuickReplyLookup, contextSetName: string, options?: QuickReplyContextOptions) =>
      void store.addQuickReplyContextSet(setName, target, contextSetName, options),
    removeQuickReplyContextSet: async (setName: string, target: QuickReplyLookup, contextSetName: string) =>
      void store.removeQuickReplyContextSet(setName, target, contextSetName),
    clearQuickReplyContextSets: async (setName: string, target: QuickReplyLookup) =>
      void store.clearQuickReplyContextSets(setName, target),
    createQuickReplySet: async (name: string, options?: QuickReplySetOptions) =>
      void store.createQuickReplySet(name, options),
    updateQuickReplySet: async (name: string, options?: QuickReplySetOptions) =>
      void store.updateQuickReplySet(name, options),
    deleteQuickReplySet: async (name: string) =>
      void store.deleteQuickReplySet(name, sessionId || undefined),
  };
}
