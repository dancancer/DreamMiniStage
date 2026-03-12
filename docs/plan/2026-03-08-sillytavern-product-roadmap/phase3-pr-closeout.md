# Phase 3 PR Closeout Checklist

## Current Facts

- Current branch: `codex/phase-3-session-quickreply`
- Base branch: `main`
- Merge base: `f66bf5353c60284b6f359842e085ce64e0d76f13`
- Fresh verification:
  - `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx components/__tests__/QuickReplyPanel.test.tsx components/__tests__/GroupMemberPanel.test.tsx lib/quick-reply/__tests__/store.test.ts lib/group-chat/__tests__/store.test.ts lib/dialogue/__tests__/swipe-jsonl.test.ts app/session/__tests__/session-host-bridge.test.ts hooks/script-bridge/__tests__/message-handlers-compat.test.ts`
  - `pnpm verify:stage`
- Verification status: passed on `2026-03-12`
- PR status: unverified in current environment because `gh` CLI is not installed

## Working Tree Snapshot

### Product and tests

- `app/session/page.tsx`
- `app/session/__tests__/page.slash-integration.test.tsx`
- `components/quick-reply/QuickReplyPanel.tsx`
- `components/__tests__/QuickReplyPanel.test.tsx`
- `components/__tests__/GroupMemberPanel.test.tsx`
- `lib/group-chat/store.ts`
- `lib/group-chat/__tests__/store.test.ts`
- `lib/quick-reply/store.ts`
- `lib/quick-reply/__tests__/store.test.ts`
- `lib/dialogue/jsonl.ts`
- `lib/dialogue/__tests__/swipe-jsonl.test.ts`
- `lib/core/__tests__/trim-string-filter.property.test.ts`

### Docs and handoff

- `docs/CHAT_JSONL_IMPORT_EXPORT.md`
- `docs/plan/2026-03-08-sillytavern-product-roadmap/handoff.md`
- `docs/plan/2026-03-08-sillytavern-product-roadmap/tasks.md`
- `docs/plan/2026-03-08-sillytavern-product-roadmap/phase3-review-result.md`
- `docs/plan/2026-03-08-sillytavern-product-roadmap/phase3-pr-closeout.md`

### Plan artifacts to review before commit

- `docs/plans/2026-03-12-phase3-session-host-fixup-design.md`
- `docs/plans/2026-03-12-phase3-session-host-fixup.md`
- `docs/plans/2026-03-12-phase3-message-mutation-host-design.md`
- `docs/plans/2026-03-12-phase3-message-mutation-host.md`
- `docs/plans/2026-03-12-phase3-closeout-docs.md`

## Recommended Closeout Path

### 1. Freeze Phase 3 scope

Do not add more Phase 3 host capabilities.  
This branch is already at the correct stopping point: Quick Reply, group members, checkpoint/branch, message mutation, and JSONL round-trip.

### 2. Review plan artifacts

Before commit, decide whether the `docs/plans/*.md` files are intended history artifacts or temporary execution notes.

- If they are part of the repo's planning trail, keep them.
- If they are scratch notes, drop them before the Phase 3 PR.

Do not mix “final stage evidence” with disposable planning notes by accident.

### 3. Split commits by intent

Recommended commit shape:

1. `feat(session): close phase 3 session host gaps`
   - host wiring
   - store behavior fixes
   - JSONL round-trip changes
   - focused tests
2. `docs: add phase 3 review and closeout notes`
   - `handoff.md`
   - `tasks.md`
   - `phase3-review-result.md`
   - `phase3-pr-closeout.md`
   - `docs/CHAT_JSONL_IMPORT_EXPORT.md`

If the branch should stay single-commit for review simplicity, keep the same boundary inside the PR description.

### 4. Re-run the gate after final staging

Run:

```bash
pnpm verify:stage
```

Only stage and commit after the final run still passes.

### 5. Prepare PR description around product semantics

The PR body should lead with:

- `/session` is now the real host for Phase 3 chat orchestration features
- message mutation is no longer bridge-only
- JSONL import/export now preserves retained metadata on round-trip
- focused regression coverage and stage gate evidence

Avoid framing the PR as “more slash commands supported”.  
That undersells the actual architectural change.

## PR Checklist

- [ ] Review each `docs/plans/*.md` file and decide keep vs drop
- [ ] Stage only intended Phase 3 deliverables
- [ ] Re-run `pnpm verify:stage`
- [ ] Commit with clear scope
- [ ] Push `codex/phase-3-session-quickreply`
- [ ] Open PR against `main`
- [ ] Paste verification evidence into PR body
- [ ] Link `phase3-review-result.md` in PR description
- [ ] Wait for PR merge before starting the next phase

## Suggested PR Outline

### Title

`feat(session): close phase 3 host alignment gaps`

### Summary bullets

- wire Quick Reply, group member, checkpoint/branch, and message mutation flows to the live `/session` host
- preserve retained JSONL metadata and message extras across import/export round-trip
- add Phase 3 review and handoff updates

### Verification bullets

- `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx components/__tests__/QuickReplyPanel.test.tsx components/__tests__/GroupMemberPanel.test.tsx lib/quick-reply/__tests__/store.test.ts lib/group-chat/__tests__/store.test.ts lib/dialogue/__tests__/swipe-jsonl.test.ts app/session/__tests__/session-host-bridge.test.ts hooks/script-bridge/__tests__/message-handlers-compat.test.ts`
- `pnpm verify:stage`

## Merge Gate

Phase 3 should be treated as fully closed only when all of the following are true:

- working tree is committed
- PR exists
- PR is merged into `main`
- next phase starts from a fresh `codex/` branch off latest `main`
