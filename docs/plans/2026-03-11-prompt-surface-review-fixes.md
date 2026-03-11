# Prompt Surface Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the three confirmed Phase 2 review regressions so Gemini honors stop strings, context-derived stop strings reach runtime requests, and `example_separator` / `chat_start` visibly affect the final prompt.

**Architecture:** Keep the existing prompt-config store and runtime flow intact, then patch the three missing links: pass stop strings through Gemini's real invocation path, derive runtime stops from the resolved context preset plus manual overrides, and make the prompt manager append separator markers at the example/history boundaries so the new context controls affect emitted messages without inventing a parallel formatting pipeline.

**Tech Stack:** TypeScript, Vitest, Zustand, Next.js, custom ST prompt manager/runtime.

---

### Task 1: Lock down the regressions with failing tests

**Files:**
- Modify: `lib/api/__tests__/backends.test.ts`
- Modify: `lib/prompt-config/__tests__/service.test.ts`
- Modify: `lib/core/__tests__/st-prompt-manager.test.ts` or `lib/nodeflow/__tests__/preset-node.test.ts`

**Step 1: Write the failing test**
- Add a Gemini-focused test that proves the real invocation path receives `stopStrings`.
- Add a runtime config test that proves context-derived stop strings are merged into `resolvePromptRuntimeConfig()`.
- Add a prompt-building test that proves changing `example_separator` / `chat_start` changes emitted messages.

**Step 2: Run test to verify it fails**
Run: `pnpm vitest run lib/api/__tests__/backends.test.ts lib/prompt-config/__tests__/service.test.ts lib/core/__tests__/st-prompt-manager.test.ts`
Expected: the new assertions fail on current code.

**Step 3: Commit**
```bash
git add lib/api/__tests__/backends.test.ts lib/prompt-config/__tests__/service.test.ts lib/core/__tests__/st-prompt-manager.test.ts
git commit -m "test: cover prompt surface review regressions"
```

### Task 2: Fix Gemini stop strings and runtime stop derivation

**Files:**
- Modify: `lib/nodeflow/LLMNode/model-invokers.ts`
- Modify: `lib/prompt-config/service.ts`
- Test: `lib/prompt-config/__tests__/service.test.ts`

**Step 1: Write minimal implementation**
- Pass `config.stopStrings` into both Gemini generation configs.
- Add a small helper that merges manual stop strings with context-derived names when `use_stop_strings` / `names_as_stop_strings` are enabled.

**Step 2: Run targeted tests**
Run: `pnpm vitest run lib/prompt-config/__tests__/service.test.ts function/dialogue/__tests__/chat-first-message.test.ts`
Expected: PASS.

**Step 3: Commit**
```bash
git add lib/nodeflow/LLMNode/model-invokers.ts lib/prompt-config/service.ts lib/prompt-config/__tests__/service.test.ts
git commit -m "fix: honor runtime stop strings across prompt backends"
```

### Task 3: Make context separators affect emitted prompt messages

**Files:**
- Modify: `lib/core/prompt/manager.ts`
- Modify: `lib/nodeflow/PresetNode/PresetNodeTools.ts` (only if boundary data must be threaded)
- Test: `lib/core/__tests__/st-prompt-manager.test.ts` or `lib/nodeflow/__tests__/preset-node.test.ts`

**Step 1: Write minimal implementation**
- Reuse the resolved context preset already held by `STPromptManager`.
- Insert `example_separator` between adjacent example-style prompt segments.
- Insert `chat_start` at the boundary before chat history/current user input so the control changes final messages.
- Keep behavior data-driven and avoid new special-case branches beyond the boundary helper.

**Step 2: Run targeted tests**
Run: `pnpm vitest run lib/core/__tests__/st-prompt-manager.test.ts lib/nodeflow/__tests__/preset-node.test.ts`
Expected: PASS.

**Step 3: Commit**
```bash
git add lib/core/prompt/manager.ts lib/nodeflow/PresetNode/PresetNodeTools.ts lib/core/__tests__/st-prompt-manager.test.ts lib/nodeflow/__tests__/preset-node.test.ts
git commit -m "fix: apply context separators in prompt output"
```

### Task 4: Full regression verification

**Files:**
- Verify only

**Step 1: Run focused regression suite**
Run: `pnpm vitest run lib/api/__tests__/backends.test.ts lib/prompt-config/__tests__/service.test.ts lib/core/__tests__/st-prompt-manager.test.ts lib/nodeflow/__tests__/preset-node.test.ts function/dialogue/__tests__/chat-first-message.test.ts lib/slash-command/__tests__/p3-profile-prompt-command-gaps.test.ts lib/slash-command/__tests__/p3-context-clipboard-command-gaps.test.ts lib/slash-command/__tests__/p3-stop-model-member-command-gaps.test.ts app/session/__tests__/page.slash-integration.test.tsx`
Expected: PASS.

**Step 2: Run stage gate**
Run: `pnpm verify:stage`
Expected: PASS.

**Step 3: Commit**
```bash
git add -A
git commit -m "fix: close phase 2 prompt surface review gaps"
```
