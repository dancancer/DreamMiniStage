import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it } from "vitest";

import SessionToolbar from "@/components/character-chat/SessionToolbar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

describe("SessionToolbar", () => {
  it("renders the toolbar with controls and status", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(
        <SessionToolbar
          currentModel="mini-gpt"
          streamingEnabled={true}
          fastModelEnabled={false}
          swipeLabel="Swipe to next"
          apiSelector={<span>API</span>}
          modeControls={<span>Mode</span>}
          swipeControls={<span>Swipe</span>}
          t={(key) => key}
        />,
      );
    });

    const toolbar = container.querySelector("[data-session-toolbar='true']");
    expect(toolbar).toBeInstanceOf(HTMLElement);
    expect(toolbar?.textContent).toContain("mini-gpt");
    expect(toolbar?.textContent).toContain("Streaming On");
    expect(toolbar?.textContent).toContain("Fast Off");
    expect(toolbar?.textContent).toContain("Swipe to next");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
