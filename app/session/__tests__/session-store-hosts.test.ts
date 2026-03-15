import { describe, expect, it, vi } from "vitest";

describe("session-store-hosts", () => {
  it("delegates checkpoint, group, and timed-effect callbacks through injected store deps", async () => {
    const { createSessionStoreHostCallbacks } = await import("../session-store-hosts");

    const deps = {
      createCheckpoint: vi.fn().mockReturnValue("cp-1"),
      createBranch: vi.fn().mockReturnValue("branch-1"),
      getCheckpoint: vi.fn().mockReturnValue("cp-1"),
      listCheckpoints: vi.fn().mockReturnValue(["cp-1"]),
      goCheckpoint: vi.fn().mockReturnValue("cp-1"),
      exitCheckpoint: vi.fn().mockReturnValue("root"),
      getCheckpointParent: vi.fn().mockReturnValue("parent-1"),
      getWorldInfoTimedEffect: vi.fn().mockResolvedValue(true),
      setWorldInfoTimedEffect: vi.fn().mockResolvedValue(undefined),
      getGroupMember: vi.fn().mockReturnValue("Alice"),
      getGroupMemberCount: vi.fn().mockReturnValue(2),
      addGroupMember: vi.fn().mockReturnValue("Bob"),
      removeGroupMember: vi.fn().mockReturnValue("Bob"),
      moveGroupMember: vi.fn().mockReturnValue(1),
      peekGroupMember: vi.fn().mockReturnValue("Alice"),
      setGroupMemberEnabled: vi.fn().mockReturnValue("Alice"),
    };

    const hosts = createSessionStoreHostCallbacks({
      sessionId: "session-1",
      dialogueMessages: [{ id: "m1", role: "assistant", content: "hello" }],
      deps,
    });

    expect(await hosts.createCheckpoint("m1", "story")).toBe("cp-1");
    expect(await hosts.createBranch("m1")).toBe("branch-1");
    expect(await hosts.getCheckpoint("m1")).toBe("cp-1");
    expect(await hosts.listCheckpoints({ links: true })).toEqual(["cp-1"]);
    expect(await hosts.goCheckpoint("m1")).toBe("cp-1");
    expect(await hosts.exitCheckpoint()).toBe("root");
    expect(await hosts.getCheckpointParent()).toBe("parent-1");
    expect(await hosts.getWorldInfoTimedEffect("book", "uid", "sticky", { format: "boolean" })).toBe(true);
    await hosts.setWorldInfoTimedEffect("book", "uid", "sticky", "on");
    expect(await hosts.getGroupMember("Alice", "name")).toBe("Alice");
    expect(await hosts.getGroupMemberCount()).toBe(2);
    expect(await hosts.addGroupMember("Bob")).toBe("Bob");
    expect(await hosts.removeGroupMember("Bob")).toBe("Bob");
    expect(await hosts.moveGroupMember("Bob", "up")).toBe(1);
    expect(await hosts.peekGroupMember("Alice")).toBe("Alice");
    expect(await hosts.setGroupMemberEnabled("Alice", false)).toBe("Alice");
  });

  it("fails fast when session-scoped store hosts are called without an active session", async () => {
    const { createSessionStoreHostCallbacks } = await import("../session-store-hosts");

    const hosts = createSessionStoreHostCallbacks({
      sessionId: null,
      dialogueMessages: [],
      deps: {
        createCheckpoint: vi.fn(),
        createBranch: vi.fn(),
        getCheckpoint: vi.fn(),
        listCheckpoints: vi.fn(),
        goCheckpoint: vi.fn(),
        exitCheckpoint: vi.fn(),
        getCheckpointParent: vi.fn(),
        getWorldInfoTimedEffect: vi.fn(),
        setWorldInfoTimedEffect: vi.fn(),
        getGroupMember: vi.fn(),
        getGroupMemberCount: vi.fn(),
        addGroupMember: vi.fn(),
        removeGroupMember: vi.fn(),
        moveGroupMember: vi.fn(),
        peekGroupMember: vi.fn(),
        setGroupMemberEnabled: vi.fn(),
      },
    });

    await expect(hosts.createCheckpoint("m1")).rejects.toThrow("/checkpoint-create");
    await expect(hosts.getGroupMember("Alice", "name")).rejects.toThrow("/getmember");
    await expect(hosts.setWorldInfoTimedEffect("book", "uid", "sticky", "on")).rejects.toThrow("/wi-set-timed-effect");
  });
});
