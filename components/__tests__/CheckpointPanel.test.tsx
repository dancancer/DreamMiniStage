import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import CheckpointPanel from "@/components/checkpoint/CheckpointPanel";
import { resetCheckpointStore, useCheckpointStore } from "@/lib/checkpoint/store";

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
      <CheckpointPanel
        dialogueId="dlg-1"
        messages={[
          { id: "m-0", content: "hello" },
          { id: "m-1", content: "world" },
          { id: "m-2", content: "tail" },
        ]}
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

describe("CheckpointPanel", () => {
  beforeEach(() => {
    resetCheckpointStore();
  });

  it("renders checkpoint summary from dialogue-scoped store", () => {
    const store = useCheckpointStore.getState();
    store.createCheckpoint("dlg-1", "m-1", "story-turn");
    store.createBranch("dlg-1", "m-2", "session-1");

    const rendered = renderPanel();

    expect(rendered.container.textContent).toContain("story-turn");
    expect(rendered.container.textContent).toContain("branch-1");
    expect(rendered.container.textContent).toContain("当前分支");

    unmountPanel(rendered);
  });
});
