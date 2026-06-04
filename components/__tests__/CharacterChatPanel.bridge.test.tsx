import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createHostDebugState,
  readHostDebugSnapshot,
} from "@/hooks/script-bridge/host-debug-state";
import CharacterChatPanel from "../CharacterChatPanel";

const harness = vi.hoisted(() => ({
  lastMessageListProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@/hooks/useApiConfig", () => ({
  useApiConfig: () => ({
    configs: [],
    activeConfigId: "",
    currentModel: "",
    getCurrentConfig: () => undefined,
    handleConfigSelect: vi.fn(),
    handleModelSwitch: vi.fn(),
    setActiveConfigStreaming: vi.fn(),
    showApiDropdown: false,
    setShowApiDropdown: vi.fn(),
    showModelDropdown: false,
    setShowModelDropdown: vi.fn(),
    selectedConfigId: "",
    setSelectedConfigId: vi.fn(),
  }),
}));

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorageBoolean: () => ({
    value: false,
    setValue: vi.fn(),
  }),
}));

vi.mock("@/utils/username-helper", () => ({
  getDisplayUsername: () => "Tester",
  setDisplayUsername: vi.fn(),
}));

vi.mock("@/components/UserNameSettingModal", () => ({
  default: () => null,
}));

vi.mock("@/components/ScriptDebugPanel", () => ({
  default: () => null,
}));

vi.mock("@/components/character-chat", async () => {
  const ReactModule = await import("react");

  return {
    ApiSelector: () => null,
    ChatInput: () => <div data-testid="chat-input" />,
    ControlPanel: () => null,
    MessageHeaderControls: () => null,
    MessageList: (props: Record<string, unknown>) => {
      harness.lastMessageListProps = props;
      return ReactModule.createElement("div", { "data-testid": "message-list" });
    },
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

interface RenderedPanel {
  container: HTMLDivElement;
  root: Root;
}

function renderPanel(): RenderedPanel {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);
  const hostDebugState = createHostDebugState();
  act(() => {
    root.render(
      <CharacterChatPanel
        character={{ id: "char-1", name: "Alice", extensions: {} }}
        messages={[
          { id: "m0", role: "assistant", content: "hello" },
        ]}
        openingSelection={{ messages: [], index: 0, locked: true }}
        userInput=""
        setUserInput={vi.fn()}
        isSending={false}
        suggestedInputs={[]}
        onSubmit={vi.fn()}
        onSuggestedInput={vi.fn()}
        onTruncate={vi.fn()}
        onRegenerate={vi.fn()}
        onOpeningNavigate={vi.fn()}
        fontClass="font-body"
        serifFontClass="font-serif"
        t={(key) => key}
        activeModes={{ streaming: false, fastModel: false }}
        setActiveModes={vi.fn()}
        hostDebug={readHostDebugSnapshot(hostDebugState)}
      />,
    );
  });

  return { container, root };
}

function unmountPanel(rendered: RenderedPanel): void {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

describe("CharacterChatPanel story script boundary", () => {
  beforeEach(() => {
    harness.lastMessageListProps = undefined;
  });

  it("does not expose script bridge messages to the story message list", () => {
    const rendered = renderPanel();

    expect(harness.lastMessageListProps).not.toHaveProperty("onScriptMessage");

    unmountPanel(rendered);
  });
});
