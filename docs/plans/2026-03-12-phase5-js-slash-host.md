# Phase 5 JS-Slash-Runner Host Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Phase 5 batch 1 explicit by adding a host capability matrix, a fail-fast matrix, a minimal host-debug state path, and a stronger Script Debugger for the first `JS-Slash-Runner` capability slice.

**Architecture:** Keep the existing bridge capability matrix as the API-existence source, add a separate host-support source for product semantics, route a small set of runtime observations through dedicated helpers/store code, and render those observations in `ScriptDebugPanel` without inflating `app/session/page.tsx`.

**Tech Stack:** TypeScript, React 19, Next.js App Router, Zustand or local store helpers, Vitest, Testing Library.

---

### Task 1: Lock the host-support model with failing tests

**Files:**
- Create: `hooks/script-bridge/host-capability-matrix.ts`
- Create: `hooks/script-bridge/__tests__/host-capability-matrix.test.ts`
- Modify: `hooks/script-bridge/README.md`

**Step 1: Write the failing test**

Add tests that assert:

- the batch-1 capabilities `tool-registration`, `extension-state`, `clipboard`, and `audio` exist in the host matrix
- each capability declares a support level from `default | conditional | fail-fast | unsupported`
- capabilities that declare `fail-fast` also declare a stable reason

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run hooks/script-bridge/__tests__/host-capability-matrix.test.ts`
Expected: FAIL because the new host matrix module does not exist yet.

**Step 3: Write minimal implementation**

- create `host-capability-matrix.ts` with typed batch-1 capability entries
- document the new file in `hooks/script-bridge/README.md`

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run hooks/script-bridge/__tests__/host-capability-matrix.test.ts`
Expected: PASS.

### Task 2: Add runtime host-resolution helpers and red-green tests

**Files:**
- Create: `hooks/script-bridge/host-debug-state.ts`
- Create: `hooks/script-bridge/host-debug-resolver.ts`
- Create: `hooks/script-bridge/__tests__/host-debug-resolver.test.ts`

**Step 1: Write the failing test**

Add tests that prove:

- a capability can resolve to `/session` default support
- a capability can resolve to injected-host conditional support
- a capability can resolve to documented fail-fast output
- recent API call entries preserve `method`, `capability`, `resolvedPath`, `outcome`, and `timestamp`

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run hooks/script-bridge/__tests__/host-debug-resolver.test.ts`
Expected: FAIL because the resolver/debug state files do not exist yet.

**Step 3: Write minimal implementation**

- add a tiny host-debug state helper or store for recent observations
- add resolver helpers that map matrix entries plus runtime flags to debugger-facing data

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run hooks/script-bridge/__tests__/host-debug-resolver.test.ts`
Expected: PASS.

### Task 3: Wire the selected capability slice into host-debug observations

**Files:**
- Modify: `hooks/useScriptBridge.ts`
- Modify: `hooks/script-bridge/extension-handlers.ts`
- Modify: `hooks/script-bridge/audio-handlers.ts`
- Modify: `hooks/script-bridge/slash-context-adapter.ts`
- Test: `hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts`

**Step 1: Write the failing test**

Extend bridge-focused tests so they assert:

- selected API calls write recent host-debug observations
- tool registration updates runtime counters
- conditional host paths are distinguishable from default support
- fail-fast outcomes stay visible in debug state

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts`
Expected: FAIL because no host-debug observation path exists yet.

**Step 3: Write minimal implementation**

- record host-debug observations only for the batch-1 capability slice
- keep logic in helpers instead of adding ad-hoc branches across the page layer
- preserve existing bridge behavior while exposing debugger metadata

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts`
Expected: PASS.

### Task 4: Upgrade Script Debugger with host sections

**Files:**
- Modify: `components/ScriptDebugPanel.tsx`
- Create: `components/__tests__/ScriptDebugPanel.test.tsx`
- Modify: `components/character-chat/ControlPanel.tsx`

**Step 1: Write the failing test**

Add component tests that assert the panel renders:

- host capability badges for batch-1 capabilities
- recent API call rows with resolved path and outcome
- runtime counters for tool registrations / listeners / host overrides
- the existing script status list

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run components/__tests__/ScriptDebugPanel.test.tsx`
Expected: FAIL because the current panel only renders script status cards.

**Step 3: Write minimal implementation**

- extend the panel layout with the four sections from the design
- feed it the new debugger-facing host data
- keep the UI simple and dense; do not build a full inspector

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run components/__tests__/ScriptDebugPanel.test.tsx`
Expected: PASS.

### Task 5: Add `/session`-level integration coverage for default, conditional, and fail-fast host semantics

**Files:**
- Modify: `app/session/__tests__/session-host-bridge.test.ts`
- Modify: `app/session/__tests__/page.slash-integration.test.tsx`
- Modify: `app/test-script-runner/scenarios.ts`

**Step 1: Write the failing test**

Add focused assertions that prove the batch-1 capability slice is explainable in product terms:

- default support paths are recognized as default
- injected-host paths are recognized as conditional
- fail-fast paths surface the documented reason
- scenario metadata stays aligned with the new host semantics

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run app/session/__tests__/session-host-bridge.test.ts app/session/__tests__/page.slash-integration.test.tsx hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts`
Expected: FAIL on missing host-semantics assertions.

**Step 3: Write minimal implementation**

- reuse the host matrix and resolver from previous tasks
- keep session integration thin and data-driven
- update script-runner scenario descriptions only where they need to reference the new host semantics

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run app/session/__tests__/session-host-bridge.test.ts app/session/__tests__/page.slash-integration.test.tsx hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts`
Expected: PASS.

### Task 6: Full verification and roadmap sync

**Files:**
- Modify: `docs/plan/2026-03-08-sillytavern-product-roadmap/handoff.md`
- Modify: `docs/plan/2026-03-08-sillytavern-product-roadmap/tasks.md`

**Step 1: Run focused verification**

Run: `pnpm vitest run hooks/script-bridge/__tests__/host-capability-matrix.test.ts hooks/script-bridge/__tests__/host-debug-resolver.test.ts hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts components/__tests__/ScriptDebugPanel.test.tsx app/session/__tests__/session-host-bridge.test.ts app/session/__tests__/page.slash-integration.test.tsx`
Expected: PASS.

**Step 2: Run full stage gate**

Run: `pnpm verify:stage`
Expected: PASS.

**Step 3: Update roadmap docs**

- record the new host matrix, fail-fast matrix, debugger enhancement, and validated capability slice in `handoff.md`
- check off the completed Phase 5 batch-1 items in `tasks.md`
