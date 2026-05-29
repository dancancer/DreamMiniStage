# POC-4.4 WorldModule Activation State Slice

## Purpose

Verify that `sticky`, `cooldown` and `delay` are carried in session activation state instead of mutating static `WorldModule` entries.

## Command

```bash
pnpm vitest run lib/story-agent/runtime/__tests__/phase4-runtime.test.ts
```

## Expected Output

The test uses a synthetic compiled `WorldModule` with three entries:

- `sticky`: primary key `alpha`, `sticky = 2`
- `cooldown`: primary key `beta`, `cooldown = 2`
- `delayed`: primary key `later`, `delay = 1`

Required assertions:

- first turn hits direct keyword entries
- activation state contains `stateful:sticky`, `stateful:cooldown`, `stateful:delayed`
- second turn hits `sticky` and `delayed`
- third turn does not re-hit `cooldown` while cooldown state is still active

## Result

- Status: `partial pass`
- Date: `2026-05-29`
- Evidence: `matchWorldModules()` and `phase4-runtime.test.ts`

## Decision

Keep static world definitions immutable. Activation counters belong to `StorySession.worldbookActivationState` in `SAC-Phase 6a`.

## Remaining For Full POC-4.4

The full task also requires recursion behavior coverage. That remains open in `tasks.md`.
