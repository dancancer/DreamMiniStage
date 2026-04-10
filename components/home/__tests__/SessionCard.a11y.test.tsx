import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import SessionCard from "@/components/home/SessionCard";
import type { SessionWithCharacter } from "@/types/session";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

vi.mock("@/app/i18n", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        "sessionCard.edit": "编辑会话",
        "sessionCard.delete": "删除会话",
        "sessionCard.open": "打开会话",
      };
      return dict[key] ?? key;
    },
    fontClass: "font-body",
  }),
}));

vi.mock("@/components/CharacterAvatarBackground", () => ({
  CharacterAvatarBackground: ({ avatarPath }: { avatarPath: string }) =>
    React.createElement("div", { "data-avatar-path": avatarPath }),
}));

interface RenderedSessionCard {
  container: HTMLDivElement;
  root: Root;
}

const baseSession: SessionWithCharacter = {
  id: "session-1",
  characterId: "char-1",
  name: "Session One",
  createdAt: new Date("2026-04-01T10:00:00.000Z").toISOString(),
  updatedAt: new Date("2026-04-01T12:00:00.000Z").toISOString(),
  characterName: "Alice",
  characterAvatar: "/alice.png",
};

function renderSessionCard(overrides?: Partial<SessionWithCharacter>) {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);
  const onClick = vi.fn();
  const onEdit = vi.fn();
  const onDelete = vi.fn();

  act(() => {
    root.render(
      <SessionCard
        session={{ ...baseSession, ...overrides }}
        onClick={onClick}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
  });

  return { container, root, onClick, onEdit, onDelete };
}

function cleanup(rendered: RenderedSessionCard) {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("SessionCard accessibility", () => {
  it("renders a dedicated primary button plus separate edit and delete buttons", () => {
    const rendered = renderSessionCard();

    const openButton = rendered.container.querySelector("[data-session-open='true']");
    const editButton = rendered.container.querySelector("button[aria-label='编辑会话']");
    const deleteButton = rendered.container.querySelector("button[aria-label='删除会话']");

    expect(openButton).toBeInstanceOf(HTMLButtonElement);
    expect(editButton).toBeInstanceOf(HTMLButtonElement);
    expect(deleteButton).toBeInstanceOf(HTMLButtonElement);

    cleanup(rendered);
  });

  it("keeps the primary action independent from edit and delete actions", () => {
    const rendered = renderSessionCard();

    const openButton = rendered.container.querySelector("[data-session-open='true']");
    const editButton = rendered.container.querySelector("button[aria-label='编辑会话']");
    const deleteButton = rendered.container.querySelector("button[aria-label='删除会话']");

    act(() => {
      (openButton as HTMLButtonElement).click();
    });
    expect(rendered.onClick).toHaveBeenCalledTimes(1);

    act(() => {
      (editButton as HTMLButtonElement).click();
    });
    act(() => {
      (deleteButton as HTMLButtonElement).click();
    });

    expect(rendered.onClick).toHaveBeenCalledTimes(1);
    expect(rendered.onEdit).toHaveBeenCalledTimes(1);
    expect(rendered.onDelete).toHaveBeenCalledTimes(1);

    cleanup(rendered);
  });
});
