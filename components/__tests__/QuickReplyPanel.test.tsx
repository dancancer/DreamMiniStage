import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import QuickReplyPanel from "@/components/quick-reply/QuickReplyPanel";
import { resetQuickReplyStore, useQuickReplyStore } from "@/lib/quick-reply/store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

interface RenderedPanel {
  container: HTMLDivElement;
  root: Root;
}

function renderPanel(onExecuteQuickReply = vi.fn()): RenderedPanel {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<QuickReplyPanel dialogueId="dlg-1" onExecuteQuickReply={onExecuteQuickReply} />);
  });

  return { container, root };
}

function unmountPanel(rendered: RenderedPanel): void {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

describe("QuickReplyPanel", () => {
  beforeEach(() => {
    resetQuickReplyStore();
  });

  it("renders visible quick replies and forwards click execution by index", () => {
    const store = useQuickReplyStore.getState();
    store.createQuickReplySet("Main", {});
    store.createQuickReply("Main", "Hello", "hello world", {});
    store.addGlobalQuickReplySet("Main", { visible: true });

    const onExecuteQuickReply = vi.fn();
    const rendered = renderPanel(onExecuteQuickReply);

    const button = rendered.container.querySelector("button[data-quick-reply-index='0']");
    expect(button?.textContent).toContain("Hello");

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onExecuteQuickReply).toHaveBeenCalledWith(0);
    unmountPanel(rendered);
  });
});
