import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleApiCall } from "../index";
import { createHostDebugState } from "../host-debug-state";
import type { ApiCallContext } from "../types";

function createMockContext(overrides: Partial<ApiCallContext> = {}): ApiCallContext {
  const globalVars: Record<string, unknown> = {};
  const characterVars: Record<string, Record<string, unknown>> = {};

  return {
    characterId: "char-plugin-test",
    dialogueId: "dialogue-plugin-test",
    messages: [
      { id: "u1", role: "user", content: "hello" },
      { id: "a1", role: "assistant", content: "world" },
    ],
    iframeId: "iframe_plugin_test",
    setScriptVariable: vi.fn((key, value, scope, id) => {
      if (scope === "global") {
        globalVars[key] = value;
        return;
      }
      if (!id) {
        return;
      }
      characterVars[id] = characterVars[id] ?? {};
      characterVars[id][key] = value;
    }),
    deleteScriptVariable: vi.fn((key, scope, id) => {
      if (scope === "character" && id && characterVars[id]) {
        delete characterVars[id][key];
        return;
      }
      delete globalVars[key];
    }),
    getVariablesSnapshot: () => ({
      global: { ...globalVars },
      character: { ...characterVars },
    }),
    ...overrides,
  };
}

describe("plugin minimal regression", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps JS-Slash-Runner core bridge path runnable", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const onTrigger = vi.fn().mockResolvedValue(undefined);
    const hostDebugState = createHostDebugState();
    const ctx = createMockContext({ onSend, onTrigger, hostDebugState });

    const slashResult = await handleApiCall("triggerSlash", ["/send hi|/trigger"], ctx);

    expect(slashResult).toMatchObject({ isError: false });
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onTrigger).toHaveBeenCalledTimes(1);

    const eventOnResult = await handleApiCall("eventOn", ["mvu.variable_updated", "h1", "iframe_plugin_test"], ctx);
    expect(eventOnResult).toMatchObject({ success: true });

    const eventEmitResult = await handleApiCall("eventEmit", ["mvu.variable_updated", { hp: 1 }], ctx);
    expect(eventEmitResult).toMatchObject({ eventType: "mvu.variable_updated", triggeredCount: 1 });
    expect(hostDebugState.getRuntimeState()).toMatchObject({
      eventListeners: 1,
      toolRegistrations: 0,
    });
  });

  it("keeps MagVarUpdate-like variables and message reads runnable", async () => {
    const ctx = createMockContext();

    const replaceResult = await handleApiCall("replaceVariables", [{ hp: 10, mp: 5 }, "global"], ctx);
    expect(replaceResult).toBe(true);

    const vars = await handleApiCall("getVariables", [{ scope: "global" }], ctx);
    expect(vars).toMatchObject({ hp: 10, mp: 5 });

    const messages = await handleApiCall("getChatMessages", [], ctx);
    expect(Array.isArray(messages)).toBe(true);
    expect(messages).toHaveLength(2);

    const currentMessageId = await handleApiCall("getCurrentMessageId", [], ctx);
    expect(currentMessageId).toBe("a1");
  });

  it("keeps /character switch callback path runnable", async () => {
    const onSwitchCharacter = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext({ onSwitchCharacter });

    const result = await handleApiCall("triggerSlash", ["/character Bob"], ctx);

    expect(result).toMatchObject({ isError: false, pipe: "Bob" });
    expect(onSwitchCharacter).toHaveBeenCalledWith("Bob");
  });

  it("records host-debug observations for tool registration and default audio support", async () => {
    const hostDebugState = createHostDebugState();
    const ctx = createMockContext({ hostDebugState });

    const registerResult = await handleApiCall("registerFunctionTool", [
      "debug_tool",
      "Debug tool",
      { type: "object", properties: {} },
      false,
      "iframe_plugin_test",
    ], ctx);
    expect(registerResult).toBe(true);

    const audioSettings = await handleApiCall("getAudioSettings", ["bgm"], ctx);
    expect(audioSettings).toMatchObject({
      enabled: true,
      mode: "repeat",
    });

    expect(hostDebugState.getRecentApiCalls()).toEqual([
      expect.objectContaining({
        method: "getAudioSettings",
        capability: "audio-channel-control",
        resolvedPath: "session-default",
        outcome: "supported",
      }),
      expect.objectContaining({
        method: "registerFunctionTool",
        capability: "function-tool-registry",
        resolvedPath: "bridge-only",
        outcome: "supported",
      }),
    ]);
    expect(hostDebugState.getRuntimeState()).toMatchObject({
      toolRegistrations: 1,
    });
  });

  it("records clipboard and extension-state slash paths with the resolved host source", async () => {
    const hostDebugState = createHostDebugState();
    const ctx = createMockContext({
      hostDebugState,
      onGetClipboardText: vi.fn().mockResolvedValue("session clipboard"),
      onIsExtensionInstalled: vi.fn().mockResolvedValue(true),
      onGetExtensionEnabledState: vi.fn().mockResolvedValue(true),
      hostCapabilitySources: {
        clipboard: "session-default",
        extensionRead: "session-default",
      },
    });

    const clipboardResult = await handleApiCall("triggerSlash", ["/clipboard-get"], ctx);
    const extensionState = await handleApiCall("triggerSlash", ["/extension-state Summarize"], ctx);

    expect(clipboardResult).toMatchObject({ isError: false, pipe: "session clipboard" });
    expect(extensionState).toMatchObject({ isError: false, pipe: "true" });
    expect(hostDebugState.getRecentApiCalls()).toEqual([
      expect.objectContaining({
        method: "triggerSlash",
        capability: "extension-state-read",
        resolvedPath: "session-default",
        outcome: "supported",
      }),
      expect.objectContaining({
        method: "triggerSlash",
        capability: "clipboard-bridge",
        resolvedPath: "session-default",
        outcome: "supported",
      }),
    ]);
  });

  it("records fail-fast extension write attempts when no host writer exists", async () => {
    const hostDebugState = createHostDebugState();
    const ctx = createMockContext({
      hostDebugState,
      onIsExtensionInstalled: vi.fn().mockResolvedValue(true),
      onGetExtensionEnabledState: vi.fn().mockResolvedValue(false),
      hostCapabilitySources: {
        extensionRead: "session-default",
      },
    });

    await expect(handleApiCall("triggerSlash", ["/extension-toggle Summarize"], ctx)).resolves.toMatchObject({
      isError: true,
      errorMessage: expect.stringContaining("/extension-toggle is not available in current context"),
    });
    expect(hostDebugState.getRecentApiCalls()).toEqual([
      expect.objectContaining({
        method: "triggerSlash",
        capability: "extension-state-write",
        resolvedPath: "fail-fast",
        outcome: "fail-fast",
      }),
    ]);
  });

  it("records gallery slash paths with the resolved default host source", async () => {
    const hostDebugState = createHostDebugState();
    const ctx = createMockContext({
      hostDebugState,
      onListGallery: vi.fn().mockResolvedValue(["/alice.png"]),
      hostCapabilitySources: {
        galleryList: "session-default",
      },
    });

    const result = await handleApiCall("triggerSlash", ["/list-gallery char=Alice"], ctx);

    expect(result).toMatchObject({ isError: false, pipe: "[\"/alice.png\"]" });
    expect(hostDebugState.getRecentApiCalls()).toEqual([
      expect.objectContaining({
        method: "triggerSlash",
        capability: "gallery-browser",
        resolvedPath: "session-default",
        outcome: "supported",
      }),
    ]);
  });
});
