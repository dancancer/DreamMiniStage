import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChatInput from "@/components/character-chat/ChatInput";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

interface RenderedChatInput {
  container: HTMLDivElement;
  root: Root;
}

function renderChatInput(children?: React.ReactNode): RenderedChatInput {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);

  act(() => {
    root.render(
      <ChatInput
        userInput=""
        setUserInput={vi.fn()}
        isSending={false}
        suggestedInputs={[]}
        onSubmit={vi.fn()}
        onSuggestedInput={vi.fn()}
        fontClass="font-body"
        t={(key) => key}
      >
        {children}
      </ChatInput>,
    );
  });

  return { container, root };
}

function unmount(rendered: RenderedChatInput): void {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ChatInput", () => {
  it("wraps footer tools in constrained rail slots", () => {
    const rendered = renderChatInput(
      <>
        <div data-testid="tool-a">A</div>
        <div data-testid="tool-b">B</div>
        <div data-testid="tool-c">C</div>
      </>,
    );

    const rail = rendered.container.querySelector("[data-chat-tool-rail='true']");
    const slots = rendered.container.querySelectorAll("[data-chat-tool-slot='true']");

    expect(rail).not.toBeNull();
    expect(rail?.className).toContain("overflow-x-auto");
    expect(slots).toHaveLength(3);

    slots.forEach((slot) => {
      expect(slot.className).toContain("shrink-0");
      expect(slot.className).toContain("min-w-[18rem]");
    });

    unmount(rendered);
  });
});
