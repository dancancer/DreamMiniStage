import { describe, expect, it } from "vitest";
import { SCRIPT_HOST_CAPABILITY_MATRIX } from "@/hooks/script-bridge/host-capability-matrix";
import { resolveHostCapabilityState } from "@/hooks/script-bridge/host-debug-resolver";
import {
  buildSessionSlashHostBridgeDetail,
  resolveSessionSlashHostBridge,
  setSessionSlashHostBridge,
  SESSION_HOST_BRIDGE_WINDOW_KEY,
  type SessionSlashHostBridge,
} from "../session-host-bridge";

type SessionHostWindow = Window & {
  [SESSION_HOST_BRIDGE_WINDOW_KEY]?: SessionSlashHostBridge;
};

describe("session-host-bridge", () => {
  it("returns null when owner is missing", () => {
    expect(resolveSessionSlashHostBridge(null)).toBeNull();
    expect(resolveSessionSlashHostBridge(undefined)).toBeNull();
  });

  it("returns null when the bridge slot is not an object", () => {
    const owner = {} as SessionHostWindow;
    owner[SESSION_HOST_BRIDGE_WINDOW_KEY] = "bad-payload" as unknown as SessionSlashHostBridge;

    expect(resolveSessionSlashHostBridge(owner)).toBeNull();
  });

  it("returns the host bridge when the slot contains an object payload", () => {
    const bridge: SessionSlashHostBridge = {
      translateText: async (text) => text,
    };
    const owner = {
      [SESSION_HOST_BRIDGE_WINDOW_KEY]: bridge,
    } as SessionHostWindow;

    expect(resolveSessionSlashHostBridge(owner)).toBe(bridge);
  });

  it("sets and clears the bridge through the canonical window slot", () => {
    const bridge: SessionSlashHostBridge = {
      getYouTubeTranscript: async (url) => url,
    };
    const owner = {} as SessionHostWindow;

    setSessionSlashHostBridge(owner, bridge);
    expect(resolveSessionSlashHostBridge(owner)).toBe(bridge);

    setSessionSlashHostBridge(owner, null);
    expect(resolveSessionSlashHostBridge(owner)).toBeNull();
  });

  it("builds the canonical window path for host bridge methods", () => {
    expect(buildSessionSlashHostBridgeDetail("translateText")).toBe(
      "window.__DREAMMINISTAGE_SESSION_HOST__.translateText",
    );
    expect(buildSessionSlashHostBridgeDetail("getYouTubeTranscript")).toBe(
      "window.__DREAMMINISTAGE_SESSION_HOST__.getYouTubeTranscript",
    );
  });

  it("keeps default, conditional, and fail-fast host semantics explainable", () => {
    const audioCapability = SCRIPT_HOST_CAPABILITY_MATRIX.find(
      (capability) => capability.area === "audio",
    );
    const clipboardCapability = SCRIPT_HOST_CAPABILITY_MATRIX.find(
      (capability) => capability.area === "clipboard",
    );
    const extensionCapability = SCRIPT_HOST_CAPABILITY_MATRIX.find(
      (capability) => capability.area === "extension-state",
    );

    expect(audioCapability).toBeDefined();
    expect(clipboardCapability).toBeDefined();
    expect(extensionCapability).toBeDefined();

    expect(resolveHostCapabilityState(audioCapability!)).toMatchObject({
      resolvedPath: "session-default",
      outcome: "supported",
    });
    expect(
      resolveHostCapabilityState(clipboardCapability!, { hasInjectedHost: true }),
    ).toMatchObject({
      resolvedPath: "api-context",
      outcome: "supported",
    });
    expect(resolveHostCapabilityState(extensionCapability!)).toMatchObject({
      resolvedPath: "fail-fast",
      outcome: "fail-fast",
      reason: extensionCapability?.failFastReason,
    });
  });
});
