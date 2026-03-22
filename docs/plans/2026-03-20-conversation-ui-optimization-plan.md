# Conversation UI Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the conversation experience around clear session/message/composer layers, then align shell pages and accessibility so DreamMiniStage feels like a narrative product instead of a config-heavy debug console.

**Architecture:** Introduce a dedicated `SessionToolbar` above the timeline, slim `MessageItem` down to message-only actions, and turn the composer into a focused input surface with secondary tools moved into a drawer/sheet. Roll the work out in narrow, test-first slices so chat behavior, shell IA, and entry pages can be verified independently without destabilizing the whole `/session` stack.

**Tech Stack:** React 19, Next 15 App Router, TypeScript, Tailwind CSS v4, Radix UI primitives, Vitest/jsdom, pnpm.

---

### Task 1: Add a dedicated session toolbar component

**Files:**
- Create: `components/character-chat/SessionToolbar.tsx`
- Modify: `components/character-chat/index.ts`
- Modify: `components/character-chat/README.md`
- Test: `components/__tests__/SessionToolbar.test.tsx`

**Step 1: Write the failing test**

```tsx
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import SessionToolbar from "@/components/character-chat/SessionToolbar";

describe("SessionToolbar", () => {
  it("renders session-level controls and current state summary", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SessionToolbar
          currentModel="gpt-4.1"
          streamingEnabled={true}
          fastModelEnabled={false}
          swipeLabel="2/4"
          t={(key) => key}
          apiSelector={<button>api</button>}
          modeControls={<button>mode</button>}
          swipeControls={<button>swipe</button>}
        />,
      );
    });

    expect(container.textContent).toContain("gpt-4.1");
    expect(container.textContent).toContain("2/4");
    expect(container.querySelector("[data-session-toolbar='true']")).not.toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run components/__tests__/SessionToolbar.test.tsx`
Expected: FAIL with `Cannot find module '@/components/character-chat/SessionToolbar'`.

**Step 3: Write minimal implementation**

```tsx
interface SessionToolbarProps {
  currentModel: string;
  streamingEnabled: boolean;
  fastModelEnabled: boolean;
  swipeLabel?: string | null;
  apiSelector: React.ReactNode;
  modeControls: React.ReactNode;
  swipeControls?: React.ReactNode;
  t: (key: string) => string;
}

export default function SessionToolbar(props: SessionToolbarProps) {
  const {
    currentModel,
    streamingEnabled,
    fastModelEnabled,
    swipeLabel,
    apiSelector,
    modeControls,
    swipeControls,
  } = props;

  return (
    <section data-session-toolbar="true" className="border-b border-border bg-background/95">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-6 py-3">
        {apiSelector}
        {modeControls}
        {swipeControls}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>{currentModel}</span>
          <span>{streamingEnabled ? "Streaming On" : "Streaming Off"}</span>
          <span>{fastModelEnabled ? "Fast On" : "Fast Off"}</span>
          {swipeLabel ? <span>{swipeLabel}</span> : null}
        </div>
      </div>
    </section>
  );
}
```

Also export the component in `components/character-chat/index.ts` and document it in `components/character-chat/README.md`.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run components/__tests__/SessionToolbar.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/character-chat/SessionToolbar.tsx components/character-chat/index.ts components/character-chat/README.md components/__tests__/SessionToolbar.test.tsx
git commit -m "feat: add session toolbar scaffold"
```

### Task 2: Move session-level controls out of the message header

**Files:**
- Modify: `components/CharacterChatPanel.tsx`
- Modify: `components/__tests__/CharacterChatPanel.streaming.test.tsx`
- Create: `components/__tests__/CharacterChatPanel.layout.test.tsx`

**Step 1: Write the failing test**

```tsx
vi.mock("@/components/character-chat", async () => {
  const actual = await vi.importActual("@/components/character-chat");
  return {
    ...actual,
    SessionToolbar: (props: unknown) => <div data-testid="session-toolbar" />,
    MessageList: ({ headerSlot }: { headerSlot?: React.ReactNode }) => {
      expect(headerSlot).toBeUndefined();
      return <div data-testid="message-list" />;
    },
  };
});

it("renders SessionToolbar above MessageList and stops injecting global controls into message headers", () => {
  renderPanel();
  expect(screen.getByTestId("session-toolbar")).toBeTruthy();
  expect(screen.getByTestId("message-list")).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run components/__tests__/CharacterChatPanel.layout.test.tsx components/__tests__/CharacterChatPanel.streaming.test.tsx`
Expected: FAIL because `CharacterChatPanel` still injects `renderHeaderSlot` and does not render `SessionToolbar`.

**Step 3: Write minimal implementation**

```tsx
const swipe = lastAssistant?.swipe;
const swipeLabel = swipe && swipe.total > 1 ? `${swipe.activeIndex + 1}/${swipe.total}` : null;

return (
  <div className="flex h-full min-h-0 max-h-screen flex-col">
    <SessionToolbar
      currentModel={apiConfig.currentModel || t("modelSettings.noConfigs")}
      streamingEnabled={streamingEnabled}
      fastModelEnabled={Boolean(activeModes.fastModel)}
      swipeLabel={swipeLabel}
      t={t}
      apiSelector={<ApiSelector ... />}
      modeControls={<MessageHeaderControls ... />}
      swipeControls={showSwipeControls ? <SwipeControls ... /> : null}
    />

    <MessageList
      ...
      renderHeaderSlot={undefined}
    />

    <ChatInput ... />
  </div>
);
```

Do not leave any session-level controls inside `MessageHeader`.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run components/__tests__/CharacterChatPanel.layout.test.tsx components/__tests__/CharacterChatPanel.streaming.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/CharacterChatPanel.tsx components/__tests__/CharacterChatPanel.layout.test.tsx components/__tests__/CharacterChatPanel.streaming.test.tsx
git commit -m "refactor: move session controls into toolbar"
```

### Task 3: Restore scroll anchoring and add a “jump to latest” affordance

**Files:**
- Modify: `components/character-chat/MessageList.tsx`
- Create: `components/__tests__/MessageList.scroll.test.tsx`

**Step 1: Write the failing test**

```tsx
it("does not force-scroll when the reader is away from the bottom", () => {
  const scrollTo = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { value: scrollTo, configurable: true });

  const rendered = renderMessageList({
    initialMetrics: { scrollHeight: 2000, clientHeight: 600, scrollTop: 200 },
  });

  rendered.rerender({
    messages: [...baseMessages, { id: "m-new", role: "assistant", content: "new" }],
  });

  expect(scrollTo).not.toHaveBeenCalled();
  expect(rendered.container.textContent).toContain("跳到最新");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run components/__tests__/MessageList.scroll.test.tsx`
Expected: FAIL because `MessageList` always calls `scrollToBottom` on message changes.

**Step 3: Write minimal implementation**

```tsx
const [showJumpToLatest, setShowJumpToLatest] = useState(false);
const shouldStickToBottomRef = useRef(true);

const handleScroll = useCallback(() => {
  const el = scrollRef.current;
  if (!el) return;
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
  shouldStickToBottomRef.current = distance < 120;
  setShowJumpToLatest(!shouldStickToBottomRef.current);
}, []);

useEffect(() => {
  if (shouldStickToBottomRef.current) {
    scrollToBottom();
    setShowJumpToLatest(false);
  } else {
    setShowJumpToLatest(true);
  }
}, [messages, scrollToBottom]);
```

Render a persistent button near the bottom-right of the timeline that calls `scrollToBottom()` and resets `showJumpToLatest`.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run components/__tests__/MessageList.scroll.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/character-chat/MessageList.tsx components/__tests__/MessageList.scroll.test.tsx
git commit -m "fix: preserve reader position in message list"
```

### Task 4: Rebuild the composer around label, status text, and send/stop states

**Files:**
- Modify: `components/character-chat/ChatInput.tsx`
- Modify: `components/__tests__/ChatInput.test.tsx`
- Modify: `components/CharacterChatPanel.tsx`
- Modify: `app/session/session-page-layout.tsx`
- Modify: `app/session/use-session-page-actions.ts`
- Modify: `hooks/useCharacterDialogue.ts`
- Modify: `lib/store/dialogue-store/types.ts`
- Modify: `lib/store/dialogue-store/index.ts`
- Modify: `lib/store/dialogue-store/actions/generation-actions.ts`
- Modify: `lib/store/dialogue-store/actions/generation-request-runtime.ts`
- Test: `lib/store/__tests__/dialogue-status-state.test.ts`
- Test: `components/__tests__/CharacterChatPanel.streaming.test.tsx`

**Step 1: Write the failing tests**

```tsx
it("renders a visible label and helper text for the chat input", () => {
  const rendered = renderChatInput();
  expect(rendered.container.textContent).toContain("characterChat.inputLabel");
  expect(rendered.container.querySelector("label[for='send_textarea']")).not.toBeNull();
});

it("shows a stop button instead of a spinner while sending", () => {
  const rendered = renderChatInput({ isSending: true, onStop: vi.fn() });
  expect(rendered.container.textContent).toContain("characterChat.stopGenerating");
});
```

```ts
it("exposes a stopGeneration action while a dialogue is sending", async () => {
  const store = useDialogueStore.getState();
  expect(typeof store.stopGeneration).toBe("function");
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run components/__tests__/ChatInput.test.tsx lib/store/__tests__/dialogue-status-state.test.ts components/__tests__/CharacterChatPanel.streaming.test.tsx`
Expected: FAIL because `ChatInput` has no label / stop state and the dialogue store exposes no stop action.

**Step 3: Write minimal implementation**

```tsx
interface ChatInputProps {
  ...
  statusText?: string;
  onStop?: () => void;
}

<label htmlFor="send_textarea" className="text-sm font-medium text-foreground">
  {t("characterChat.inputLabel")}
</label>
<p id="chat-input-help" className="text-xs text-muted-foreground">
  {statusText || t("characterChat.inputHelp")}
</p>
<input aria-describedby="chat-input-help" ... />
```

```tsx
function SubmitButton({ isSending, onStop, label, stopLabel }: SubmitButtonProps) {
  if (isSending) {
    return (
      <Button type="button" variant="outline" onClick={onStop}>
        {stopLabel}
      </Button>
    );
  }
  return <Button type="submit">{label}</Button>;
}
```

```ts
export interface DialogueStore {
  ...
  stopGeneration: (dialogueKey: string) => Promise<void>;
}
```

Use the existing streaming runtime to register an abort controller per `dialogueKey`, then clear `isSending` when `stopGeneration` aborts the active run.

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run components/__tests__/ChatInput.test.tsx lib/store/__tests__/dialogue-status-state.test.ts components/__tests__/CharacterChatPanel.streaming.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/character-chat/ChatInput.tsx components/__tests__/ChatInput.test.tsx components/CharacterChatPanel.tsx app/session/session-page-layout.tsx app/session/use-session-page-actions.ts hooks/useCharacterDialogue.ts lib/store/dialogue-store/types.ts lib/store/dialogue-store/index.ts lib/store/dialogue-store/actions/generation-actions.ts lib/store/dialogue-store/actions/generation-request-runtime.ts lib/store/__tests__/dialogue-status-state.test.ts components/__tests__/CharacterChatPanel.streaming.test.tsx
git commit -m "feat: add accessible composer send and stop states"
```

### Task 5: Move advanced tools into a drawer/sheet and remove the persistent tool rail

**Files:**
- Create: `components/character-chat/AdvancedToolsDrawer.tsx`
- Modify: `components/character-chat/ChatInput.tsx`
- Modify: `components/character-chat/ControlPanel.tsx`
- Modify: `components/character-chat/index.ts`
- Modify: `components/character-chat/README.md`
- Create: `components/__tests__/AdvancedToolsDrawer.test.tsx`
- Modify: `components/__tests__/ChatInput.test.tsx`

**Step 1: Write the failing test**

```tsx
it("opens advanced tools from a single trigger instead of rendering a horizontal tool rail", () => {
  const rendered = renderChatInput(<div data-testid="tool-panel">tool</div>);
  expect(rendered.container.querySelector("[data-chat-tool-rail='true']")).toBeNull();
  expect(rendered.container.textContent).toContain("characterChat.advancedTools");
});
```

```tsx
it("renders advanced tools inside a dialog-backed sheet", () => {
  render(<AdvancedToolsDrawer open onOpenChange={vi.fn()}><div>tool</div></AdvancedToolsDrawer>);
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByText("tool")).toBeTruthy();
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run components/__tests__/AdvancedToolsDrawer.test.tsx components/__tests__/ChatInput.test.tsx`
Expected: FAIL because the current composer still renders the horizontal tool rail.

**Step 3: Write minimal implementation**

```tsx
export default function AdvancedToolsDrawer({ open, onOpenChange, children }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg sm:rounded-lg md:top-auto md:bottom-4 md:translate-y-0">
        <DialogTitle>高级工具</DialogTitle>
        <div className="max-h-[70dvh] overflow-y-auto">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
```

```tsx
const [advancedToolsOpen, setAdvancedToolsOpen] = useState(false);
<Button type="button" variant="outline" onClick={() => setAdvancedToolsOpen(true)}>
  {t("characterChat.advancedTools")}
</Button>
<AdvancedToolsDrawer open={advancedToolsOpen} onOpenChange={setAdvancedToolsOpen}>
  {children}
</AdvancedToolsDrawer>
```

Update `ControlPanel` so it renders plain content blocks inside the drawer instead of positioning itself absolutely above the composer.

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run components/__tests__/AdvancedToolsDrawer.test.tsx components/__tests__/ChatInput.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/character-chat/AdvancedToolsDrawer.tsx components/character-chat/ChatInput.tsx components/character-chat/ControlPanel.tsx components/character-chat/index.ts components/character-chat/README.md components/__tests__/AdvancedToolsDrawer.test.tsx components/__tests__/ChatInput.test.tsx
git commit -m "refactor: move advanced chat tools into drawer"
```

### Task 6: Strengthen message hierarchy and message-level accessibility

**Files:**
- Modify: `components/character-chat/MessageItem.tsx`
- Modify: `components/character-chat/ApiSelector.tsx`
- Modify: `components/character-chat/MessageHeaderControls.tsx`
- Create: `components/__tests__/MessageItem.accessibility.test.tsx`

**Step 1: Write the failing test**

```tsx
it("renders user messages inside a distinct bubble and upgrades icon actions to 44px targets", () => {
  const { container } = renderMessageItem({ role: "user", content: "hello" });
  expect(container.querySelector("[data-user-message-bubble='true']")).not.toBeNull();

  const buttons = Array.from(container.querySelectorAll("button"));
  buttons.forEach((button) => {
    expect(button.getAttribute("aria-label")).toBeTruthy();
    expect(button.className).toContain("h-11");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run components/__tests__/MessageItem.accessibility.test.tsx`
Expected: FAIL because the current user message has no bubble marker and icon buttons are still `h-6 w-6`.

**Step 3: Write minimal implementation**

```tsx
<div className="flex justify-end mb-4">
  <div
    data-user-message-bubble="true"
    className="max-w-md rounded-2xl border border-border bg-card px-4 py-3 text-card-foreground"
  >
    <p className={serifFontClass} dangerouslySetInnerHTML={{ __html: extractedContent }} />
  </div>
</div>
```

```tsx
<Button
  variant="outline"
  size="icon"
  aria-label={tooltip}
  className="h-11 w-11 rounded-full"
>
  {icon}
</Button>
```

Upgrade `ApiSelector` and `MessageHeaderControls` to use the same minimum target size and visible focus styling. Remove hover-only tooltip dependence; keep hover text as enhancement, not the sole affordance.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run components/__tests__/MessageItem.accessibility.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/character-chat/MessageItem.tsx components/character-chat/ApiSelector.tsx components/character-chat/MessageHeaderControls.tsx components/__tests__/MessageItem.accessibility.test.tsx
git commit -m "feat: improve message hierarchy and action accessibility"
```

### Task 7: Add reduced-motion and interaction-size defaults to shared UI tokens

**Files:**
- Modify: `components/ui/button.tsx`
- Modify: `app/globals.css`
- Create: `components/__tests__/Button.accessibility.test.tsx`

**Step 1: Write the failing test**

```tsx
it("keeps icon buttons at touch-friendly size and preserves focus-visible styles", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(<Button size="icon" aria-label="icon">X</Button>);
  });
  const button = container.querySelector("button");
  expect(button?.className).toContain("h-11");
  expect(button?.className).toContain("focus-visible:ring-2");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run components/__tests__/Button.accessibility.test.tsx`
Expected: FAIL because `size="icon"` is still `h-10 w-10`.

**Step 3: Write minimal implementation**

```tsx
size: {
  default: "min-h-11 px-4 py-2",
  sm: "min-h-10 rounded-md px-3",
  lg: "min-h-12 rounded-md px-8",
  icon: "h-11 w-11",
}
```

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Do not remove meaningful focus states while touching the shared button tokens.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run components/__tests__/Button.accessibility.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/ui/button.tsx app/globals.css components/__tests__/Button.accessibility.test.tsx
git commit -m "feat: add interaction size and reduced motion defaults"
```

### Task 8: Simplify shell IA and fix initial language/theme hydration

**Files:**
- Modify: `components/layout/LeftNav.tsx`
- Modify: `components/layout/TopBar.tsx`
- Modify: `components/layout/README.md`
- Modify: `app/layout.tsx`
- Modify: `app/i18n/LanguageProvider.tsx`
- Modify: `contexts/ThemeContext.tsx`
- Create: `components/__tests__/TopBar.navigation.test.tsx`

**Step 1: Write the failing test**

```tsx
it("renders only the condensed top-level nav groups", () => {
  render(<LeftNav isOpen={true} onClose={vi.fn()} />);
  expect(screen.getByText("首页")).toBeTruthy();
  expect(screen.getByText("会话")).toBeTruthy();
  expect(screen.getByText("角色")).toBeTruthy();
  expect(screen.getByText("设置")).toBeTruthy();
  expect(screen.queryByText("标签颜色")).toBeNull();
});
```

```tsx
it("hydrates the language toggle without swapping labels after mount", () => {
  render(<TopBar onToggleNav={vi.fn()} />);
  expect(screen.getByLabelText("切换语言")).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run components/__tests__/TopBar.navigation.test.tsx`
Expected: FAIL because the shell still exposes the wide nav tree and hydration-sensitive language state.

**Step 3: Write minimal implementation**

```tsx
const NAV_GROUPS: NavGroup[] = [
  { label: "主导航", items: [...] },
  { label: "设置", items: [...] },
];
```

```tsx
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};
```

```tsx
const initialLanguage = DEFAULT_LANGUAGE;
const [hydrated, setHydrated] = useState(false);
useEffect(() => {
  setHydrated(true);
  setLanguageValue(getClientLanguage());
}, [setLanguageValue]);
```

Align the initial HTML `lang`/`data-theme` with the same server-safe defaults used by the providers, then update after hydration without rendering mismatched labels.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run components/__tests__/TopBar.navigation.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/layout/LeftNav.tsx components/layout/TopBar.tsx components/layout/README.md app/layout.tsx app/i18n/LanguageProvider.tsx contexts/ThemeContext.tsx components/__tests__/TopBar.navigation.test.tsx
git commit -m "refactor: simplify shell navigation and hydration defaults"
```

### Task 9: Unify entry pages and Persona progressive disclosure

**Files:**
- Modify: `components/HomeContent.tsx`
- Modify: `components/home/SessionList.tsx`
- Modify: `app/character-cards/page.tsx`
- Modify: `app/personas/page.tsx`
- Modify: `components/PersonaEditor.tsx`
- Create: `components/__tests__/HomeContent.empty-state.test.tsx`
- Create: `components/__tests__/PersonaEditor.progressive-disclosure.test.tsx`

**Step 1: Write the failing tests**

```tsx
it("shows primary and secondary CTAs in the home empty state", () => {
  render(<SessionList sessions={[]} ... />);
  expect(screen.getByText(/新建会话|New Session/)).toBeTruthy();
  expect(screen.getByText(/导入角色|Import Character/)).toBeTruthy();
  expect(screen.getByText(/创建 Persona|Create Persona/)).toBeTruthy();
});
```

```tsx
it("keeps Persona advanced fields collapsed by default", () => {
  render(<PersonaEditor onSave={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.queryByText(/Injection Position|注入位置/)).toBeNull();
  expect(screen.getByRole("button", { name: /高级设置|Advanced Settings/ })).toBeTruthy();
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run components/__tests__/HomeContent.empty-state.test.tsx components/__tests__/PersonaEditor.progressive-disclosure.test.tsx`
Expected: FAIL because the current empty states and Persona editor do not match the new IA.

**Step 3: Write minimal implementation**

```tsx
function EmptyState() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <h2>开始你的第一场故事</h2>
      <p>先创建会话，或先导入角色 / Persona。</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button>新建会话</Button>
        <Button variant="outline">导入角色</Button>
        <Button variant="ghost">创建 Persona</Button>
      </div>
    </div>
  );
}
```

```tsx
const [advancedOpen, setAdvancedOpen] = useState(false);
<Button type="button" variant="outline" onClick={() => setAdvancedOpen((prev) => !prev)}>
  {language === "zh" ? "高级设置" : "Advanced Settings"}
</Button>
{advancedOpen ? <AdvancedFields ... /> : null}
```

Make page headers consistent: title, supporting copy, primary CTA on the right, and an empty state that always tells the user what to do next.

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run components/__tests__/HomeContent.empty-state.test.tsx components/__tests__/PersonaEditor.progressive-disclosure.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/HomeContent.tsx components/home/SessionList.tsx app/character-cards/page.tsx app/personas/page.tsx components/PersonaEditor.tsx components/__tests__/HomeContent.empty-state.test.tsx components/__tests__/PersonaEditor.progressive-disclosure.test.tsx
git commit -m "feat: unify entry page empty states and persona setup"
```

### Task 10: Final verification and documentation sync

**Files:**
- Modify: `docs/plans/2026-03-20-conversation-ui-optimization-design.md`
- Modify: `components/character-chat/README.md`
- Modify: `components/layout/README.md`
- Modify: `components/home/README.md`

**Step 1: Write the verification checklist update**

```md
## Verification Log

- `pnpm vitest run ...`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm verify:stage`
```

**Step 2: Run targeted tests first**

Run:

```bash
pnpm vitest run \
  components/__tests__/SessionToolbar.test.tsx \
  components/__tests__/CharacterChatPanel.layout.test.tsx \
  components/__tests__/CharacterChatPanel.streaming.test.tsx \
  components/__tests__/MessageList.scroll.test.tsx \
  components/__tests__/ChatInput.test.tsx \
  components/__tests__/AdvancedToolsDrawer.test.tsx \
  components/__tests__/MessageItem.accessibility.test.tsx \
  components/__tests__/Button.accessibility.test.tsx \
  components/__tests__/TopBar.navigation.test.tsx \
  components/__tests__/HomeContent.empty-state.test.tsx \
  components/__tests__/PersonaEditor.progressive-disclosure.test.tsx
```

Expected: PASS.

**Step 3: Run full repository verification**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm verify:stage
```

Expected: all commands PASS.

**Step 4: Update docs to match shipped structure**

Document the new `SessionToolbar`, `AdvancedToolsDrawer`, scroll behavior, and page CTA/empty-state rules in the relevant READMEs and append the verification results to the design doc.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-20-conversation-ui-optimization-design.md components/character-chat/README.md components/layout/README.md components/home/README.md
git commit -m "docs: record conversation ui optimization verification"
```
