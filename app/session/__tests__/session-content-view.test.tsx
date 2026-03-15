import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SessionContentView from "../session-content-view";

const registry = vi.hoisted(() => ({
  rendered: [] as string[],
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

vi.mock("@/components/CharacterChatPanel", () => ({
  default: () => {
    registry.rendered.push("chat");
    return <div data-testid="chat-view" />;
  },
}));

vi.mock("@/components/WorldBookEditor", () => ({
  default: () => {
    registry.rendered.push("worldbook");
    return <div data-testid="worldbook-view" />;
  },
}));

vi.mock("@/components/PresetEditor", () => ({
  default: () => {
    registry.rendered.push("preset");
    return <div data-testid="preset-view" />;
  },
}));

vi.mock("@/components/RegexScriptEditor", () => ({
  default: () => {
    registry.rendered.push("regex");
    return <div data-testid="regex-view" />;
  },
}));

vi.mock("@/components/LoginModal", () => ({
  default: () => <div data-testid="login-modal" />,
}));

vi.mock("@/components/DialogueTreeModal", () => ({
  default: () => <div data-testid="tree-modal" />,
}));

interface Rendered {
  container: HTMLDivElement;
  root: Root;
}

function renderView(characterView: "chat" | "worldbook" | "preset" | "regex"): Rendered {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <SessionContentView
        characterView={characterView}
        chatView={<div data-testid="chat-wrapper" />}
        worldbookView={<div data-testid="worldbook-wrapper" />}
        presetView={<div data-testid="preset-wrapper" />}
        regexView={<div data-testid="regex-wrapper" />}
        loginModal={<div data-testid="login-modal" />}
        dialogueTreeModal={<div data-testid="tree-modal" />}
      />,
    );
  });

  return { container, root };
}

describe("session-content-view", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    registry.rendered = [];
  });

  it("switches the main content by character view while keeping shared modals mounted", () => {
    const rendered = renderView("preset");
    const text = document.body.innerHTML;

    expect(text).toContain("preset-wrapper");
    expect(text).toContain("login-modal");
    expect(text).toContain("tree-modal");

    act(() => rendered.root.unmount());
    rendered.container.remove();
  });
});
