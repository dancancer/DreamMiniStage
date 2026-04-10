import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import LeftNav from "@/components/layout/LeftNav";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  openPanel: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/personas",
  useRouter: () => ({
    push: mocks.push,
  }),
}));

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children?: React.ReactNode;
    }) => ReactModule.createElement("a", { href, ...props }, children),
  };
});

vi.mock("@/contexts/ui-layout", () => ({
  useUiLayout: () => ({
    activePanel: null,
    openPanel: mocks.openPanel,
  }),
}));

interface RenderedLeftNav {
  container: HTMLDivElement;
  root: Root;
}

function renderLeftNav() {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);

  act(() => {
    root.render(<LeftNav isOpen={true} onClose={vi.fn()} />);
  });

  return { container, root };
}

function cleanup(rendered: RenderedLeftNav) {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("LeftNav", () => {
  it("marks the active route link with aria-current", () => {
    const rendered = renderLeftNav();

    const activeLink = rendered.container.querySelector("a[href='/personas']");
    const nav = rendered.container.querySelector("nav[aria-label='主导航']");
    expect(activeLink?.getAttribute("aria-current")).toBe("page");
    expect(nav).toBeInstanceOf(HTMLElement);
    expect(rendered.container.textContent).toContain("设置菜单");
    expect(rendered.container.textContent).not.toContain("模型设置");
    expect(rendered.container.textContent).not.toContain("插件管理");
    expect(rendered.container.textContent).not.toContain("数据管理");

    cleanup(rendered);
  });
});
