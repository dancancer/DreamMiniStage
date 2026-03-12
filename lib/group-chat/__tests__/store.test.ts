import { beforeEach, describe, expect, it } from "vitest";

import {
  resetGroupChatStore,
  useGroupChatStore,
} from "../store";

describe("group chat store", () => {
  beforeEach(() => {
    resetGroupChatStore();
  });

  it("adds members per dialogue and exposes slash-facing fields", () => {
    const store = useGroupChatStore.getState();

    const alice = store.addGroupMember("dlg-1", "Alice");
    const bob = store.addGroupMember("dlg-1", "Bob");

    expect(alice).toBe("Alice");
    expect(bob).toBe("Bob");
    expect(store.getGroupMemberCount("dlg-1")).toBe(2);
    expect(store.getGroupMember("dlg-1", "Alice", "name")).toBe("Alice");
    expect(store.getGroupMember("dlg-1", "Bob", "index")).toBe(1);
    expect(typeof store.getGroupMember("dlg-1", "Bob", "id")).toBe("string");
    expect(store.listGroupMembers("dlg-1").map((member) => member.name)).toEqual(["Alice", "Bob"]);
  });

  it("toggles enabled state and reorders members without cross-dialogue bleed", () => {
    const store = useGroupChatStore.getState();

    store.addGroupMember("dlg-1", "Alice");
    store.addGroupMember("dlg-1", "Bob");
    store.addGroupMember("dlg-2", "Carol");

    store.setGroupMemberEnabled("dlg-1", "Bob", false);
    store.moveGroupMember("dlg-1", "Bob", "up");

    expect(store.listGroupMembers("dlg-1").map((member) => `${member.name}:${member.enabled}`)).toEqual([
      "Bob:false",
      "Alice:true",
    ]);
    expect(store.listGroupMembers("dlg-2").map((member) => member.name)).toEqual(["Carol"]);
  });

  it("removes and peeks members with fail-fast target resolution", () => {
    const store = useGroupChatStore.getState();

    store.addGroupMember("dlg-1", "Alice");
    store.addGroupMember("dlg-1", "Bob");

    expect(store.peekGroupMember("dlg-1", "Bob")).toBe("Bob");
    expect(store.removeGroupMember("dlg-1", "Alice")).toBe("Alice");
    expect(store.listGroupMembers("dlg-1").map((member) => member.name)).toEqual(["Bob"]);
    expect(() => store.removeGroupMember("dlg-1", "Missing")).toThrow("Group member not found");
  });
});
