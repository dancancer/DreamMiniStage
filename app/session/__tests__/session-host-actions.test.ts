import { describe, expect, it, vi } from "vitest";

describe("session-host-actions", () => {
  it("lists gallery assets and selects proxy presets through injected deps", async () => {
    const { createSessionHostActions } = await import("../session-host-actions");

    const actions = createSessionHostActions({
      currentCharacter: {
        id: "char-1",
        name: "Alice",
        avatar_path: "/alice.png",
      },
      openingMessages: [{ id: "o1", content: "https://img.example/opening.png" }],
      messages: [{ id: "m1", role: "assistant", content: "https://img.example/scene.png" }],
      setGalleryState: vi.fn(),
      listSessionGalleryItems: vi.fn().mockReturnValue([
        { src: "/alice.png", ephemeral: false },
        { src: "https://img.example/opening.png", ephemeral: false },
      ]),
      hostCallbacks: {
        translateText: vi.fn(),
        getYouTubeTranscript: vi.fn(),
        getClipboardText: vi.fn(),
        setClipboardText: vi.fn(),
        isExtensionInstalled: vi.fn(),
        getExtensionEnabledState: vi.fn(),
        setExtensionEnabled: vi.fn(),
      },
      storeHostCallbacks: {
        getWorldInfoTimedEffect: vi.fn(),
        setWorldInfoTimedEffect: vi.fn(),
        getGroupMember: vi.fn(),
        getGroupMemberCount: vi.fn(),
        addGroupMember: vi.fn(),
        removeGroupMember: vi.fn(),
        moveGroupMember: vi.fn(),
        peekGroupMember: vi.fn(),
        setGroupMemberEnabled: vi.fn(),
        createCheckpoint: vi.fn(),
        createBranch: vi.fn(),
        getCheckpoint: vi.fn(),
        listCheckpoints: vi.fn(),
        goCheckpoint: vi.fn(),
        exitCheckpoint: vi.fn(),
        getCheckpointParent: vi.fn(),
      },
      getModelConfigs: vi.fn().mockReturnValue({
        configs: [{ id: "cfg-1", name: "Claude Reverse" }],
        activeConfigId: "cfg-1",
        setActiveConfig: vi.fn(),
      }),
      syncModelConfigToStorage: vi.fn(),
    });

    await expect(actions.handleListGallery()).resolves.toEqual([
      "/alice.png",
      "https://img.example/opening.png",
    ]);
    await expect(actions.handleSelectProxyPreset("Claude Reverse")).resolves.toBe("Claude Reverse");
  });
});
