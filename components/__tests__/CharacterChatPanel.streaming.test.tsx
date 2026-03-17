import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach } from "vitest";
import CharacterChatPanel from "../CharacterChatPanel";
import {
  createHostDebugState,
  readHostDebugSnapshot,
} from "@/hooks/script-bridge/host-debug-state";

const harness = vi.hoisted(() => ({
  currentConfig: { advanced: { streaming: true } } as { advanced?: { streaming?: boolean } } | undefined,
  lastMessageListProps: undefined as {
    streamingIntent: {
      enabled: boolean;
      targetIndex: number;
      isSending: boolean;
      activeMessageId: string | null;
    };
  } | undefined,
}));

vi.mock("@/hooks/useApiConfig", () => ({
  useApiConfig: () => ({
    configs: [],
    activeConfigId: "",
    currentModel: "",
    getCurrentConfig: () => harness.currentConfig,
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

vi.mock("@/hooks/useScriptBridge", () => ({
  useScriptBridge: () => ({
    scriptVariables: {},
    handleScriptMessage: vi.fn(),
    broadcastMessage: vi.fn(),
    scriptStatuses: [],
  }),
}));

vi.mock("@/components/character-chat", async () => {
  const ReactModule = await import("react");

  return {
    ApiSelector: () => null,
    ChatInput: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="chat-input">{children}</div>
    ),
    ControlPanel: () => null,
    MessageHeaderControls: () => null,
    MessageList: ({
      streamingIntent,
    }: {
      streamingIntent: {
        enabled: boolean;
        targetIndex: number;
        isSending: boolean;
        activeMessageId: string | null;
      };
    }) => {
      harness.lastMessageListProps = { streamingIntent };
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
          { id: "m0", role: "user", content: "hello" },
          { id: "m1", role: "assistant", content: "world" },
        ]}
        openingMessages={[]}
        openingIndex={0}
        openingLocked={true}
        userInput=""
        setUserInput={vi.fn()}
        isSending={true}
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
        language="en"
        dialogueKey="dialogue-1"
        chatName="Session One"
        hostDebug={readHostDebugSnapshot(hostDebugState)}
        hostDebugState={hostDebugState}
        onHostDebugUpdate={vi.fn()}
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

describe("CharacterChatPanel streaming", () => {
  beforeEach(() => {
    harness.currentConfig = { advanced: { streaming: true } };
    harness.lastMessageListProps = undefined;
  });

  it("targets the last message for streaming updates", () => {
    const rendered = renderPanel();

    expect(harness.lastMessageListProps?.streamingIntent.targetIndex).toBe(1);
    expect(harness.lastMessageListProps?.streamingIntent.activeMessageId).toBe("m1");

    unmountPanel(rendered);
  });
});
