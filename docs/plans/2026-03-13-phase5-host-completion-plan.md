# Phase 5 Host Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the remaining Phase 5 work by establishing a full host capability truth table, then filling the next real product-path gaps in priority order.

**Architecture:** Treat the host capability matrix as the single source of truth for support status, debugger visibility, and host-path reasoning. After the matrix is complete, use it to pick the next highest-value host slices that already have partial `/session` wiring but lack explicit classification or debugger coverage.

**Tech Stack:** TypeScript, Next.js App Router, Vitest, Zustand, existing script-bridge host debug modules.

---

### Task 1: Complete the host capability matrix

**Files:**
- Modify: `hooks/script-bridge/host-capability-matrix.ts`
- Modify: `hooks/script-bridge/host-debug-resolver.ts`
- Modify: `hooks/script-bridge/__tests__/host-capability-matrix.test.ts`
- Modify: `hooks/script-bridge/__tests__/host-debug-resolver.test.ts`

**Step 1: Write the failing test**

Add assertions for the next high-value `/session` host areas that are already real but still missing from the matrix:
- navigation (`/tempchat`, `/floor-teleport`)
- proxy preset (`/proxy`)
- quick reply execution (`/qr`)
- checkpoint (`/checkpoint-*`)
- group member (`/member-*`, `/enable`, `/disable`)
- translation (`/translate`)
- YouTube transcript (`/yt-script`)
- timed world info (`/wi-*`)

**Step 2: Run the targeted tests to verify they fail**

Run: `pnpm vitest run hooks/script-bridge/__tests__/host-capability-matrix.test.ts hooks/script-bridge/__tests__/host-debug-resolver.test.ts`

Expected: FAIL because the matrix still only covers the first batch areas.

**Step 3: Implement the minimal matrix expansion**

- Add the missing capability areas and entries.
- Map the relevant slash commands to those entries.
- Keep `default / conditional / fail-fast / unsupported` semantics explicit.
- Only add runtime source keys where multiple host paths actually exist.

**Step 4: Run the targeted tests to verify they pass**

Run: `pnpm vitest run hooks/script-bridge/__tests__/host-capability-matrix.test.ts hooks/script-bridge/__tests__/host-debug-resolver.test.ts`

Expected: PASS.

### Task 2: Surface the completed matrix in the debugger and docs

**Files:**
- Modify: `components/ScriptDebugPanel.tsx`
- Modify: `hooks/script-bridge/README.md`
- Modify: `docs/plan/2026-03-08-sillytavern-product-roadmap/handoff.md`
- Modify: `docs/plan/2026-03-08-sillytavern-product-roadmap/tasks.md`

**Step 1: Write the failing test**

Add or extend a UI-level test so the debugger must show the new capability entries in a stable, reviewable way.

**Step 2: Run the targeted test to verify it fails**

Run the related Vitest file for `ScriptDebugPanel`.

**Step 3: Implement the smallest debugger improvement**

- Make the capability cards readable enough for review.
- Keep data-driven rendering; do not add per-area special cases.
- Update docs so Phase 5 status is derived from the same matrix language.

**Step 4: Run tests and docs sanity checks**

Run the related Vitest file plus `pnpm lint`.

### Task 3: Execute the next product-path slice chosen by the completed matrix

**Files:**
- To be selected from the completed matrix and debugger evidence.
- Prefer `/session` host slices that are high-value and already partially wired, but still lack explicit product-path closure.

**Step 1: Pick the highest-value remaining gap**

Use the completed matrix to choose the next slice by this order:
1. real user path exists but support state is still ambiguous
2. debugger cannot explain the path clearly
3. command already has tests or partial host wiring

**Step 2: Write the failing test**

Target a single host slice and prove the current gap.

**Step 3: Implement the minimum closure**

Do not broaden scope. Close one host slice cleanly.

**Step 4: Run focused tests, then full stage gate**

Run targeted Vitest first, then `pnpm verify:stage`.
