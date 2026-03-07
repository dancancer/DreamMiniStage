import { describe, expect, it } from "vitest";
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
});
