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

function renderChatInput(props?: {
  userInput?: string;
  suggestedInputs?: string[];
  isSending?: boolean;
}): RenderedChatInput {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);

  act(() => {
    root.render(
      <ChatInput
        userInput={props?.userInput ?? ""}
        setUserInput={vi.fn()}
        isSending={props?.isSending ?? false}
        suggestedInputs={props?.suggestedInputs ?? []}
        onSubmit={vi.fn()}
        onSuggestedInput={vi.fn()}
        fontClass="font-body"
        t={(key) => key}
      />,
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
  it("does not render legacy tool rail containers anymore", () => {
    const rendered = renderChatInput();

    expect(rendered.container.querySelector("[data-chat-tool-rail='true']")).toBeNull();
    expect(rendered.container.querySelector("[data-chat-floating-tools='true']")).toBeNull();

    unmount(rendered);
  });

  it("renders suggestions only when available and not sending", () => {
    const rendered = renderChatInput({
      suggestedInputs: ["alpha", "beta"],
      isSending: false,
    });

    expect(rendered.container.textContent).toContain("alpha");
    expect(rendered.container.textContent).toContain("beta");

    unmount(rendered);
  });

  it("exposes an accessible label for the message input", () => {
    const rendered = renderChatInput();

    const input = rendered.container.querySelector("#send_textarea");
    const label = rendered.container.querySelector("label[for='send_textarea']");

    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(label?.textContent).toBe("characterChat.typeMessage");

    unmount(rendered);
  });

  it("hides suggestions while sending", () => {
    const rendered = renderChatInput({
      suggestedInputs: ["alpha"],
      isSending: true,
    });

    expect(rendered.container.textContent).not.toContain("alpha");

    unmount(rendered);
  });
});
