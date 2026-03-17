import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it } from "vitest";
import ThinkBubble from "../ThinkBubble";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

interface RenderedBubble {
  container: HTMLDivElement;
  root: Root;
}

function renderBubble(element: React.ReactElement): RenderedBubble {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return { container, root };
}

function rerenderBubble(rendered: RenderedBubble, element: React.ReactElement): void {
  act(() => {
    rendered.root.render(element);
  });
}

function unmountBubble(rendered: RenderedBubble): void {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

describe("ThinkBubble", () => {
  it("auto-expands when thinking content first becomes available", () => {
    const rendered = renderBubble(
      <ThinkBubble
        thinkingContent=""
        characterName="Alice"
        fontClass="font-body"
        serifFontClass="font-serif"
        t={(key) => key}
      />,
    );

    rerenderBubble(
      rendered,
      <ThinkBubble
        thinkingContent="reasoning text"
        characterName="Alice"
        fontClass="font-body"
        serifFontClass="font-serif"
        t={(key) => key}
      />,
    );

    const panel = rendered.container.querySelector(".overflow-hidden");
    expect(panel?.className).toContain("max-h-96");
    expect(rendered.container.textContent).toContain("reasoning text");

    unmountBubble(rendered);
  });
});
