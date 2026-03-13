import { describe, expect, it } from "vitest";

describe("script host debug resolver", () => {
  it("resolves session default support for default capabilities", async () => {
    const { SCRIPT_HOST_CAPABILITY_MATRIX } = await import("../host-capability-matrix");
    const { resolveHostCapabilityState } = await import("../host-debug-resolver");
    const audioCapability = SCRIPT_HOST_CAPABILITY_MATRIX.find((capability) => capability.id === "audio-channel-control");
    const galleryCapability = SCRIPT_HOST_CAPABILITY_MATRIX.find((capability) => capability.id === "gallery-browser");

    expect(audioCapability).toBeDefined();
    expect(galleryCapability).toBeDefined();
    expect(resolveHostCapabilityState(audioCapability!)).toMatchObject({
      support: "default",
      resolvedPath: "session-default",
      outcome: "supported",
    });
    expect(resolveHostCapabilityState(galleryCapability!)).toMatchObject({
      support: "default",
      resolvedPath: "session-default",
      outcome: "supported",
    });
  });

  it("resolves default and injected clipboard host paths", async () => {
    const { SCRIPT_HOST_CAPABILITY_MATRIX } = await import("../host-capability-matrix");
    const { resolveHostCapabilityState } = await import("../host-debug-resolver");
    const clipboardCapability = SCRIPT_HOST_CAPABILITY_MATRIX.find((capability) => capability.id === "clipboard-bridge");

    expect(clipboardCapability).toBeDefined();
    expect(resolveHostCapabilityState(clipboardCapability!)).toMatchObject({
      support: "default",
      resolvedPath: "session-default",
      outcome: "supported",
    });
    expect(resolveHostCapabilityState(clipboardCapability!, {
      resolvedPath: "api-context",
    })).toMatchObject({
      support: "default",
      resolvedPath: "api-context",
      outcome: "supported",
    });
  });

  it("resolves extension read as default and extension write as conditional", async () => {
    const { SCRIPT_HOST_CAPABILITY_MATRIX } = await import("../host-capability-matrix");
    const { resolveHostCapabilityState } = await import("../host-debug-resolver");
    const extensionReadCapability = SCRIPT_HOST_CAPABILITY_MATRIX.find((capability) => capability.id === "extension-state-read");
    const extensionWriteCapability = SCRIPT_HOST_CAPABILITY_MATRIX.find((capability) => capability.id === "extension-state-write");

    expect(extensionReadCapability).toBeDefined();
    expect(extensionWriteCapability).toBeDefined();
    expect(resolveHostCapabilityState(extensionReadCapability!)).toMatchObject({
      support: "default",
      resolvedPath: "session-default",
      outcome: "supported",
    });
    expect(resolveHostCapabilityState(extensionWriteCapability!)).toMatchObject({
      support: "conditional",
      resolvedPath: "fail-fast",
      outcome: "fail-fast",
      reason: extensionWriteCapability?.failFastReason,
    });
    expect(resolveHostCapabilityState(extensionWriteCapability!, {
      resolvedPath: "api-context",
    })).toMatchObject({
      support: "conditional",
      resolvedPath: "api-context",
      outcome: "supported",
    });
  });

  it("resolves the new /session host slices as explicit default support", async () => {
    const { SCRIPT_HOST_CAPABILITY_MATRIX } = await import("../host-capability-matrix");
    const { resolveHostCapabilityState } = await import("../host-debug-resolver");
    const sessionDefaultCapabilityIds = [
      "session-navigation",
      "proxy-preset",
      "quick-reply-execution",
      "checkpoint-navigation",
      "group-member-management",
      "session-translation",
      "youtube-transcript",
      "timed-world-info",
    ];
    const bridgeOnlyCapabilityIds = [
      "ui-style-control",
      "popup-interaction",
      "device-capability-read",
      "chat-window-control",
      "panel-layout-control",
      "background-control",
    ];

    for (const capabilityId of sessionDefaultCapabilityIds) {
      const capability = SCRIPT_HOST_CAPABILITY_MATRIX.find((entry) => entry.id === capabilityId);
      expect(capability, capabilityId).toBeDefined();
      expect(resolveHostCapabilityState(capability!)).toMatchObject({
        support: "default",
        resolvedPath: "session-default",
        outcome: "supported",
      });
    }

    for (const capabilityId of bridgeOnlyCapabilityIds) {
      const capability = SCRIPT_HOST_CAPABILITY_MATRIX.find((entry) => entry.id === capabilityId);
      expect(capability, capabilityId).toBeDefined();
      expect(resolveHostCapabilityState(capability!)).toMatchObject({
        support: "default",
        resolvedPath: "bridge-only",
        outcome: "supported",
      });
    }
  });

  it("records recent api calls with the required debugger fields", async () => {
    const { createHostDebugState } = await import("../host-debug-state");
    const debugState = createHostDebugState();

    debugState.recordApiCall({
      method: "setClipboardText",
      capability: "clipboard-bridge",
      resolvedPath: "fail-fast",
      outcome: "fail-fast",
      timestamp: 123,
    });

    expect(debugState.getRecentApiCalls()).toEqual([
      {
        method: "setClipboardText",
        capability: "clipboard-bridge",
        resolvedPath: "fail-fast",
        outcome: "fail-fast",
        timestamp: 123,
      },
    ]);
  });
});
