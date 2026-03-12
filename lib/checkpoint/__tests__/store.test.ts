import { beforeEach, describe, expect, it } from "vitest";

import {
  resetCheckpointStore,
  useCheckpointStore,
} from "../store";

describe("checkpoint store", () => {
  beforeEach(() => {
    resetCheckpointStore();
  });

  it("creates checkpoints and lists them against current message order", () => {
    const store = useCheckpointStore.getState();
    const messages = [
      { id: "m-0" },
      { id: "m-1" },
      { id: "m-2" },
    ];

    const named = store.createCheckpoint("dlg-1", "m-1", "story-turn");
    const auto = store.createCheckpoint("dlg-1", "m-2");

    expect(named).toBe("story-turn");
    expect(auto).toBe("checkpoint-1");
    expect(store.getCheckpoint("dlg-1", "m-1")).toBe("story-turn");
    expect(store.listCheckpoints("dlg-1", messages, false)).toEqual([1, 2]);
    expect(store.listCheckpoints("dlg-1", messages, true)).toEqual(["story-turn", "checkpoint-1"]);
  });

  it("creates branches, tracks parent chat, and exits back to parent", () => {
    const store = useCheckpointStore.getState();

    const branch = store.createBranch("dlg-1", "m-2", "session-1");
    const go = store.goCheckpoint("dlg-1", "m-2", "session-1");
    const parent = store.getCheckpointParent("dlg-1");
    const exit = store.exitCheckpoint("dlg-1");

    expect(branch).toBe("branch-1");
    expect(go).toBe("branch-1");
    expect(parent).toBe("session-1");
    expect(exit).toBe("session-1");
    expect(store.getCurrentCheckpoint("dlg-1")).toBe("");
  });

  it("returns empty string when checkpoint target is not linked", () => {
    const store = useCheckpointStore.getState();

    expect(store.getCheckpoint("dlg-1", "m-0")).toBe("");
    expect(store.goCheckpoint("dlg-1", "m-0", "session-1")).toBe("");
    expect(store.exitCheckpoint("dlg-1")).toBe("");
  });
});
