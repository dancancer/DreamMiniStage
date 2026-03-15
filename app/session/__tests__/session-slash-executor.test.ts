import { describe, expect, it, vi } from "vitest";
import { createHostDebugState } from "@/hooks/script-bridge/host-debug-state";
import type { DialogueMessage } from "@/types/character-dialogue";

function buildDialogue(overrides: Partial<{
  messages: DialogueMessage[];
  addUserMessage: ReturnType<typeof vi.fn>;
  triggerGeneration: ReturnType<typeof vi.fn>;
  addRoleMessage: ReturnType<typeof vi.fn>;
  handleSwipe: ReturnType<typeof vi.fn>;
  setMessages: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    messages: overrides.messages || [
      { id: "m0", role: "assistant", content: "hello" },
    ],
    addUserMessage: overrides.addUserMessage || vi.fn().mockResolvedValue(undefined),
    triggerGeneration: overrides.triggerGeneration || vi.fn().mockResolvedValue(undefined),
    addRoleMessage: overrides.addRoleMessage || vi.fn().mockResolvedValue(undefined),
    handleSwipe: overrides.handleSwipe || vi.fn().mockResolvedValue(undefined),
    setMessages: overrides.setMessages || vi.fn(),
  };
}

describe("session-slash-executor", () => {
  it("routes nosend quick replies into input state without sending a message", async () => {
    const { createSessionSlashExecutor } = await import("../session-slash-executor");

    const setUserInput = vi.fn();
    const dialogue = buildDialogue();
    const hostDebugState = createHostDebugState();

    const executor = createSessionSlashExecutor({
      characterId: "char-1",
      sessionId: "session-1",
      currentSessionName: "Session One",
      dialogue,
      promptCallbacks: {},
      quickReplyStore: {
        resolveVisibleQuickReply: () => ({
          set: { nosend: true, inject: false, before: false },
          reply: { message: "prefilled text" },
        }),
        activateContextSets: vi.fn(),
      },
      variables: {
        global: {},
        character: {},
      },
      setUserInput,
      setScriptVariable: vi.fn(),
      deleteScriptVariable: vi.fn(),
      hostDebugState,
      syncHostDebug: vi.fn(),
      resolveHostCapabilitySources: () => ({}),
      callbacks: {
        renameCurrentChat: async () => "Session One",
      },
    });

    await expect(executor.executeQuickReplyByIndex(0)).resolves.toBe("prefilled text");
    expect(setUserInput).toHaveBeenCalledWith("prefilled text");
    expect(dialogue.addUserMessage).not.toHaveBeenCalled();
  });

  it("runs slash scripts through a reusable execution context", async () => {
    const { createSessionSlashExecutor } = await import("../session-slash-executor");

    const dialogue = buildDialogue();
    const hostDebugState = createHostDebugState();
    const executor = createSessionSlashExecutor({
      characterId: "char-1",
      sessionId: "session-1",
      currentSessionName: "Session One",
      dialogue,
      promptCallbacks: {},
      quickReplyStore: {
        resolveVisibleQuickReply: vi.fn(),
        activateContextSets: vi.fn(),
      },
      variables: {
        global: {},
        character: {},
      },
      setUserInput: vi.fn(),
      setScriptVariable: vi.fn(),
      deleteScriptVariable: vi.fn(),
      hostDebugState,
      syncHostDebug: vi.fn(),
      resolveHostCapabilitySources: () => ({}),
      callbacks: {
        renameCurrentChat: async () => "Session One",
        listGallery: async () => ["/alice.png"],
      },
    });

    await expect(executor.executeSessionSlashInput("/list-gallery")).resolves.toBe("[\"/alice.png\"]");
    expect(hostDebugState.getRecentApiCalls()).toEqual([
      expect.objectContaining({
        method: "triggerSlash",
        capability: "gallery-browser",
        resolvedPath: "session-default",
        outcome: "supported",
      }),
    ]);
  });

  it("supports bridge-only popup defaults and records them in host-debug", async () => {
    const { createSessionSlashExecutor } = await import("../session-slash-executor");

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const dialogue = buildDialogue();
    const hostDebugState = createHostDebugState();
    const executor = createSessionSlashExecutor({
      characterId: "char-1",
      sessionId: "session-1",
      currentSessionName: "Session One",
      dialogue,
      promptCallbacks: {},
      quickReplyStore: {
        resolveVisibleQuickReply: vi.fn(),
        activateContextSets: vi.fn(),
      },
      variables: {
        global: {},
        character: {},
      },
      setUserInput: vi.fn(),
      setScriptVariable: vi.fn(),
      deleteScriptVariable: vi.fn(),
      hostDebugState,
      syncHostDebug: vi.fn(),
      resolveHostCapabilitySources: () => ({}),
      callbacks: {
        renameCurrentChat: async () => "Session One",
      },
    });

    await expect(executor.executeSessionSlashInput("/popup result=true hello world")).resolves.toBe("1");
    expect(confirmSpy).toHaveBeenCalled();
    expect(hostDebugState.getRecentApiCalls()).toEqual([
      expect.objectContaining({
        capability: "popup-interaction",
        resolvedPath: "bridge-only",
        outcome: "supported",
      }),
    ]);

    confirmSpy.mockRestore();
  });

  it("supports shared layout and theme defaults in page slash execution", async () => {
    const { createSessionSlashExecutor } = await import("../session-slash-executor");

    const dialogue = buildDialogue();
    const hostDebugState = createHostDebugState();
    const executor = createSessionSlashExecutor({
      characterId: "char-1",
      sessionId: "session-1",
      currentSessionName: "Session One",
      dialogue,
      promptCallbacks: {},
      quickReplyStore: {
        resolveVisibleQuickReply: vi.fn(),
        activateContextSets: vi.fn(),
      },
      variables: {
        global: {},
        character: {},
      },
      setUserInput: vi.fn(),
      setScriptVariable: vi.fn(),
      deleteScriptVariable: vi.fn(),
      hostDebugState,
      syncHostDebug: vi.fn(),
      resolveHostCapabilitySources: () => ({}),
      callbacks: {
        renameCurrentChat: async () => "Session One",
      },
    });

    await expect(executor.executeSessionSlashInput("/theme light")).resolves.toBe("light");
    await expect(executor.executeSessionSlashInput("/css-var varname=--session-test vivid")).resolves.toBe("");
    await expect(executor.executeSessionSlashInput("/panels")).resolves.toBe("");
    await expect(executor.executeSessionSlashInput("/resetpanels")).resolves.toBe("");
    await expect(executor.executeSessionSlashInput("/vn")).resolves.toBe("");

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.style.getPropertyValue("--session-test")).toBe("vivid");
    expect(document.body.dataset.panelsCollapsed).toBeUndefined();
    expect(document.body.dataset.vnMode).toBe("true");
  });

  it("supports shared background defaults in page slash execution", async () => {
    const { createSessionSlashExecutor } = await import("../session-slash-executor");

    const dialogue = buildDialogue();
    const hostDebugState = createHostDebugState();
    const executor = createSessionSlashExecutor({
      characterId: "char-1",
      sessionId: "session-1",
      currentSessionName: "Session One",
      dialogue,
      promptCallbacks: {},
      quickReplyStore: {
        resolveVisibleQuickReply: vi.fn(),
        activateContextSets: vi.fn(),
      },
      variables: {
        global: {},
        character: {},
      },
      setUserInput: vi.fn(),
      setScriptVariable: vi.fn(),
      deleteScriptVariable: vi.fn(),
      hostDebugState,
      syncHostDebug: vi.fn(),
      resolveHostCapabilitySources: () => ({}),
      callbacks: {
        renameCurrentChat: async () => "Session One",
      },
    });

    document.body.dataset.backgroundAuto = "sunset";

    await expect(executor.executeSessionSlashInput("/bg forest")).resolves.toBe("forest");
    await expect(executor.executeSessionSlashInput("/lockbg")).resolves.toBe("");
    await expect(executor.executeSessionSlashInput("/autobg")).resolves.toBe("");
    expect(document.body.dataset.background).toBe("forest");

    await expect(executor.executeSessionSlashInput("/unlockbg")).resolves.toBe("");
    await expect(executor.executeSessionSlashInput("/autobg")).resolves.toBe("");
    expect(document.body.dataset.background).toBe("sunset");
    expect(document.body.dataset.backgroundLocked).toBeUndefined();
  });
});
