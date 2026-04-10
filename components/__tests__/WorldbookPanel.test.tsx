import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorldbookPanel } from "@/components/panels/WorldbookPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

const mocks = vi.hoisted(() => ({
  listGlobalWorldBooks: vi.fn().mockResolvedValue([
    {
      id: "global:test-book",
      name: "世界设定库",
      description: "共享设定",
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      entryCount: 3,
    },
  ]),
  createGlobalWorldBook: vi.fn(),
  deleteGlobalWorldBook: vi.fn(),
  toggleGlobalWorldBook: vi.fn(),
  editorProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/lib/worldbook/global-client", () => ({
  listClientGlobalWorldBooks: mocks.listGlobalWorldBooks,
  createClientGlobalWorldBook: mocks.createGlobalWorldBook,
  deleteClientGlobalWorldBook: mocks.deleteGlobalWorldBook,
  toggleClientGlobalWorldBook: mocks.toggleGlobalWorldBook,
}));

vi.mock("@/lib/store/session-store", () => ({
  useSessionStore: (selector: (state: { getSessionById: (id: string) => undefined }) => unknown) =>
    selector({
      getSessionById: () => undefined,
    }),
}));

vi.mock("@/components/WorldBookEditor", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mocks.editorProps.push(props);
    return React.createElement("div", { "data-testid": "worldbook-editor" }, "WorldBookEditor");
  },
}));

vi.mock("@/app/i18n", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    fontClass: "font-body",
    serifFontClass: "font-serif",
  }),
}));

vi.mock("@/lib/store/toast-store", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

interface RenderedPanel {
  container: HTMLDivElement;
  root: Root;
}

async function renderWorldbookPanel() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<WorldbookPanel />);
  });

  await act(async () => {
    await Promise.resolve();
  });

  return { container, root };
}

function cleanup(rendered: RenderedPanel) {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

afterEach(() => {
  document.body.innerHTML = "";
  mocks.editorProps.length = 0;
});

describe("WorldbookPanel", () => {
  it("falls back to the global worldbook workspace when no session context exists", async () => {
    const rendered = await renderWorldbookPanel();

    expect(rendered.container.textContent).toContain("全局世界书库");
    expect(rendered.container.textContent).toContain("世界设定库");
    expect(mocks.editorProps[0]?.initialBookLevel).toBe("global");
    expect(mocks.editorProps[0]?.globalKey).toBe("global:test-book");

    cleanup(rendered);
  });
});
