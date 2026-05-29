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

  it("renders a JSON status panel from captured status data", () => {
    const rendered = renderIntent({
      schemaVersion: 1,
      id: "status-json",
      kind: "status-panel",
      sourceScriptId: "script",
      title: "状态栏",
      confidence: 0.8,
      fields: [],
      dataTemplate: "$1",
      sourcePattern: "<SFW>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/SFW>",
    }, {
      1: JSON.stringify({
        date: "2020年3月28日",
        time: "14:35",
        characters: [{
          name: "若叶睦",
          status: "观察黄瓜",
          relation: "未相识",
          location: "庭院",
          clothing: "格纹连衣裙",
          thought: "这片叶子颜色有点淡",
        }],
      }),
    });

    expect(rendered.container.textContent).toContain("Story Status");
    expect(rendered.container.textContent).toContain("若叶睦");
    expect(rendered.container.textContent).toContain("观察黄瓜");
    expect(rendered.container.querySelector("script")).toBeNull();

    cleanup(rendered);
  });
});
