import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MessageBubble from "../MessageBubble";
import * as contentParser from "@/lib/utils/content-parser";

const harness = vi.hoisted(() => ({
  parseAsyncResult: [{ type: "html", content: "<strong>parsed</strong>" }],
  parseAsyncImpl: undefined as
    | undefined
    | (() => Promise<Array<{ type: string; content: string }>>),
}));

vi.mock("@/lib/utils/content-parser", () => ({
  parseContent: vi.fn((raw: string) => [{ type: "html", content: raw }]),
  parseContentAsync: vi.fn(async () => {
    if (harness.parseAsyncImpl) {
      return harness.parseAsyncImpl();
    }
    return harness.parseAsyncResult;
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

interface RenderedBubble {
  container: HTMLDivElement;
  root: Root;
}

function renderBubble(element: React.ReactElement): RenderedBubble {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return { container, root };
}

function unmountBubble(rendered: RenderedBubble): void {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

function rerenderBubble(rendered: RenderedBubble, element: React.ReactElement): void {
  act(() => {
    rendered.root.render(element);
  });
}

describe("MessageBubble streaming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.parseAsyncResult = [{ type: "html", content: "<strong>parsed</strong>" }];
    harness.parseAsyncImpl = undefined;
  });

  it("does not render network error placeholder for empty loading assistant bubble", () => {
    const rendered = renderBubble(
      <MessageBubble
        html=""
        isLoading={true}
        enableStreaming={true}
      />,
    );

    expect(rendered.container.textContent || "").not.toContain(
      "No response received. Please check your network connection or API configuration.",
    );

    unmountBubble(rendered);
  });

  it("renders incremental content immediately while streaming is enabled", () => {
    const rendered = renderBubble(
      <MessageBubble
        html="stream chunk"
        enableStreaming={true}
      />,
    );

    expect(rendered.container.textContent).toContain("stream chunk");
    expect(rendered.container.textContent).not.toContain(
      "No response received. Please check your network connection or API configuration.",
    );
    expect(contentParser.parseContent).not.toHaveBeenCalled();
    expect(contentParser.parseContentAsync).not.toHaveBeenCalled();

    unmountBubble(rendered);
  });

  it("re-renders with parsed content when streaming mode turns off", async () => {
    const rendered = renderBubble(
      <MessageBubble
        html="**parsed**"
        enableStreaming={true}
      />,
    );

    expect(rendered.container.textContent).toContain("**parsed**");

    await act(async () => {
      rerenderBubble(
        rendered,
        <MessageBubble
          html="**parsed**"
          enableStreaming={false}
        />,
      );
      await Promise.resolve();
    });

    expect(contentParser.parseContentAsync).toHaveBeenCalled();
    expect(rendered.container.innerHTML).toContain("<strong>parsed</strong>");

    unmountBubble(rendered);
  });

  it("keeps raw streamed content visible while async parsing is still pending", async () => {
    let resolveParse: ((value: Array<{ type: string; content: string }>) => void) | undefined;
    harness.parseAsyncImpl = () => new Promise((resolve) => {
      resolveParse = resolve;
    });

    const rendered = renderBubble(
      <MessageBubble
        html="streamed **content**"
        enableStreaming={true}
      />,
    );

    expect(rendered.container.textContent).toContain("streamed **content**");

    await act(async () => {
      rerenderBubble(
        rendered,
        <MessageBubble
          html="streamed **content**"
          enableStreaming={false}
        />,
      );
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain("streamed **content**");

    await act(async () => {
      resolveParse?.([{ type: "html", content: "<strong>parsed</strong>" }]);
      await Promise.resolve();
    });

    expect(rendered.container.innerHTML).toContain("<strong>parsed</strong>");

    unmountBubble(rendered);
  });
});
