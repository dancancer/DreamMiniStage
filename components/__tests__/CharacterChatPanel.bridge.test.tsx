import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useScriptVariables } from "@/lib/store/script-variables";
import CharacterChatPanel from "../CharacterChatPanel";

const harness = vi.hoisted(() => ({
  lastOnScriptMessage: undefined as
    | ((message: { type: string; payload?: { method?: string; args?: unknown[] } }) => Promise<unknown> | unknown)
    | undefined,
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
    ChatInput: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="chat-input">{children}</div>
    ),
    ControlPanel: () => null,
    MessageHeaderControls: () => null,
    MessageList: ({
      onScriptMessage,
    }: {
      onScriptMessage?: (message: { type: string; payload?: { method?: string; args?: unknown[] } }) => Promise<unknown> | unknown;
    }) => {
      harness.lastOnScriptMessage = onScriptMessage;
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

function renderPanel(overrides: Record<string, unknown> = {}): RenderedPanel {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);
  act(() => {
    root.render(
      <CharacterChatPanel
        character={{ id: "char-1", name: "Alice", extensions: {} }}
        messages={[
          { id: "m0", role: "assistant", content: "hello" },
          { id: "m1", role: "assistant", content: "world" },
        ]}
        openingMessages={[]}
        openingIndex={0}
        openingLocked={true}
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
        language="en"
        dialogueKey="dialogue-1"
        chatName="Session One"
        {...overrides}
      />,
    );
  });

  return { container, root };
}

async function runSlash(script: string): Promise<unknown> {
  if (!harness.lastOnScriptMessage) {
    throw new Error("MessageList onScriptMessage is not ready");
  }

  let result: unknown;
  await act(async () => {
    result = await harness.lastOnScriptMessage?.({
      type: "API_CALL",
      payload: {
        method: "triggerSlash",
        args: [script],
      },
    });
  });
  return result;
}

function unmountPanel(rendered: RenderedPanel): void {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

describe("CharacterChatPanel slash bridge harness", () => {
  beforeEach(() => {
    harness.lastOnScriptMessage = undefined;
    useScriptVariables.getState().clearAll();
    window.localStorage.clear();
  });

  it("routes high-value slash commands from triggerSlash to host callbacks", async () => {
    const onOpenTemporaryChat = vi.fn().mockResolvedValue(undefined);
    const onTranslateText = vi.fn().mockResolvedValue("bonjour");
    const onGetYouTubeTranscript = vi.fn().mockResolvedValue("line-1\nline-2");
    const onSelectProxyPreset = vi.fn().mockResolvedValue("Claude Reverse");
    const onGetWorldInfoTimedEffect = vi.fn().mockResolvedValue(true);
    const onSetWorldInfoTimedEffect = vi.fn().mockResolvedValue(undefined);
    const onJumpToMessage = vi.fn().mockResolvedValue(undefined);

    const rendered = renderPanel({
      onOpenTemporaryChat,
      onTranslateText,
      onGetYouTubeTranscript,
      onSelectProxyPreset,
      onGetWorldInfoTimedEffect,
      onSetWorldInfoTimedEffect,
      onJumpToMessage,
    });

    const tempchat = await runSlash("/tempchat") as { isError?: boolean; pipe?: string };
    const translate = await runSlash("/translate target=fr provider=deepl hello world") as { isError?: boolean; pipe?: string };
    const proxy = await runSlash("/proxy Claude Reverse") as { isError?: boolean; pipe?: string };
    const transcript = await runSlash("/yt-script lang=ja https://youtu.be/dQw4w9WgXcQ") as { isError?: boolean; pipe?: string };
    const timedEffect = await runSlash("/wi-get-timed-effect file=book-1 effect=sticky uid-1") as { isError?: boolean; pipe?: string };
    const setTimedEffect = await runSlash("/wi-set-timed-effect file=book-1 uid=uid-1 effect=delay toggle") as { isError?: boolean; pipe?: string };
    const teleport = await runSlash("/floor-teleport 1") as { isError?: boolean; pipe?: string };

    expect(tempchat).toMatchObject({ isError: false, pipe: "" });
    expect(translate).toMatchObject({ isError: false, pipe: "bonjour" });
    expect(proxy).toMatchObject({ isError: false, pipe: "Claude Reverse" });
    expect(transcript).toMatchObject({ isError: false, pipe: "line-1\nline-2" });
    expect(timedEffect).toMatchObject({ isError: false, pipe: "true" });
    expect(setTimedEffect).toMatchObject({ isError: false, pipe: "" });
    expect(teleport).toMatchObject({ isError: false, pipe: "" });

    expect(onOpenTemporaryChat).toHaveBeenCalledTimes(1);
    expect(onTranslateText).toHaveBeenCalledWith("hello world", {
      target: "fr",
      provider: "deepl",
    });
    expect(onSelectProxyPreset).toHaveBeenCalledWith("Claude Reverse");
    expect(onGetYouTubeTranscript).toHaveBeenCalledWith("https://youtu.be/dQw4w9WgXcQ", {
      lang: "ja",
    });
    expect(onGetWorldInfoTimedEffect).toHaveBeenCalledWith("book-1", "uid-1", "sticky", {
      format: "boolean",
    });
    expect(onSetWorldInfoTimedEffect).toHaveBeenCalledWith("book-1", "uid-1", "delay", "toggle");
    expect(onJumpToMessage).toHaveBeenCalledWith(1);

    unmountPanel(rendered);
  });

  it("fails fast when high-value host callback is missing", async () => {
    const rendered = renderPanel();

    const result = await runSlash("/proxy") as { isError?: boolean; errorMessage?: string };

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("not available");

    unmountPanel(rendered);
  });
});
