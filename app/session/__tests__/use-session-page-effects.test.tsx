import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeaderContentProvider } from "@/contexts/header-content";
import SessionPageContent from "../session-page-content";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  setCharacterView: vi.fn(),
  resetPresetViewPayload: vi.fn(),
  setMessages: vi.fn(),
  setSuggestedInputs: vi.fn(),
  fetchLatestDialogue: vi.fn().mockResolvedValue(undefined),
  character: {
    id: "char-1",
    name: "Alice",
    avatar_path: "/alice.png",
    extensions: {},
  },
}));

vi.mock("@/components/chat/ChatTopBarContent", () => ({
  ChatTopBarContent: () => null,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("id=session-1"),
  useRouter: () => ({
    replace: mocks.replace,
  }),
}));

vi.mock("@/app/i18n", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    fontClass: "font-body",
    serifFontClass: "font-serif",
    language: "en",
  }),
}));

vi.mock("@/lib/store/toast-store", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/useCharacterDialogue", () => ({
  useCharacterDialogue: () => ({
    messages: [],
    openingMessages: [],
    openingIndex: 0,
    openingLocked: true,
    suggestedInputs: [],
    isSending: false,
    initializeNewDialogue: vi.fn(),
    setMessages: mocks.setMessages,
    setSuggestedInputs: mocks.setSuggestedInputs,
    fetchLatestDialogue: mocks.fetchLatestDialogue,
    handleRegenerate: vi.fn().mockResolvedValue(undefined),
    addUserMessage: vi.fn().mockResolvedValue(undefined),
    addRoleMessage: vi.fn().mockResolvedValue(undefined),
    triggerGeneration: vi.fn().mockResolvedValue(undefined),
    handleSwipe: vi.fn().mockResolvedValue(undefined),
    truncateMessagesAfter: vi.fn().mockResolvedValue(undefined),
    handleOpeningNavigate: vi.fn().mockResolvedValue(undefined),
    exportJsonl: vi.fn().mockResolvedValue(undefined),
    importJsonl: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/hooks/useCharacterLoader", () => ({
  useCharacterLoader: () => ({
    character: mocks.character,
    dialogueData: null,
    isLoading: false,
    isInitializing: false,
    error: "",
    loadingPhase: "loading",
  }),
}));

vi.mock("@/app/session/use-session-host-debug", () => ({
  useSessionHostDebug: () => ({
    hostDebugState: {},
    hostDebug: {},
    syncHostDebug: vi.fn(),
  }),
}));

vi.mock("@/app/session/use-session-route-state", () => ({
  useSessionRouteState: () => ({
    characterId: "char-1",
    sessionError: null,
  }),
}));

vi.mock("@/app/session/use-session-page-actions", () => ({
  useSessionPageActions: () => ({}),
}));

vi.mock("@/app/session/session-page-layout", () => ({
  default: () => null,
}));

vi.mock("@/lib/store/ui-store", () => ({
  useUIStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    characterView: "chat",
    setCharacterView: mocks.setCharacterView,
    presetViewPayload: null,
    resetPresetViewPayload: mocks.resetPresetViewPayload,
  }),
}));

vi.mock("@/lib/store/user-store", () => ({
  useUserStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    displayUsername: "Tester",
  }),
}));

vi.mock("@/lib/store/session-store", () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    getSessionById: () => ({
      id: "session-1",
      characterId: "char-1",
      name: "Session One",
    }),
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

interface RenderedHarness {
  container: HTMLDivElement;
  root: Root;
}

function renderHarness(): RenderedHarness {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);
  act(() => {
    root.render(
      <HeaderContentProvider>
        <SessionPageContent />
      </HeaderContentProvider>,
    );
  });

  return { container, root };
}

function unmountHarness(rendered: RenderedHarness): void {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("useSessionHeaderContent", () => {
  it("does not enter a render loop when SessionPageContent mounts", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const rendered = renderHarness();

    expect(consoleError.mock.calls).not.toContainEqual([
      expect.stringContaining("Maximum update depth exceeded"),
    ]);

    expect(consoleError.mock.calls.flat().join("\n")).not.toContain(
      "Maximum update depth exceeded",
    );

    unmountHarness(rendered);
  });
});
