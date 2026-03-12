import { beforeEach, describe, expect, it } from "vitest";

import {
  resetQuickReplyStore,
  useQuickReplyStore,
} from "../store";

describe("quick reply store", () => {
  beforeEach(() => {
    resetQuickReplyStore();
  });

  it("merges global/chat active sets into visible quick replies and preserves set flags", () => {
    const store = useQuickReplyStore.getState();

    store.createQuickReplySet("Main", { nosend: false, before: true, inject: false });
    store.createQuickReplySet("Draft", { nosend: true, before: false, inject: false });
    store.createQuickReply("Main", "Hello", "hello world", { title: "Tip" });
    store.createQuickReply("Draft", "Outline", "draft only", { hidden: false });
    store.addGlobalQuickReplySet("Main", { visible: true });
    store.addChatQuickReplySet("dlg-1", "Draft", { visible: true });

    expect(store.listQuickReplySets("all", "dlg-1").map((set) => set.name)).toEqual(["Main", "Draft"]);
    expect(store.listQuickReplies("Main").map((reply) => reply.label)).toEqual(["Hello"]);
    expect(store.getVisibleQuickReplies("dlg-1").map((entry) => `${entry.scope}:${entry.reply.label}`)).toEqual([
      "global:Hello",
      "chat:Outline",
    ]);
    expect(store.getQuickReplySet("Draft")?.nosend).toBe(true);
  });

  it("deduplicates visible replies when the same set is active globally and in chat scope", () => {
    const store = useQuickReplyStore.getState();

    store.createQuickReplySet("Main", {});
    store.createQuickReply("Main", "Hello", "hello world", {});
    store.addGlobalQuickReplySet("Main", { visible: true });
    store.addChatQuickReplySet("dlg-1", "Main", { visible: true });

    expect(store.getVisibleQuickReplies("dlg-1").map((entry) => `${entry.scope}:${entry.reply.label}`)).toEqual([
      "chat:Hello",
    ]);
  });

  it("updates replies by label or id and manages context-set bindings", () => {
    const store = useQuickReplyStore.getState();

    store.createQuickReplySet("Main", {});
    store.createQuickReplySet("ContextSet", {});
    const created = store.createQuickReply("Main", "Hello", "hello world", { showLabel: true });

    store.updateQuickReply("Main", { label: "Hello" }, {
      newLabel: "Renamed",
      message: "updated message",
      hidden: true,
      automationId: "auto-1",
    });
    store.addQuickReplyContextSet("Main", { id: created.id }, "ContextSet", { chain: true });

    expect(store.getQuickReply("Main", { id: created.id })).toMatchObject({
      id: created.id,
      label: "Renamed",
      message: "updated message",
      hidden: true,
      automationId: "auto-1",
      contextSets: [{ name: "ContextSet", chain: true }],
    });

    store.removeQuickReplyContextSet("Main", { label: "Renamed" }, "ContextSet");
    expect(store.getQuickReply("Main", { id: created.id })?.contextSets).toEqual([]);
  });

  it("deleting a set cleans active attachments and dangling context bindings", () => {
    const store = useQuickReplyStore.getState();

    store.createQuickReplySet("Main", {});
    store.createQuickReplySet("ContextSet", {});
    const created = store.createQuickReply("Main", "Hello", "hello world", {});
    store.addQuickReplyContextSet("Main", { id: created.id }, "ContextSet", { chain: false });
    store.addGlobalQuickReplySet("Main", { visible: true });
    store.addChatQuickReplySet("dlg-1", "ContextSet", { visible: true });

    store.deleteQuickReplySet("ContextSet", "dlg-1");

    expect(store.listQuickReplySets("all", "dlg-1").map((set) => set.name)).toEqual(["Main"]);
    expect(store.getQuickReply("Main", { id: created.id })?.contextSets).toEqual([]);
  });
});
