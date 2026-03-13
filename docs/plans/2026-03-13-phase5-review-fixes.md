# Phase 5 Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the three Phase 5 review regressions in `/session` host behavior and host-debug observability.

**Architecture:** Keep the fixes narrow and local. Normalize gallery avatar outputs into renderable URLs at the data layer, restore strict `/yt-script` input validation to YouTube-only targets, and align host-capability alias matching with the slash registry so debug output reflects real command execution.

**Tech Stack:** Next.js, React, TypeScript, Vitest

---

### Task 1: Lock the regressions with failing tests

**Files:**
- Modify: `app/session/__tests__/session-gallery.test.ts`
- Modify: `app/session/__tests__/session-host-defaults.test.ts`
- Modify: `hooks/script-bridge/__tests__/host-capability-matrix.test.ts`

**Step 1: Write the failing tests**

- Add a gallery test that uses a local avatar key and expects a resolved `blob:` URL instead of the raw key.
- Add a `/yt-script` test that passes a non-YouTube URL and expects fail-fast.
- Add host-capability matcher tests for member-command aliases supported by the slash registry.

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run app/session/__tests__/session-gallery.test.ts app/session/__tests__/session-host-defaults.test.ts hooks/script-bridge/__tests__/host-capability-matrix.test.ts`

Expected: new assertions fail for the current implementation.

### Task 2: Implement the minimal fixes

**Files:**
- Modify: `app/session/session-gallery.ts`
- Modify: `app/session/session-host-actions.ts`
- Modify: `app/session/session-host-defaults.ts`
- Modify: `hooks/script-bridge/host-capability-matrix.ts`

**Step 1: Fix gallery avatar normalization**

- Make `session-gallery.ts` resolve local avatar blob keys into object URLs.
- Update `session-host-actions.ts` to await the async gallery helper and return normalized items.

**Step 2: Tighten `/yt-script` URL validation**

- Restrict normalized URLs to YouTube hosts and IDs only.
- Keep short URL and shorts normalization behavior intact.

**Step 3: Cover member aliases in capability matching**

- Add the missing aliases already registered in the slash registry to `host-capability-matrix.ts`.

**Step 4: Run targeted tests**

Run: `pnpm vitest run app/session/__tests__/session-gallery.test.ts app/session/__tests__/session-host-defaults.test.ts hooks/script-bridge/__tests__/host-capability-matrix.test.ts`

Expected: all targeted tests pass.

### Task 3: Verify the branch cleanly

**Files:**
- No code changes expected

**Step 1: Run stage verification**

Run: `pnpm verify:stage`

Expected: lint, typecheck, vitest, and build all pass.
