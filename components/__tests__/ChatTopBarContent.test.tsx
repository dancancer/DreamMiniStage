import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatTopBarContent } from "@/components/chat/ChatTopBarContent";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

const mocks = vi.hoisted(() => ({
  setCharacterView: vi.fn(),
  openPanel: vi.fn(),
}));

vi.mock("@/app/i18n", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        "characterChat.worldBook": "世界书",
        "characterChat.chattingWith": "聊天中",
        "characterChat.noCharacter": "未选择角色",
      };
      return dict[key] ?? key;
    },
  }),
}));

vi.mock("@/lib/store/ui-store", () => ({
  useUIStore: (selector: (state: { setCharacterView: typeof mocks.setCharacterView }) => unknown) =>
    selector({ setCharacterView: mocks.setCharacterView }),
}));

vi.mock("@/contexts/ui-layout", () => ({
  useUiLayout: () => ({
    openPanel: mocks.openPanel,
  }),
}));

vi.mock("@/components/CharacterAvatarBackground", () => ({
  CharacterAvatarBackground: ({ avatarPath }: { avatarPath: string }) =>
    React.createElement("div", { "data-avatar-path": avatarPath }),
}));

interface RenderedHeader {
  container: HTMLDivElement;
  root: Root;
}

function renderHeader() {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);

  act(() => {
    root.render(
      <ChatTopBarContent
        character={{ name: "Alice", avatar_path: "/alice.png" }}
        activeView="chat"
      />,
    );
  });

  return { container, root };
}

function cleanup(rendered: RenderedHeader) {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ChatTopBarContent", () => {
  it("opens session tools instead of exposing regex and preset toggles inline", () => {
    const rendered = renderHeader();

    expect(rendered.container.textContent).toContain("世界书");
    expect(rendered.container.textContent).toContain("会话工具");
    expect(rendered.container.textContent).not.toContain("正则");
    expect(rendered.container.textContent).not.toContain("预设");

    const sessionToolsButton = Array.from(rendered.container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("会话工具"),
    );

    act(() => {
      sessionToolsButton?.click();
    });

    expect(mocks.openPanel).toHaveBeenCalledWith("sessionTools");

    cleanup(rendered);
  });
});
