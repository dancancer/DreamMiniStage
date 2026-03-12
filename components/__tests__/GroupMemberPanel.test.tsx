import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import GroupMemberPanel from "@/components/group-chat/GroupMemberPanel";
import { resetGroupChatStore, useGroupChatStore } from "@/lib/group-chat/store";

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
    root.render(<GroupMemberPanel dialogueId="dlg-1" />);
  });

  return { container, root };
}

function unmountPanel(rendered: RenderedPanel): void {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

describe("GroupMemberPanel", () => {
  beforeEach(() => {
    resetGroupChatStore();
  });

  it("toggles, reorders, and removes members through the panel", () => {
    const store = useGroupChatStore.getState();
    store.addGroupMember("dlg-1", "Alice");
    store.addGroupMember("dlg-1", "Bob");

    const rendered = renderPanel();

    act(() => {
      (rendered.container.querySelector("button[data-group-member-toggle='Bob']") as HTMLButtonElement).click();
      (rendered.container.querySelector("button[data-group-member-up='Bob']") as HTMLButtonElement).click();
    });

    expect(useGroupChatStore.getState().listGroupMembers("dlg-1").map((member) => `${member.name}:${member.enabled}`)).toEqual([
      "Bob:false",
      "Alice:true",
    ]);

    act(() => {
      (rendered.container.querySelector("button[data-group-member-remove='Alice']") as HTMLButtonElement).click();
    });

    expect(useGroupChatStore.getState().listGroupMembers("dlg-1").map((member) => member.name)).toEqual(["Bob"]);
    unmountPanel(rendered);
  });

  it("removes the named member even when another member id matches that name", () => {
    const store = useGroupChatStore.getState();
    store.addGroupMember("dlg-1", "Alice");
    store.addGroupMember("dlg-1", "member-1");

    const rendered = renderPanel();

    act(() => {
      (rendered.container.querySelector("button[data-group-member-remove='member-1']") as HTMLButtonElement).click();
    });

    expect(useGroupChatStore.getState().listGroupMembers("dlg-1").map((member) => member.name)).toEqual(["Alice"]);
    unmountPanel(rendered);
  });
});
