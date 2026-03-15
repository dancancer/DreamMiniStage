import { describe, expect, it, vi } from "vitest";
import type { SessionSlashHostBridge } from "../session-host-bridge";

describe("session-host", () => {
  it("merges default and injected bridges into a single explainable host state", async () => {
    const { resolveSessionHostBridgeState } = await import("../session-host");

    const defaultBridge: SessionSlashHostBridge = {
      translateText: async () => "default translated",
      getYouTubeTranscript: async () => "default transcript",
      getClipboardText: async () => "default clipboard",
      setClipboardText: async () => undefined,
      isExtensionInstalled: async () => true,
      getExtensionEnabledState: async () => true,
    };
    const injectedBridge: SessionSlashHostBridge = {
      translateText: async () => "injected translated",
      getYouTubeTranscript: async () => "injected transcript",
      getClipboardText: async () => "injected clipboard",
      setClipboardText: async () => undefined,
      setExtensionEnabled: async () => "summarize",
    };

    const state = resolveSessionHostBridgeState(defaultBridge, injectedBridge);

    await expect(state.bridge.getClipboardText?.()).resolves.toBe("injected clipboard");
    expect(state.capabilitySources).toEqual({
      translation: "api-context",
      youtubeTranscript: "api-context",
      clipboardRead: "api-context",
      clipboardWrite: "api-context",
      extensionRead: "session-default",
      extensionWrite: "api-context",
    });
    expect(state.hasHostOverrides).toBe(true);
  });

  it("creates reusable session host callbacks for read/write commands", async () => {
    const { createSessionHostCallbacks } = await import("../session-host");

    const getClipboardText = vi.fn().mockResolvedValue("copied");
    const setClipboardText = vi.fn().mockResolvedValue(undefined);
    const isExtensionInstalled = vi.fn().mockResolvedValue(true);
    const getExtensionEnabledState = vi.fn().mockResolvedValue(false);
    const translateText = vi.fn().mockResolvedValue("translated");
    const getYouTubeTranscript = vi.fn().mockResolvedValue("transcript");

    const callbacks = createSessionHostCallbacks(() => ({
      bridge: {
        translateText,
        getYouTubeTranscript,
        getClipboardText,
        setClipboardText,
        isExtensionInstalled,
        getExtensionEnabledState,
      },
      capabilitySources: {
        translation: "session-default",
        youtubeTranscript: "session-default",
        clipboardRead: "session-default",
        clipboardWrite: "session-default",
        extensionRead: "session-default",
      },
      hasHostOverrides: false,
    }));

    await expect(callbacks.translateText("hello")).resolves.toBe("translated");
    await expect(callbacks.getYouTubeTranscript("https://youtu.be/demo")).resolves.toBe("transcript");
    await expect(callbacks.getClipboardText()).resolves.toBe("copied");
    await expect(callbacks.setClipboardText("hello")).resolves.toBeUndefined();
    await expect(callbacks.isExtensionInstalled("Summarize")).resolves.toBe(true);
    await expect(callbacks.getExtensionEnabledState("Summarize")).resolves.toBe(false);

    expect(translateText).toHaveBeenCalledWith("hello", undefined);
    expect(getYouTubeTranscript).toHaveBeenCalledWith("https://youtu.be/demo", undefined);
    expect(getClipboardText).toHaveBeenCalledTimes(1);
    expect(setClipboardText).toHaveBeenCalledWith("hello");
    expect(isExtensionInstalled).toHaveBeenCalledWith("Summarize");
    expect(getExtensionEnabledState).toHaveBeenCalledWith("Summarize");
  });

  it("keeps extension writes fail-fast when no explicit host writer exists", async () => {
    const { createSessionHostCallbacks } = await import("../session-host");

    const callbacks = createSessionHostCallbacks(() => ({
      bridge: {},
      capabilitySources: {},
      hasHostOverrides: false,
    }));

    await expect(callbacks.setExtensionEnabled("Summarize", true)).rejects.toThrow(
      "/extension-toggle is not available in current context",
    );
  });
});
