# Dialogue Summary Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Inject a persistent dialogue summary into long-running conversations so older turns survive context trimming.

**Architecture:** Add a dialogue-summary runtime module that derives a stable summary from the current branch, preferring per-turn `compressedContent` and falling back to deterministic compact summaries. Inject the summary as a system message before model invocation and refresh the cache after each successful assistant response.

**Tech Stack:** TypeScript, Vitest, existing dialogue tree storage, `localStorage`, prompt assembly pipeline.

---

### Task 1: Add failing summary tests

**Files:**
- Create: `function/dialogue/__tests__/dialogue-summary.test.ts`
- Create: `lib/nodeflow/__tests__/preset-summary-injection.test.ts`

**Step 1:** Write a failing pure test for summary derivation from `compressedContent`.
**Step 2:** Write a failing integration test showing prompt framework injection.
**Step 3:** Run the targeted tests and confirm they fail.

### Task 2: Implement summary runtime module

**Files:**
- Create: `function/dialogue/dialogue-summary.ts`

**Step 1:** Derive current-branch messages and preserved recent window.
**Step 2:** Prefer per-turn `compressedContent`, fallback to compact deterministic summaries.
**Step 3:** Add `localStorage` persistence keyed by `dialogueKey`.

### Task 3: Inject summary into prompt assembly

**Files:**
- Modify: `lib/nodeflow/PresetNode/PresetNodeTools.ts`

**Step 1:** Load or rebuild summary for the current `dialogueKey`.
**Step 2:** Inject `[Story Summary]` as a system message before request send.

### Task 4: Refresh summary after assistant response

**Files:**
- Modify: `function/dialogue/chat-shared.ts`

**Step 1:** After node update succeeds, rebuild and persist summary state.
**Step 2:** Fail open if summary refresh throws.

### Task 5: Verify and gate

**Files:**
- Test: `function/dialogue/__tests__/dialogue-summary.test.ts`
- Test: `lib/nodeflow/__tests__/preset-summary-injection.test.ts`

**Step 1:** Run targeted Vitest files until green.
**Step 2:** Run `pnpm verify:stage`.
