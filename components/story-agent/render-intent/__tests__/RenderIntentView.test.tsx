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

  it("renders dynamic story action choices from structured source data", () => {
    const rendered = renderIntent({
      schemaVersion: 1,
      id: "actions",
      kind: "choice-list",
      sourceScriptId: "script",
      title: "Actions",
      confidence: 0.8,
      options: [],
      dataTemplate: "$1",
      sourcePattern: "<StoryActions>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/StoryActions>",
    }, {
      1: JSON.stringify({
        options: [{
          id: "action-1",
          label: "检查侧门",
          description: "确认是否有人经过",
          value: "检查侧门",
        }],
      }),
    });

    expect(rendered.container.textContent).toContain("检查侧门");
    expect(rendered.container.textContent).toContain("确认是否有人经过");
    expect(rendered.container.querySelector("script")).toBeNull();

    const button = rendered.container.querySelector("button");
    act(() => button?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(rendered.onAppendInput).toHaveBeenCalledWith("检查侧门");

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

  it("renders custom dashboard sections and meters from captured status data", () => {
    const rendered = renderIntent({
      schemaVersion: 1,
      id: "status-dashboard",
      kind: "status-panel",
      sourceScriptId: "script",
      title: "Tactical Terminal",
      confidence: 0.8,
      fields: [],
      dataTemplate: "$1",
      sourcePattern: "<StatusDashboard>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/StatusDashboard>",
    }, {
      1: JSON.stringify({
        date: "2026-06-01",
        location: "后台走廊",
        sections: [{
          title: "Resources",
          fields: [
            { label: "EP", value: "5000" },
            { label: "Alert", value: "<script>bad()</script>" },
          ],
        }],
        meters: [{
          label: "HP",
          value: 85,
          max: 100,
          unit: "%",
          description: "Main unit integrity",
        }],
      }),
    });

    expect(rendered.container.textContent).toContain("Tactical Terminal");
    expect(rendered.container.textContent).toContain("Resources");
    expect(rendered.container.textContent).toContain("EP");
    expect(rendered.container.textContent).toContain("5000");
    expect(rendered.container.textContent).toContain("HP");
    expect(rendered.container.textContent).toContain("85/100%");
    expect(rendered.container.textContent).toContain("<script>bad()</script>");
    expect(rendered.container.querySelector("script")).toBeNull();

    cleanup(rendered);
  });

  it("renders a state panel from safe StoryState data", () => {
    const rendered = renderIntent({
      schemaVersion: 1,
      id: "state",
      kind: "state-panel",
      sourceScriptId: "script",
      title: "Story State",
      confidence: 0.8,
      dataTemplate: "$1",
      sourcePattern: "<StoryState>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/StoryState>",
    }, {
      1: JSON.stringify({
        updated: [{
          op: "set",
          path: "当前地点",
          value: "后台走廊",
        }],
        snapshot: {
          当前地点: "后台走廊",
          长崎素世: {
            $meta: { extensible: false },
            好感度: [6, "对User的好感度"],
          },
        },
        errors: [],
      }),
    });

    const text = rendered.container.textContent ?? "";
    expect(rendered.container.textContent).toContain("Story State");
    expect(rendered.container.textContent).toContain("当前地点");
    expect(rendered.container.textContent).toContain("后台走廊");
    expect(text).toContain("长崎素世.好感度");
    expect(text).toContain("6");
    expect(text).toContain("对User的好感度");
    expect(text).not.toContain("$meta");
    expect(text).not.toContain("{\"$meta\"");
    expect(rendered.container.querySelector("script")).toBeNull();

    cleanup(rendered);
  });
});
