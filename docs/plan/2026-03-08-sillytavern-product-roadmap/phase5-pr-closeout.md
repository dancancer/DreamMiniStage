# Phase 5 PR Closeout Checklist

## Current Facts

- Current branch: `codex/phase-5-js-slash-runner-host`
- Base branch: `main`
- Merge base: `c9812a1b5cdd583d5023cab3fc8d03a5e18dfe47`
- Fresh verification:
  - `pnpm verify:stage`
- Verification status: passed on `2026-03-13`
- PR status: unverified in current environment because `gh` CLI is missing

## Recommended Closeout Path

### 1. Freeze Phase 5 scope

Do not add more host capability areas on this branch.

Phase 5 already has:

- host capability matrix
- fail-fast semantics
- debugger visibility
- `/session` host wiring and shared default UI host closure

More commands now would be scope creep, not closeout.

### 2. Keep the deliverable set explicit

Core product/runtime files:

- `app/session/*`
- `components/CharacterChatPanel.tsx`
- `components/ScriptDebugPanel.tsx`
- `hooks/script-bridge/*`
- `hooks/useScriptBridge.ts`

Core documentation files:

- `docs/plan/2026-03-08-sillytavern-product-roadmap/tasks.md`
- `docs/plan/2026-03-08-sillytavern-product-roadmap/handoff.md`
- `docs/plan/2026-03-08-sillytavern-product-roadmap/phase5-host-capability-matrix.md`
- `docs/plan/2026-03-08-sillytavern-product-roadmap/phase5-review-result.md`
- `docs/plan/2026-03-08-sillytavern-product-roadmap/phase5-pr-closeout.md`
- `app/session/README.md`
- `hooks/script-bridge/README.md`

### 3. Recommended commit shape

Preferred split:

1. `feat(session): complete phase 5 host wiring and debugger paths`
   - session host wiring
   - shared default UI host
   - host-debug chain
   - matrix/resolver/runtime code
   - focused tests

2. `docs: close out phase 5 host review`
   - roadmap tasks/handoff
   - host capability matrix doc
   - phase5 review result
   - phase5 pr closeout

If you keep one PR commit series instead, maintain the same conceptual separation in the PR body.

### 4. Re-run the gate before final push

Run:

```bash
pnpm verify:stage
```

Only push after this final run still passes.

## Suggested PR Title

`feat(session): complete phase 5 JS-Slash-Runner host closure`

## Suggested PR Description

### Summary

- complete Phase 5 host capability closure for `/session` and the shared default UI host path
- add a single host capability truth table for default, conditional, and unsupported semantics
- make Script Debugger explain host source, support mode, and recent resolved host paths
- unify page-entered slash execution and iframe script bridge host-debug recording

### What Changed

- add and extend `/session` host modules for navigation, checkpoint, group member, timed world info, gallery, and slash execution
- split the bloated `/session` page into route state, effects, layout, dialogue actions, quick-reply adapter, and host-debug controller modules
- introduce shared default UI host implementations for popup, style, panel layout, theme, css vars, background, and chat close actions
- expand the host capability matrix and resolver so debugger output reflects real host semantics instead of raw API presence
- add focused regression coverage for session host wiring, slash executor behavior, host-debug resolution, and Script Debugger rendering

### Verification

- `pnpm verify:stage`

### Review Docs

- `docs/plan/2026-03-08-sillytavern-product-roadmap/phase5-review-result.md`
- `docs/plan/2026-03-08-sillytavern-product-roadmap/phase5-host-capability-matrix.md`

## Merge Gate

Phase 5 should be treated as fully closed only when all of the following are true:

- working tree is committed
- PR exists
- PR is merged into `main`
- next phase starts from a fresh `codex/` branch off latest `main`
