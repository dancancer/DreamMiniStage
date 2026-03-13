import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import SessionGalleryDialog from "../session-gallery/SessionGalleryDialog";

const dialogHarness = vi.hoisted(() => ({
  onOpenChange: undefined as undefined | ((open: boolean) => void),
}));

vi.mock("next/image", () => ({
  default: ({ unoptimized: _unoptimized, ...props }: Record<string, unknown>) => (
    <div
      data-testid="mock-image"
      data-src={String(props.src || "")}
      data-alt={String(props.alt || "")}
    />
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    onOpenChange,
  }: {
    children?: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
  }) => {
    dialogHarness.onOpenChange = onOpenChange;
    return <div data-testid="dialog-root">{children}</div>;
  },
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

interface RenderedDialog {
  container: HTMLDivElement;
  root: Root;
}

function renderDialog(overrides: Record<string, unknown> = {}): RenderedDialog {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <SessionGalleryDialog
        open={true}
        items={[
          { src: "blob:temp-avatar", ephemeral: true },
          { src: "https://img.example/scene.png", ephemeral: false },
        ]}
        onClose={vi.fn()}
        {...overrides}
      />,
    );
  });

  return { container, root };
}

function unmountDialog(rendered: RenderedDialog): void {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

describe("SessionGalleryDialog", () => {
  it("revokes ephemeral object urls when the dialog closes", () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(),
      revokeObjectURL,
    });
    const onClose = vi.fn();
    const rendered = renderDialog({ onClose });

    act(() => {
      dialogHarness.onOpenChange?.(false);
    });

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:temp-avatar");
    expect(onClose).toHaveBeenCalledTimes(1);

    unmountDialog(rendered);
    vi.unstubAllGlobals();
  });
});
