import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetQuickReplyStore, useQuickReplyStore } from "@/lib/quick-reply/store";
import { resetGroupChatStore, useGroupChatStore } from "@/lib/group-chat/store";
import { resetCheckpointStore, useCheckpointStore } from "@/lib/checkpoint/store";
import SessionPage from "../page";
import {
  setSessionSlashHostBridge,
  type SessionSlashHostBridge,
} from "../session-host-bridge";

type ModelStoreState = {
  configs: Array<{
    id: string;
    name: string;
    type: "openai" | "ollama" | "gemini";
    baseUrl: string;
    model: string;
    apiKey?: string;
  }>;
  activeConfigId: string;
  setActiveConfig: ReturnType<typeof vi.fn<[string], void>>;
};

function buildModelConfigs(): ModelStoreState["configs"] {
  return [
    {
      id: "cfg-default",
      name: "Default Proxy",
      type: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      apiKey: "sk-default",
    },
    {
      id: "cfg-reverse",
      name: "Claude Reverse",
      type: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4.1-mini",
      apiKey: "sk-reverse",
    },
  ];
}

function buildTimedDialogueTree(extra?: Record<string, unknown>) {
  return {
    id: "session-1",
    character_id: "char-1",
    current_nodeId: "root",
    nodes: [{
      nodeId: "root",
      parentNodeId: "root",
      userInput: "",
      assistantResponse: "",
      fullResponse: "",
      thinkingContent: "",
      extra,
    }],
  };
}

function buildWorldBookEntry(overrides?: Record<string, unknown>) {
  return {
    entry_id: "uid-1",
    content: "entry",
    keys: ["alpha"],
    selective: false,
    constant: false,
    position: 4,
    enabled: true,
    sticky: 3,
    delay: 2,
    ...overrides,
  };
}

const mocks = vi.hoisted(() => {
  const modelStoreState: ModelStoreState = {
    configs: buildModelConfigs(),
    activeConfigId: "cfg-default",
    setActiveConfig: vi.fn((id: string) => {
      modelStoreState.activeConfigId = id;
    }),
  };

  return {
    routerPush: vi.fn(),
    routerReplace: vi.fn(),
    createSession: vi.fn().mockResolvedValue("temp-session-2"),
    fetchAllSessions: vi.fn().mockResolvedValue(undefined),
    updateSessionName: vi.fn().mockResolvedValue(true),
    setHeaderContent: vi.fn(),
    toastError: vi.fn(),
    setScriptVariable: vi.fn(),
    deleteScriptVariable: vi.fn(),
    latestChatInputProps: undefined as undefined | {
      setUserInput: (value: string) => void;
      onSubmit: (event: React.FormEvent) => void;
    },
    defaultTranslateText: vi.fn().mockResolvedValue("default translated"),
    defaultYouTubeTranscript: vi.fn().mockResolvedValue("default transcript"),
    dialogueTreeState: buildTimedDialogueTree() as ReturnType<typeof buildTimedDialogueTree>,
    worldBooks: {
      "book-1": { entry_0: buildWorldBookEntry() },
      "book-2": { entry_0: buildWorldBookEntry({ sticky: 0, delay: 0, cooldown: 0 }) },
    } as Record<string, Record<string, ReturnType<typeof buildWorldBookEntry>>>,
    getDialogueTreeById: vi.fn(),
    updateDialogueTree: vi.fn(),
    getWorldBook: vi.fn(),
    modelStoreState,
    dialogue: {
      messages: [
        { id: "m0", role: "assistant", content: "hello" },
        { id: "m1", role: "assistant", content: "world" },
      ],
      openingMessages: [],
      openingIndex: 0,
      openingLocked: true,
      isSending: false,
      suggestedInputs: [],
      addUserMessage: vi.fn().mockResolvedValue(undefined),
      triggerGeneration: vi.fn().mockResolvedValue(undefined),
      addRoleMessage: vi.fn().mockResolvedValue(undefined),
      handleSwipe: vi.fn().mockResolvedValue(undefined),
      truncateMessagesAfter: vi.fn(),
      handleRegenerate: vi.fn(),
      handleOpeningNavigate: vi.fn(),
      exportJsonl: vi.fn(),
      importJsonl: vi.fn(),
      initializeNewDialogue: vi.fn(),
      setMessages: vi.fn(),
      setSuggestedInputs: vi.fn(),
      fetchLatestDialogue: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("id=session-1"),
  useRouter: () => ({
    push: mocks.routerPush,
    replace: mocks.routerReplace,
  }),
}));

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) =>
      ReactModule.createElement("a", { href, ...props }, children),
  };
});

vi.mock("@/app/i18n", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    fontClass: "font-body",
    serifFontClass: "font-serif",
    language: "en",
  }),
}));

vi.mock("@/app/session/session-host-defaults", () => ({
  createSessionDefaultHostBridge: () => ({
    translateText: mocks.defaultTranslateText,
    getYouTubeTranscript: mocks.defaultYouTubeTranscript,
  }),
}));

vi.mock("@/contexts/header-content", () => ({
  useHeaderContent: () => ({
    setHeaderContent: mocks.setHeaderContent,
  }),
}));

vi.mock("@/components/chat/ChatTopBarContent", () => ({
  ChatTopBarContent: () => null,
}));

vi.mock("@/hooks/useCharacterDialogue", () => ({
  useCharacterDialogue: () => mocks.dialogue,
}));

vi.mock("@/hooks/useCharacterLoader", () => ({
  useCharacterLoader: () => ({
    character: { id: "char-1", name: "Alice", extensions: {} },
    dialogueData: null,
    error: null,
  }),
}));

vi.mock("@/lib/data/roleplay/character-dialogue-operation", () => ({
  LocalCharacterDialogueOperations: {
    getDialogueTreeById: mocks.getDialogueTreeById,
    updateDialogueTree: mocks.updateDialogueTree,
  },
}));

vi.mock("@/lib/data/roleplay/world-book-operation", () => ({
  WorldBookOperations: {
    getWorldBook: mocks.getWorldBook,
  },
}));

vi.mock("@/lib/store/ui-store", () => ({
  useUIStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    characterView: "chat",
    setCharacterView: vi.fn(),
    presetViewPayload: null,
    resetPresetViewPayload: vi.fn(),
  }),
}));

vi.mock("@/lib/store/user-store", () => ({
  useUserStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    displayUsername: "Tester",
  }),
}));

vi.mock("@/lib/store/session-store", () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    getSessionById: (sessionId: string) => sessionId === "session-1"
      ? {
        id: "session-1",
        characterId: "char-1",
        name: "Session One",
        characterName: "Alice",
        characterAvatar: "",
      }
      : undefined,
    fetchAllSessions: mocks.fetchAllSessions,
    createSession: mocks.createSession,
    updateSessionName: mocks.updateSessionName,
    sessions: [{ id: "session-1", characterId: "char-1", name: "Session One" }],
    isLoading: false,
  }),
}));

vi.mock("@/lib/store/script-variables", () => {
  const state = {
    variables: {
      global: {},
      character: {},
    },
    setVariable: mocks.setScriptVariable,
    deleteVariable: mocks.deleteScriptVariable,
  };

  const useScriptVariables = ((selector?: (value: typeof state) => unknown) =>
    typeof selector === "function" ? selector(state) : state) as {
      (selector?: (value: typeof state) => unknown): unknown;
      getState: () => { variables: { global: Record<string, unknown>; character: Record<string, Record<string, unknown>> } };
    };

  useScriptVariables.getState = () => ({
    variables: {
      global: {},
      character: {},
    },
  });

  return { useScriptVariables };
});

vi.mock("@/lib/store/model-store", () => {
  const useModelStore = ((selector?: (state: ModelStoreState) => unknown) =>
    typeof selector === "function" ? selector(mocks.modelStoreState) : mocks.modelStoreState) as {
      (selector?: (state: ModelStoreState) => unknown): unknown;
      getState: () => ModelStoreState;
    };

  useModelStore.getState = () => mocks.modelStoreState;
  return { useModelStore };
});

vi.mock("@/lib/store/toast-store", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock("@/components/LoginModal", () => ({ default: () => null }));
vi.mock("@/components/DialogueTreeModal", () => ({ default: () => null }));
vi.mock("@/components/WorldBookEditor", () => ({ default: () => null }));
vi.mock("@/components/PresetEditor", () => ({ default: () => null }));
vi.mock("@/components/RegexScriptEditor", () => ({ default: () => null }));

vi.mock("@/hooks/useApiConfig", () => ({
  useApiConfig: () => ({
    configs: [],
    activeConfigId: "",
    currentModel: "",
    getCurrentConfig: () => undefined,
    handleConfigSelect: vi.fn(),
    handleModelSwitch: vi.fn(),
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

vi.mock("@/components/UserNameSettingModal", () => ({ default: () => null }));
vi.mock("@/components/ScriptDebugPanel", () => ({ default: () => null }));

vi.mock("@/components/character-chat", async () => {
  const ReactModule = await import("react");

  return {
    ApiSelector: () => null,
    MessageHeaderControls: () => null,
    ControlPanel: () => null,
    ChatInput: ({
      userInput,
      setUserInput,
      onSubmit,
      children,
    }: {
      userInput: string;
      setUserInput: (value: string) => void;
      onSubmit: (event: React.FormEvent) => void;
      children?: React.ReactNode;
    }) => {
      mocks.latestChatInputProps = { setUserInput, onSubmit };
      return (
        <form data-testid="slash-form" onSubmit={onSubmit}>
          <input data-testid="session-input" value={userInput} readOnly={true} />
          <button type="submit">run</button>
          {children}
        </form>
      );
    },
    MessageList: ({
      messages,
    }: {
      messages: Array<{ id: string; content: string }>;
    }) => ReactModule.createElement(
      "div",
      { "data-testid": "message-list" },
      messages.map((message, index) => ReactModule.createElement(
        "div",
        {
          key: message.id,
          "data-session-message-id": message.id,
          "data-session-message-index": index,
        },
        message.content,
      )),
    ),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

interface RenderedPage {
  container: HTMLDivElement;
  root: Root;
}

function renderPage(): RenderedPage {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);
  act(() => {
    root.render(<SessionPage />);
  });

  return { container, root };
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function unmountPage(rendered: RenderedPage): void {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

async function submitSlash(script: string): Promise<void> {
  if (!mocks.latestChatInputProps) {
    throw new Error("chat input props should be ready");
  }

  await act(async () => {
    mocks.latestChatInputProps?.setUserInput(script);
  });
  await flushEffects();

  if (!mocks.latestChatInputProps) {
    throw new Error("chat input props should stay ready after update");
  }

  await act(async () => {
    mocks.latestChatInputProps?.onSubmit({
      preventDefault: () => undefined,
    } as React.FormEvent);
  });
  await flushEffects();
}

describe("Session page slash integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSession.mockResolvedValue("temp-session-2");
    mocks.modelStoreState.configs = buildModelConfigs();
    mocks.modelStoreState.activeConfigId = "cfg-default";
    window.localStorage.clear();
    mocks.defaultTranslateText.mockReset();
    mocks.defaultTranslateText.mockResolvedValue("default translated");
    mocks.defaultYouTubeTranscript.mockReset();
    mocks.defaultYouTubeTranscript.mockResolvedValue("default transcript");
    mocks.dialogueTreeState = buildTimedDialogueTree();
    mocks.worldBooks = {
      "book-1": { entry_0: buildWorldBookEntry() },
      "book-2": { entry_0: buildWorldBookEntry({ sticky: 0, delay: 0, cooldown: 0 }) },
    };
    mocks.getDialogueTreeById.mockImplementation(async () => JSON.parse(JSON.stringify(mocks.dialogueTreeState)));
    mocks.updateDialogueTree.mockImplementation(async (_dialogueId: string, tree: unknown) => {
      mocks.dialogueTreeState = JSON.parse(JSON.stringify(tree));
      return true;
    });
    mocks.getWorldBook.mockImplementation(async (file: string) => mocks.worldBooks[file] || null);
    setSessionSlashHostBridge(window, null);
    resetQuickReplyStore();
    resetGroupChatStore();
    resetCheckpointStore();
  });

  it("executes /tempchat through page host wiring and navigates to the new temp session", async () => {
    const rendered = renderPage();
    await flushEffects();

    await submitSlash("/tempchat");

    expect(mocks.createSession).toHaveBeenCalledWith(
      "char-1",
      expect.objectContaining({
        name: expect.stringContaining("[temp]"),
      }),
    );
    expect(mocks.routerPush).toHaveBeenCalledWith("/session?id=temp-session-2");

    unmountPage(rendered);
  });

  it("executes /floor-teleport through page host wiring and scrolls to the target message anchor", async () => {
    const rendered = renderPage();
    await flushEffects();

    const target = rendered.container.querySelector("[data-session-message-index='1']");
    if (!(target instanceof HTMLDivElement)) {
      throw new Error("target message should exist");
    }
    const scrollIntoView = vi.fn();
    Object.defineProperty(target, "scrollIntoView", {
      value: scrollIntoView,
      configurable: true,
    });

    await submitSlash("/floor-teleport 1");

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(mocks.toastError).not.toHaveBeenCalled();

    unmountPage(rendered);
  });

  it("executes /proxy through model-store host wiring", async () => {
    const rendered = renderPage();
    await flushEffects();

    await submitSlash("/proxy Claude Reverse");

    expect(mocks.modelStoreState.setActiveConfig).toHaveBeenCalledWith("cfg-reverse");
    expect(mocks.modelStoreState.activeConfigId).toBe("cfg-reverse");
    expect(window.localStorage.getItem("llmType")).toBe("openai");
    expect(window.localStorage.getItem("openaiModel")).toBe("gpt-4.1-mini");
    expect(mocks.toastError).not.toHaveBeenCalled();

    unmountPage(rendered);
  });

  it("surfaces explicit fail-fast errors for unknown /proxy preset", async () => {
    const rendered = renderPage();
    await flushEffects();

    await submitSlash("/proxy missing-profile");

    expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringContaining("/proxy preset not found: missing-profile"),
    );

    unmountPage(rendered);
  });

  it("executes /qr through session quick reply host wiring", async () => {
    const store = useQuickReplyStore.getState();
    store.createQuickReplySet("Main", {});
    store.createQuickReply("Main", "Hello", "hello from quick reply", {});
    store.addGlobalQuickReplySet("Main", { visible: true });

    const rendered = renderPage();
    await flushEffects();

    await submitSlash("/qr 0");

    expect(mocks.dialogue.addUserMessage).toHaveBeenCalledWith("hello from quick reply", undefined);
    expect(mocks.toastError).not.toHaveBeenCalled();

    unmountPage(rendered);
  });

  it("executes /qr with nosend set by seeding the chat input", async () => {
    const store = useQuickReplyStore.getState();
    store.createQuickReplySet("Draft", { nosend: true });
    store.createQuickReply("Draft", "Outline", "draft reply", {});
    store.addGlobalQuickReplySet("Draft", { visible: true });

    const rendered = renderPage();
    await flushEffects();

    await submitSlash("/qr 0");

    expect(mocks.dialogue.addUserMessage).not.toHaveBeenCalled();
    expect(rendered.container.querySelector("[data-testid='session-input']")?.getAttribute("value")).toBe("draft reply");
    expect(mocks.toastError).not.toHaveBeenCalled();

    unmountPage(rendered);
  });

  it("executes /swipe through session host wiring", async () => {
    const rendered = renderPage();
    await flushEffects();

    await submitSlash("/swipe prev");

    expect(mocks.dialogue.handleSwipe).toHaveBeenCalledWith("prev");
    expect(mocks.toastError).not.toHaveBeenCalled();

    unmountPage(rendered);
  });

  it("executes /branch-create and /checkpoint-* through session checkpoint host wiring", async () => {
    const rendered = renderPage();
    await flushEffects();

    await submitSlash("/branch-create 1");
    await submitSlash("/checkpoint-create mes=0 story-turn");
    await submitSlash("/checkpoint-go 1");

    expect(useCheckpointStore.getState().getCheckpoint("session-1", "m1")).toBe("branch-1");
    expect(useCheckpointStore.getState().getCheckpoint("session-1", "m0")).toBe("story-turn");
    expect(useCheckpointStore.getState().getCurrentCheckpoint("session-1")).toBe("branch-1");
    expect(mocks.toastError).not.toHaveBeenCalled();

    unmountPage(rendered);
  });

  it("executes /member-* through session group host wiring", async () => {
    const rendered = renderPage();
    await flushEffects();

    await submitSlash("/member-add Alice");
    await submitSlash("/member-add Bob");
    await submitSlash("/disable Bob");
    await submitSlash("/member-up Bob");

    expect(useGroupChatStore.getState().listGroupMembers("session-1").map((member) => `${member.name}:${member.enabled}`)).toEqual([
      "Bob:false",
      "Alice:true",
    ]);
    expect(mocks.toastError).not.toHaveBeenCalled();

    unmountPage(rendered);
  });

  it("surfaces explicit group-member host errors in /session", async () => {
    const rendered = renderPage();
    await flushEffects();

    await submitSlash("/member-remove Missing");

    expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringContaining("Group member not found"),
    );

    unmountPage(rendered);
  });

  it("executes /translate through injected session host bridge", async () => {
    const translateText = vi.fn().mockResolvedValue("こんにちは");
    setSessionSlashHostBridge(window, {
      translateText,
    });

    const rendered = renderPage();
    await flushEffects();

    await submitSlash("/translate target=ja provider=mocker hello world");

    expect(translateText).toHaveBeenCalledWith("hello world", {
      target: "ja",
      provider: "mocker",
    });
    expect(mocks.toastError).not.toHaveBeenCalled();

    unmountPage(rendered);
  });

  it("executes /translate through the built-in session default host bridge", async () => {
    const rendered = renderPage();
    await flushEffects();

    await submitSlash("/translate hello world");

    expect(mocks.defaultTranslateText).toHaveBeenCalledWith("hello world", {
      provider: undefined,
      target: undefined,
    });
    expect(mocks.toastError).not.toHaveBeenCalled();

    unmountPage(rendered);
  });

  it("surfaces explicit default-host errors for unsupported /translate provider", async () => {
    mocks.defaultTranslateText.mockRejectedValueOnce(
      new Error("/translate provider not available in /session default host: mocker"),
    );

    const rendered = renderPage();
    await flushEffects();

    await submitSlash("/translate provider=mocker hello world");

    expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringContaining("/translate provider not available in /session default host: mocker"),
    );

    unmountPage(rendered);
  });

  it("executes /yt-script through injected session host bridge", async () => {
    const getYouTubeTranscript = vi.fn().mockResolvedValue("line-1\nline-2");
    setSessionSlashHostBridge(window, {
      getYouTubeTranscript,
    });

    const rendered = renderPage();
    await flushEffects();

    await submitSlash("/yt-script lang=ja https://youtu.be/dQw4w9WgXcQ");

    expect(getYouTubeTranscript).toHaveBeenCalledWith("https://youtu.be/dQw4w9WgXcQ", {
      lang: "ja",
    });
    expect(mocks.toastError).not.toHaveBeenCalled();

    unmountPage(rendered);
  });

  it("executes /yt-script through the built-in session default host bridge", async () => {
    const rendered = renderPage();
    await flushEffects();

    await submitSlash("/yt-script https://youtu.be/dQw4w9WgXcQ");

    expect(mocks.defaultYouTubeTranscript).toHaveBeenCalledWith("https://youtu.be/dQw4w9WgXcQ", {
      lang: undefined,
    });
    expect(mocks.toastError).not.toHaveBeenCalled();

    unmountPage(rendered);
  });

  it("surfaces explicit default-host errors for unavailable /yt-script transcript", async () => {
    mocks.defaultYouTubeTranscript.mockRejectedValueOnce(
      new Error("/yt-script transcript not available from /session default host"),
    );

    const rendered = renderPage();
    await flushEffects();

    await submitSlash("/yt-script https://youtu.be/dQw4w9WgXcQ");

    expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringContaining("/yt-script transcript not available from /session default host"),
    );

    unmountPage(rendered);
  });

  it("executes /wi-set-timed-effect through session metadata host wiring", async () => {
    const rendered = renderPage();
    await flushEffects();

    await submitSlash("/wi-set-timed-effect file=book-1 uid=uid-1 effect=sticky on");

    expect(mocks.updateDialogueTree).toHaveBeenCalled();
    expect(mocks.dialogueTreeState.nodes[0]?.extra?.chat_metadata).toEqual({
      timedWorldInfo: {
        "book-1": {
          "uid-1": {
            sticky: 3,
          },
        },
      },
    });
    expect(mocks.toastError).not.toHaveBeenCalled();

    unmountPage(rendered);
  });

  it("surfaces explicit timed-effect configuration errors in /session", async () => {
    const rendered = renderPage();
    await flushEffects();

    await submitSlash("/wi-set-timed-effect file=book-2 uid=uid-1 effect=sticky on");

    expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringContaining("/wi-set-timed-effect effect is not configured on lore entry: sticky"),
    );

    unmountPage(rendered);
  });

  it("keeps slash jump behavior after refresh remount for the same session", async () => {
    const globalScrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      value: globalScrollIntoView,
      configurable: true,
    });

    const firstRender = renderPage();
    await flushEffects();

    await submitSlash("/floor-teleport 1");
    expect(globalScrollIntoView).toHaveBeenCalledTimes(1);
    unmountPage(firstRender);

    const refreshedRender = renderPage();
    await flushEffects();

    await submitSlash("/floor-teleport 1");

    expect(globalScrollIntoView).toHaveBeenNthCalledWith(2, { behavior: "smooth", block: "center" });
    expect(mocks.toastError).not.toHaveBeenCalled();

    unmountPage(refreshedRender);
  });
});
