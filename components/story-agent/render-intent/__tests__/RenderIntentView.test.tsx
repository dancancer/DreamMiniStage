import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { RenderIntentView } from "../RenderIntentView";
import type { RenderIntent } from "@/lib/story-agent/render-intent";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

interface RenderedIntent {
  container: HTMLDivElement;
  root: Root;
}

function renderIntent(intent: RenderIntent, values: Record<string, string> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onAppendInput = vi.fn();

  act(() => {
    root.render(
      <RenderIntentView
        intent={intent}
        onAppendInput={onAppendInput}
        values={values}
      />,
    );
  });

  return { container, root, onAppendInput };
}

function cleanup(rendered: RenderedIntent): void {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

describe("RenderIntentView", () => {
  it("renders a choice list through whitelisted buttons", () => {
    const rendered = renderIntent({
      schemaVersion: 1,
      id: "choices",
      kind: "choice-list",
      sourceScriptId: "script",
      title: "Next step",
      confidence: 0.8,
      options: [{
        id: "choice-1",
        labelTemplate: "$1",
        descriptionTemplate: "$2",
        action: { type: "append-input", valueTemplate: "$1" },
      }],
    }, {
      1: "Investigate",
      2: "Check the backstage door",
    });

    expect(rendered.container.textContent).toContain("Investigate");
    expect(rendered.container.querySelector("script")).toBeNull();
    expect(rendered.container.querySelector("iframe")).toBeNull();

    const button = rendered.container.querySelector("button");
    act(() => button?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(rendered.onAppendInput).toHaveBeenCalledWith("Investigate");

    cleanup(rendered);
  });

  it("renders a collapsible panel without raw HTML execution", () => {
    const rendered = renderIntent({
      schemaVersion: 1,
      id: "panel",
      kind: "collapsible-panel",
      sourceScriptId: "script",
      title: "Thoughts",
      confidence: 0.8,
      bodyTemplate: "$1",
      collapsedLabel: "Open",
      expandedLabel: "Close",
    }, {
      1: "<script>bad()</script>visible text",
    });

    expect(rendered.container.textContent).toContain("<script>bad()</script>visible text");
    expect(rendered.container.querySelector("script")).toBeNull();

    cleanup(rendered);
  });

  it("renders a status panel from structured fields", () => {
    const rendered = renderIntent({
      schemaVersion: 1,
      id: "status",
      kind: "status-panel",
      sourceScriptId: "script",
      title: "Status",
      confidence: 0.8,
      fields: [{ label: "Mood", valueTemplate: "$1" }],
    }, {
      1: "calm",
    });

    expect(rendered.container.textContent).toContain("Mood");
    expect(rendered.container.textContent).toContain("calm");

    cleanup(rendered);
  });
});
