import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ScriptDebugPanel from "@/components/ScriptDebugPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

interface RenderedPanel {
  container: HTMLDivElement;
  root: Root;
}

function renderPanel(): RenderedPanel {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <ScriptDebugPanel
        isOpen={true}
        onClose={vi.fn()}
        scripts={[
          {
            scriptName: "Host Probe",
            status: "completed",
            timestamp: 1000,
          },
        ]}
        hostDebug={{
          recentApiCalls: [
            {
              method: "getAudioSettings",
              capability: "audio-channel-control",
              resolvedPath: "session-default",
              outcome: "supported",
              timestamp: 2000,
            },
          ],
          runtimeState: {
            toolRegistrations: 2,
            eventListeners: 3,
            hasHostOverrides: true,
          },
        }}
      />,
    );
  });

  return { container, root };
}

function unmountPanel(rendered: RenderedPanel): void {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

describe("ScriptDebugPanel", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders host capability, recent api call, runtime state, and script status sections", () => {
    const rendered = renderPanel();
    const text = document.body.textContent || "";

    expect(text).toContain("Script Execution Debugger");
    expect(text).toContain("Host Capability");
    expect(text).toContain("Recent API Calls");
    expect(text).toContain("Runtime State");
    expect(text).toContain("Script Status");
    expect(text).toContain("tool-registration");
    expect(text).toContain("audio");
    expect(text).toContain("getAudioSettings");
    expect(text).toContain("session-default");
    expect(text).toContain("toolRegistrations");
    expect(text).toContain("Host Probe");

    unmountPanel(rendered);
  });
});
