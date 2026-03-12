# Phase 5 Clipboard And Extension Host Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add trustworthy `/session` default host support for clipboard and extension-state reads, keep extension writes explicitly conditional, and keep the host-debug surface aligned with the real host path.

**Architecture:** Extend the `/session` host bridge contract, add default clipboard and extension-state implementations in the session host defaults layer, merge them through `page.tsx`, and verify that slash commands plus host-debug observations resolve to `session-default`, `api-context`, or `fail-fast` with no hidden fallback branch.

**Tech Stack:** TypeScript, React 19, Next.js App Router, Vitest, Testing Library.

---

### Task 1: Lock the `/session` host contract with failing tests

**Files:**
- Modify: `app/session/__tests__/session-host-bridge.test.ts`
- Modify: `app/session/session-host-bridge.ts`

**Step 1: Write the failing test**

Add assertions that the `/session` host bridge contract now exposes:

- `getClipboardText`
- `setClipboardText`
- `isExtensionInstalled`
- `getExtensionEnabledState`
- `setExtensionEnabled`

Also assert `buildSessionSlashHostBridgeDetail()` returns the canonical window paths for the new methods.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run app/session/__tests__/session-host-bridge.test.ts`
Expected: FAIL because the contract does not declare the new methods yet.

**Step 3: Write minimal implementation**

- Extend `SessionSlashHostBridge` in `app/session/session-host-bridge.ts`
- Add canonical path assertions for the new methods

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run app/session/__tests__/session-host-bridge.test.ts`
Expected: PASS.

### Task 2: Add failing tests for default clipboard and extension-state host behavior

**Files:**
- Modify: `app/session/__tests__/page.slash-integration.test.tsx`
- Modify: `app/session/__tests__/session-host-defaults.test.ts`
- Modify: `app/session/session-host-defaults.ts`

**Step 1: Write the failing tests**

Add tests that prove:

- `/clipboard-get` and `/clipboard-set` use `/session` default host behavior when no injected host override exists
- injected clipboard host overrides win over default behavior
- `/extension-state` reads through `/session` default host behavior
- `/extension-toggle` still fail-fast when no trustworthy default write host exists

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run app/session/__tests__/session-host-defaults.test.ts app/session/__tests__/page.slash-integration.test.tsx`
Expected: FAIL because default clipboard / extension-state host behavior is not wired yet.

**Step 3: Write minimal implementation**

- Add default clipboard host behavior in `app/session/session-host-defaults.ts`
- Add default extension installed/enabled read behavior in `app/session/session-host-defaults.ts`
- Keep extension write behavior conditional unless a real host writer exists

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run app/session/__tests__/session-host-defaults.test.ts app/session/__tests__/page.slash-integration.test.tsx`
Expected: PASS.

### Task 3: Wire `/session` page host merge and keep slash adapter single-path

**Files:**
- Modify: `app/session/page.tsx`
- Modify: `hooks/script-bridge/slash-context-adapter.ts`
- Modify: `components/CharacterChatPanel.tsx` only if new props must be threaded

**Step 1: Write the failing integration check**

Keep the new page tests focused on:

- default path resolves when there is no injected host
- injected host overrides default path
- missing write host continues to fail-fast

Do not add speculative tests for unsupported write behavior.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx`
Expected: FAIL if the page host merge still misses the new capabilities.

**Step 3: Write minimal implementation**

- Merge default clipboard / extension-state capabilities into the `/session` host wiring
- Keep `slash-context-adapter.ts` as the only place that resolves host callbacks into execution context
- Avoid adding page-local fallback branches

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx`
Expected: PASS.

### Task 4: Extend host-debug coverage for clipboard and extension-state semantics

**Files:**
- Modify: `hooks/script-bridge/host-capability-matrix.ts`
- Modify: `hooks/script-bridge/host-debug-resolver.ts`
- Modify: `hooks/script-bridge/__tests__/host-debug-resolver.test.ts`
- Modify: `hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts`
- Modify: `components/__tests__/ScriptDebugPanel.test.tsx`

**Step 1: Write the failing tests**

Add assertions that:

- clipboard default path resolves to `session-default` when default host is active
- injected clipboard path resolves to `api-context`
- extension-state read resolves to `session-default`
- extension write without host writer resolves to `fail-fast`
- `ScriptDebugPanel` shows the updated semantics in recent API calls

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run hooks/script-bridge/__tests__/host-debug-resolver.test.ts hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts components/__tests__/ScriptDebugPanel.test.tsx`
Expected: FAIL because the host matrix / resolver do not yet encode the new default semantics.

**Step 3: Write minimal implementation**

- Update host capability metadata for clipboard / extension-state
- Record the new resolved paths through the existing host-debug state
- Keep the debugger structure unchanged; only feed new semantic data into it

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run hooks/script-bridge/__tests__/host-debug-resolver.test.ts hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts components/__tests__/ScriptDebugPanel.test.tsx`
Expected: PASS.

### Task 5: Sync roadmap docs after the code is green

**Files:**
- Modify: `docs/plan/2026-03-08-sillytavern-product-roadmap/handoff.md`
- Modify: `docs/plan/2026-03-08-sillytavern-product-roadmap/tasks.md`

**Step 1: Run focused verification**

Run: `pnpm vitest run app/session/__tests__/session-host-bridge.test.ts app/session/__tests__/session-host-defaults.test.ts app/session/__tests__/page.slash-integration.test.tsx hooks/script-bridge/__tests__/host-debug-resolver.test.ts hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts components/__tests__/ScriptDebugPanel.test.tsx`
Expected: PASS.

**Step 2: Update docs**

- Record clipboard default host support
- Record extension-state default read support
- Record that extension writes remain conditional / fail-fast by design

**Step 3: Commit**

```bash
git add docs/plan/2026-03-08-sillytavern-product-roadmap/handoff.md docs/plan/2026-03-08-sillytavern-product-roadmap/tasks.md
git commit -m "docs: record phase 5 clipboard and extension host progress"
```

### Task 6: Full verification

**Files:**
- Verify only

**Step 1: Run focused suite**

Run: `pnpm vitest run hooks/script-bridge/__tests__/host-capability-matrix.test.ts hooks/script-bridge/__tests__/host-debug-resolver.test.ts hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts components/__tests__/ScriptDebugPanel.test.tsx app/session/__tests__/session-host-bridge.test.ts app/session/__tests__/session-host-defaults.test.ts app/session/__tests__/page.slash-integration.test.tsx`
Expected: PASS.

**Step 2: Run full stage gate**

Run: `pnpm verify:stage`
Expected: PASS.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add phase 5 clipboard and extension host defaults"
```
