# Session Gallery Object URL Lifecycle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Limit `/session` gallery object URLs to a single dialog lifetime and revoke them when the dialog closes.

**Architecture:** Replace the module-level avatar URL cache with structured gallery items that explicitly mark ephemeral object URLs. Keep `/list-gallery` returning strings for slash consumers, while `SessionGalleryDialog` owns cleanup for dialog-scoped temporary URLs.

**Tech Stack:** TypeScript, React, Next.js, Vitest

---

### Task 1: Write the failing tests

**Files:**
- Modify: `app/session/__tests__/session-gallery.test.ts`
- Modify: `components/__tests__/CharacterChatPanel.bridge.test.tsx` or add a focused gallery dialog test if that is the shortest path

**Step 1: Write the failing test for structured gallery items**

- Update the gallery test to expect a structured item for local avatars:
  - `src` equals the generated object URL
  - `ephemeral` is `true`

**Step 2: Write the failing test for dialog cleanup**

- Render the gallery dialog with one temporary `blob:` item and one permanent remote item.
- Close the dialog.
- Assert that only the temporary URL is passed to `URL.revokeObjectURL(...)`.

**Step 3: Run tests to verify they fail**

Run: `pnpm vitest run app/session/__tests__/session-gallery.test.ts components/__tests__/CharacterChatPanel.bridge.test.tsx`

Expected: the new assertions fail before implementation.

### Task 2: Implement the minimal lifecycle fix

**Files:**
- Modify: `app/session/session-gallery.ts`
- Modify: `app/session/session-host-actions.ts`
- Modify: `app/session/session-chat-view.tsx`
- Modify: `components/session-gallery/SessionGalleryDialog.tsx`

**Step 1: Add structured gallery item support**

- Introduce a `SessionGalleryItem` type in `session-gallery.ts`
- Return `Promise<SessionGalleryItem[]>`
- Mark local avatar object URLs as `ephemeral: true`
- Mark permanent URLs as `ephemeral: false`

**Step 2: Preserve slash output shape**

- In `session-host-actions.ts`, keep `handleListGallery()` returning `string[]` by mapping `item.src`
- Keep `handleShowGallery()` returning the structured items for the dialog path

**Step 3: Revoke object URLs on dialog close**

- Update the dialog props to accept structured items
- On close, revoke every `ephemeral` URL exactly once, then forward the close callback

**Step 4: Run targeted tests**

Run: `pnpm vitest run app/session/__tests__/session-gallery.test.ts components/__tests__/CharacterChatPanel.bridge.test.tsx app/session/__tests__/page.slash-integration.test.tsx`

Expected: targeted tests pass with no regressions.

### Task 3: Verify repository health

**Files:**
- No additional code expected

**Step 1: Run stage verification**

Run: `pnpm verify:stage`

Expected: lint, typecheck, vitest, and build all pass.
