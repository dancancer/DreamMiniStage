import { describe, expect, it } from "vitest";

describe("script host debug resolver", () => {
  it("resolves session default support for default capabilities", async () => {
    const { SCRIPT_HOST_CAPABILITY_MATRIX } = await import("../host-capability-matrix");
    const { resolveHostCapabilityState } = await import("../host-debug-resolver");
    const audioCapability = SCRIPT_HOST_CAPABILITY_MATRIX.find(
      (capability) => capability.area === "audio",
    );

    expect(audioCapability).toBeDefined();
    expect(resolveHostCapabilityState(audioCapability!)).toMatchObject({
      support: "default",
      resolvedPath: "session-default",
      outcome: "supported",
    });
  });

  it("resolves injected host support for conditional capabilities", async () => {
    const { SCRIPT_HOST_CAPABILITY_MATRIX } = await import("../host-capability-matrix");
    const { resolveHostCapabilityState } = await import("../host-debug-resolver");
    const clipboardCapability = SCRIPT_HOST_CAPABILITY_MATRIX.find(
      (capability) => capability.area === "clipboard",
    );

    expect(clipboardCapability).toBeDefined();
    expect(
      resolveHostCapabilityState(clipboardCapability!, {
        hasInjectedHost: true,
      }),
    ).toMatchObject({
      support: "conditional",
      resolvedPath: "api-context",
      outcome: "supported",
    });
  });

  it("resolves fail-fast output for conditional capabilities without host injection", async () => {
    const { SCRIPT_HOST_CAPABILITY_MATRIX } = await import("../host-capability-matrix");
    const { resolveHostCapabilityState } = await import("../host-debug-resolver");
    const extensionCapability = SCRIPT_HOST_CAPABILITY_MATRIX.find(
      (capability) => capability.area === "extension-state",
    );

    expect(extensionCapability).toBeDefined();
    expect(resolveHostCapabilityState(extensionCapability!)).toMatchObject({
      support: "conditional",
      resolvedPath: "fail-fast",
      outcome: "fail-fast",
      reason: extensionCapability?.failFastReason,
    });
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
