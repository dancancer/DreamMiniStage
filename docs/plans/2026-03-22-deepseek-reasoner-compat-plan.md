# DeepSeek Reasoner Compatibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a model-specific normalization path for `deepseek-reasoner` that preserves multi-turn messages while enforcing strict role ordering.

**Architecture:** Keep the existing generic prompt pipeline intact, then apply a narrow runtime-only normalization in `normalizeMessages()` when the target model is `deepseek-reasoner`. The normalization strips reasoning metadata, enforces strict start/user ordering, and logs prompt corrections without affecting non-DeepSeek models.

**Tech Stack:** TypeScript, Vitest, existing prompt post-processor utilities.

---

### Task 1: Add failing normalization tests

**Files:**
- Create: `lib/nodeflow/__tests__/runtime-helpers.test.ts`

**Step 1:** Write a failing test for `deepseek-reasoner` user-start normalization.
**Step 2:** Run `pnpm vitest run lib/nodeflow/__tests__/runtime-helpers.test.ts` and confirm failure.

### Task 2: Implement DeepSeek-specific normalization

**Files:**
- Modify: `lib/nodeflow/LLMNode/runtime-helpers.ts`

**Step 1:** Add model detection and metadata stripping helpers.
**Step 2:** Force `STRICT` post-processing for `deepseek-reasoner`.
**Step 3:** Add a compact normalization log only when corrections occur.

### Task 3: Verify targeted behavior

**Files:**
- Test: `lib/nodeflow/__tests__/runtime-helpers.test.ts`

**Step 1:** Run `pnpm vitest run lib/nodeflow/__tests__/runtime-helpers.test.ts`.
**Step 2:** If green, run prompt-related regression tests if needed.

### Task 4: Run repository gate

**Files:**
- None

**Step 1:** Run `pnpm verify:stage`.
**Step 2:** Record any unrelated failures instead of papering over them.
