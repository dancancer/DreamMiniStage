import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sparkles } from "lucide-react";
import { StageEmptyState } from "@/components/ui/stage-empty-state";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

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

interface RenderedStageEmptyState {
  container: HTMLDivElement;
  root: Root;
}

function renderStageEmptyState() {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);

  act(() => {
    root.render(
      <StageEmptyState
        icon={<Sparkles className="h-6 w-6" />}
        eyebrow="First Run"
        title="No sessions yet"
        description="Pick an existing scene or begin a new one."
        note="You can skip this step and come back later."
        primaryAction={{ label: "Go Home", href: "/" }}
        secondaryAction={{ label: "Create Session", href: "/character-cards?mode=create-session" }}
      />,
    );
  });

  return { container, root };
}

function cleanup(rendered: RenderedStageEmptyState) {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("StageEmptyState", () => {
  it("renders the title, description, note, and both actions", () => {
    const rendered = renderStageEmptyState();

    expect(rendered.container.textContent).toContain("First Run");
    expect(rendered.container.textContent).toContain("No sessions yet");
    expect(rendered.container.textContent).toContain("Pick an existing scene or begin a new one.");
    expect(rendered.container.textContent).toContain("You can skip this step and come back later.");

    const links = Array.from(rendered.container.querySelectorAll("a"));
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute("href")).toBe("/");
    expect(links[1]?.getAttribute("href")).toBe("/character-cards?mode=create-session");

    cleanup(rendered);
  });
});
