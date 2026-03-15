import { describe, expect, it } from "vitest";

const BATCH_ONE_AREAS = [
  "tool-registration",
  "extension-state",
  "clipboard",
  "audio",
  "gallery",
  "navigation",
  "proxy",
  "quick-reply",
  "checkpoint",
  "group-member",
  "translation",
  "youtube-transcript",
  "timed-world-info",
  "ui-style",
  "popup",
  "device",
  "chat-control",
  "panel-layout",
  "background",
] as const;

describe("script host capability matrix", () => {
  it("declares the phase 5 batch-1 host capability areas", async () => {
    const matrixModule = await import("../host-capability-matrix");
    const areas = new Set(
      matrixModule.SCRIPT_HOST_CAPABILITY_MATRIX.map((capability) => capability.area),
    );

    expect(areas).toEqual(new Set(BATCH_ONE_AREAS));
  });

  it("uses a stable support level for each capability", async () => {
    const matrixModule = await import("../host-capability-matrix");

    expect(matrixModule.SCRIPT_HOST_CAPABILITY_MATRIX).not.toHaveLength(0);

    for (const capability of matrixModule.SCRIPT_HOST_CAPABILITY_MATRIX) {
      expect([
        "default",
        "conditional",
        "fail-fast",
        "unsupported",
      ]).toContain(capability.support);
    }
  });

  it("requires a fail-fast reason whenever a capability is declared fail-fast", async () => {
    const matrixModule = await import("../host-capability-matrix");

    for (const capability of matrixModule.SCRIPT_HOST_CAPABILITY_MATRIX) {
      if (capability.support !== "fail-fast") {
        continue;
      }

      expect(capability.failFastReason?.trim()).toBeTruthy();
    }
  });

  it("maps the next high-value /session slash slices into the host matrix", async () => {
    const matrixModule = await import("../host-capability-matrix");
    const getMatch = (script: string) =>
      matrixModule.getScriptHostCapabilityFromCall("triggerSlash", [script]);

    expect(getMatch("/tempchat")?.capability.id).toBe("session-navigation");
    expect(getMatch("/floor-teleport 1")?.capability.id).toBe("session-navigation");
    expect(getMatch("/proxy Claude Reverse")?.capability.id).toBe("proxy-preset");
    expect(getMatch("/qr 0")?.capability.id).toBe("quick-reply-execution");
    expect(getMatch("/checkpoint-create mes=0 story-turn")?.capability.id).toBe("checkpoint-navigation");
    expect(getMatch("/member-add Alice")?.capability.id).toBe("group-member-management");
    expect(getMatch("/addmember Alice")?.capability.id).toBe("group-member-management");
    expect(getMatch("/getmember Alice name")?.capability.id).toBe("group-member-management");
    expect(getMatch("/countmember")?.capability.id).toBe("group-member-management");
    expect(getMatch("/membercount")?.capability.id).toBe("group-member-management");
    expect(getMatch("/member-enable Alice")?.capability.id).toBe("group-member-management");
    expect(getMatch("/member-disable Alice")?.capability.id).toBe("group-member-management");
    expect(getMatch("/enable Bob")?.capability.id).toBe("group-member-management");
    expect(getMatch("/translate hello world")?.capability.id).toBe("session-translation");
    expect(getMatch("/yt-script https://youtu.be/dQw4w9WgXcQ")?.capability.id).toBe("youtube-transcript");
    expect(getMatch("/wi-set-timed-effect file=book uid=uid effect=sticky on")?.capability.id).toBe("timed-world-info");
    expect(getMatch("/popup result=true hello")?.capability.id).toBe("popup-interaction");
    expect(getMatch("/pick-icon")?.capability.id).toBe("popup-interaction");
    expect(getMatch("/bubble")?.capability.id).toBe("ui-style-control");
    expect(getMatch("/theme light")?.capability.id).toBe("ui-style-control");
    expect(getMatch("/movingui compact")?.capability.id).toBe("ui-style-control");
    expect(getMatch("/css-var varname=--test value")?.capability.id).toBe("ui-style-control");
    expect(getMatch("/is-mobile")?.capability.id).toBe("device-capability-read");
    expect(getMatch("/panels")?.capability.id).toBe("panel-layout-control");
    expect(getMatch("/resetpanels")?.capability.id).toBe("panel-layout-control");
    expect(getMatch("/vn")?.capability.id).toBe("panel-layout-control");
    expect(getMatch("/bg forest")?.capability.id).toBe("background-control");
    expect(getMatch("/lockbg")?.capability.id).toBe("background-control");
    expect(getMatch("/autobg")?.capability.id).toBe("background-control");
    expect(getMatch("/closechat")?.capability.id).toBe("chat-window-control");
  });
});
