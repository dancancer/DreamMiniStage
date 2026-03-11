# P4 Replay Artifacts And CI Digest Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move `p4:session-replay` runtime artifacts out of `docs/` by default and surface actionable replay failure details directly in CI logs and GitHub step summaries.

**Architecture:** Keep durable baseline docs in `docs/`, move ephemeral run outputs and run index into `.artifacts/p4-session-replay`, and reuse the existing replay summary/noise report JSON as the single source of truth for digest rendering. Add a small digest renderer plus a CI summary writer so local logs and GitHub UI show the same root-cause slice.

**Tech Stack:** Node.js scripts, Playwright replay harness, Vitest, GitHub Actions.

---

### Task 1: Add failing tests for digest rendering and artifact defaults

**Files:**
- Modify: `scripts/__tests__/p4-session-replay-lib.test.ts`
- Test: `scripts/__tests__/p4-session-replay-lib.test.ts`

**Step 1: Write failing tests**
- Assert replay digest rendering includes run id, artifact path, unknown signature count, and top unknown console/network signatures.
- Assert default artifact root and run index paths point to `.artifacts/p4-session-replay`.

**Step 2: Run targeted tests to verify failure**
Run: `pnpm vitest run scripts/__tests__/p4-session-replay-lib.test.ts`
Expected: FAIL on missing digest/default-path behavior.

**Step 3: Implement minimal code**
- Add reusable constants/helpers for default artifact paths.
- Add digest renderer in replay lib.

**Step 4: Re-run targeted tests**
Run: `pnpm vitest run scripts/__tests__/p4-session-replay-lib.test.ts`
Expected: PASS.

### Task 2: Wire digest output into replay script and CI summary generation

**Files:**
- Modify: `scripts/p4-session-replay-e2e.mjs`
- Create: `scripts/p4-session-replay-ci-summary.mjs`
- Modify: `.github/workflows/p4-session-replay.yml`
- Modify: `.gitignore`

**Step 1: Add failing integration coverage if needed**
- Prefer unit coverage of digest renderer; keep workflow validation manual.

**Step 2: Implement minimal code**
- Switch default runtime artifact root and run index paths to `.artifacts/p4-session-replay`.
- Print concise failure digest in replay stderr on failure.
- Add CI summary script that writes markdown into `$GITHUB_STEP_SUMMARY` from latest replay summary/noise JSON.
- Upload artifacts from `.artifacts/p4-session-replay/*`.
- Ignore `.artifacts/` in git.

**Step 3: Verify targeted behavior**
Run: `pnpm p4:session-replay`
Expected: PASS locally, artifacts under `.artifacts/p4-session-replay/...`.

### Task 3: Full verification

**Files:**
- Verify only

**Step 1: Run focused tests**
Run: `pnpm vitest run scripts/__tests__/p4-session-replay-lib.test.ts`
Expected: PASS.

**Step 2: Run full gate**
Run: `pnpm verify:stage`
Expected: PASS.
