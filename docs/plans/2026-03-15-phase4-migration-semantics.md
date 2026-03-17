# Phase 4 Migration Semantics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish a reproducible Phase 4 baseline for Persona, WorldBook, and Regex migration semantics, then prepare the import-report model that can explain retained, ignored, and downgraded fields truthfully.

**Architecture:** Introduce a small shared migration-semantics layer as the single source of truth for Phase 4 field outcomes. Use committed narrow fixtures plus focused baseline tests to lock the runtime composition chain before wiring those semantics into import-result reporting.

**Tech Stack:** TypeScript, React, Next.js App Router, Vitest, existing prompt/worldbook/regex runtime modules

---

### Task 1: Make the Phase 4 baseline reproducible in a fresh worktree

**Files:**
- Create: `lib/core/__tests__/fixtures/phase4/persona-macro.json`
- Create: `lib/core/__tests__/fixtures/phase4/worldbook-import.json`
- Create: `lib/core/__tests__/fixtures/phase4/regex-flow.json`
- Modify: `lib/core/__tests__/prompt-assembly.regression.test.ts`
- Modify: `lib/core/__tests__/st-baseline-worldbook-material.test.ts`

**Step 1: Write the failing fixture-backed test update**

Replace direct dependency on untracked `test-baseline-assets/...` in the Phase 4-targeted assertions with committed narrow fixtures.

```ts
const FIXTURE_PATH = path.join(
  process.cwd(),
  "lib/core/__tests__/fixtures/phase4/worldbook-import.json",
);

it("loads committed phase4 worldbook fixture in a fresh worktree", () => {
  const raw = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as unknown;
  expect(raw).toBeDefined();
});
```

**Step 2: Run test to verify the old setup fails in a fresh worktree**

Run: `pnpm vitest run lib/core/__tests__/prompt-assembly.regression.test.ts lib/core/__tests__/st-baseline-worldbook-material.test.ts`

Expected: FAIL with `ENOENT` for missing `test-baseline-assets/...` paths in the fresh worktree.

**Step 3: Write the minimal reproducibility fix**

- Add committed phase4 fixture files under `lib/core/__tests__/fixtures/phase4/`.
- Update the Phase 4-targeted tests to load those fixtures instead of relying on local untracked assets.
- Keep older broad tests intact unless they are directly needed for Phase 4 Batch 1.

```ts
function readPhase4Fixture<T>(name: string): T {
  const filePath = path.join(
    process.cwd(),
    "lib/core/__tests__/fixtures/phase4",
    name,
  );
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}
```

**Step 4: Run test to verify reproducibility passes**

Run: `pnpm vitest run lib/core/__tests__/prompt-assembly.regression.test.ts lib/core/__tests__/st-baseline-worldbook-material.test.ts`

Expected: PASS without depending on local-only material directories.

**Step 5: Commit**

```bash
git add lib/core/__tests__/fixtures/phase4 lib/core/__tests__/prompt-assembly.regression.test.ts lib/core/__tests__/st-baseline-worldbook-material.test.ts
git commit -m "test: make phase4 baseline fixtures reproducible"
```

### Task 2: Add the shared Phase 4 migration semantics source of truth

**Files:**
- Create: `lib/import/migration-semantics/types.ts`
- Create: `lib/import/migration-semantics/phase4-checklist.ts`
- Create: `lib/import/migration-semantics/report.ts`
- Modify: `docs/plan/2026-03-08-sillytavern-product-roadmap/tasks.md`
- Modify: `docs/plan/2026-03-08-sillytavern-product-roadmap/handoff.md`

**Step 1: Write the failing test**

Create a narrow unit test for the checklist and report model.

```ts
import { describe, expect, it } from "vitest";
import { PHASE4_MIGRATION_CHECKLIST } from "@/lib/import/migration-semantics/phase4-checklist";
import { summarizeImportSemantics } from "@/lib/import/migration-semantics/report";

describe("phase4 migration semantics", () => {
  it("declares worldbook field outcomes explicitly", () => {
    expect(PHASE4_MIGRATION_CHECKLIST.worldbook.fields.useProbability.status).toBe("retained");
    expect(PHASE4_MIGRATION_CHECKLIST.worldbook.fields.groupWeight.status).toBe("retained");
  });

  it("builds retained/ignored/downgraded buckets", () => {
    const summary = summarizeImportSemantics("worldbook", ["useProbability", "groupWeight"]);
    expect(summary.retained).toContain("useProbability");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/import/migration-semantics/__tests__/phase4-checklist.test.ts`

Expected: FAIL because the new semantics module does not exist yet.

**Step 3: Write the minimal implementation**

- Define shared types:
  - material kind
  - field outcome
  - report summary buckets
- Add the first checklist coverage for:
  - `persona`
  - `worldbook`
  - `regex`
- Add a helper that turns a checklist slice into `retained / ignored / downgraded / manualReview / notes`.

```ts
export type MigrationFieldStatus =
  | "retained"
  | "ignored"
  | "downgraded"
  | "manual-review";

export interface MigrationFieldRule {
  status: MigrationFieldStatus;
  runtimeNote: string;
  userNote: string;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/import/migration-semantics/__tests__/phase4-checklist.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/import/migration-semantics docs/plan/2026-03-08-sillytavern-product-roadmap/tasks.md docs/plan/2026-03-08-sillytavern-product-roadmap/handoff.md
git commit -m "feat: add phase4 migration semantics checklist"
```

### Task 3: Lock the Persona, WorldBook, and Regex composition chain with focused baseline tests

**Files:**
- Create: `lib/core/__tests__/phase4-persona-macro-baseline.test.ts`
- Create: `lib/core/__tests__/phase4-worldbook-migration-baseline.test.ts`
- Create: `lib/core/__tests__/phase4-regex-flow-baseline.test.ts`
- Modify: `hooks/useCurrentPersona.ts`
- Modify: `lib/core/__tests__/st-baseline-dialogue-flow.test.ts`
- Modify: `lib/adapters/import/worldbook-import.ts`

**Step 1: Write the failing tests**

Add one narrow test per semantic guarantee.

```ts
it("uses resolved persona description in {{persona}} macros", () => {
  const env = buildMacroEnv({ persona: "冷静的调查员" });
  expect(evaluate("{{persona}}", env)).toBe("冷静的调查员");
});

it("keeps imported worldbook probability semantics in matching flow", () => {
  const entries = importWorldBookEntries(readPhase4Fixture("worldbook-import.json"));
  expect(entries[0].useProbability).toBe(true);
});

it("applies USER_INPUT regex before worldbook matching and AI_OUTPUT regex after llm output", () => {
  const result = executePhase4FlowFixture();
  expect(result.processedInput).toContain("标准化输入");
  expect(result.processedResponse).toContain("后处理输出");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/core/__tests__/phase4-persona-macro-baseline.test.ts lib/core/__tests__/phase4-worldbook-migration-baseline.test.ts lib/core/__tests__/phase4-regex-flow-baseline.test.ts`

Expected: FAIL because the baseline contract and helpers are not fully encoded yet.

**Step 3: Write the minimal implementation**

- Reuse existing runtime modules; do not invent a parallel pipeline.
- Only touch production code where the tests prove an actual semantic drift.
- Prefer helper extraction over widening old mega-tests.

```ts
const persona = resolvePersonaForDialogue(dialogueKey, characterId);
const description = persona.personaId
  ? usePersonaStore.getState().personas[persona.personaId]?.description ?? ""
  : "";
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/core/__tests__/phase4-persona-macro-baseline.test.ts lib/core/__tests__/phase4-worldbook-migration-baseline.test.ts lib/core/__tests__/phase4-regex-flow-baseline.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/core/__tests__/phase4-persona-macro-baseline.test.ts lib/core/__tests__/phase4-worldbook-migration-baseline.test.ts lib/core/__tests__/phase4-regex-flow-baseline.test.ts hooks/useCurrentPersona.ts lib/adapters/import/worldbook-import.ts lib/core/__tests__/st-baseline-dialogue-flow.test.ts
git commit -m "test: lock phase4 persona worldbook regex semantics"
```

### Task 4: Extend import-result data to carry semantics summaries

**Files:**
- Modify: `components/import-modal/ImportResultDisplay.tsx`
- Modify: `components/import-modal/index.ts`
- Modify: `components/import-modal/README.md`
- Modify: `components/ImportWorldBookModal.tsx`
- Modify: `components/ImportRegexScriptModal.tsx`
- Modify: `components/ImportPresetModal.tsx`
- Modify: `components/ImportCharacterModal.tsx`
- Create: `components/__tests__/ImportResultDisplay.test.tsx`

**Step 1: Write the failing test**

Add a component test that requires semantics sections to render from structured data instead of hardcoded prose.

```tsx
render(
  <ImportResultDisplay
    result={{
      success: true,
      message: "ok",
      importedCount: 1,
      skippedCount: 0,
      semantics: {
        retained: ["useProbability", "groupWeight"],
        ignored: ["legacyFlag"],
        downgraded: ["personaBindings"],
        manualReview: [],
        notes: ["Regex placement differs from upstream script hooks."],
      },
    }}
    title="Import summary"
    importedLabel="Imported {count}"
    skippedLabel="Skipped {count}"
    errorsLabel="Errors"
    serifFontClass=""
  />,
);

expect(screen.getByText("useProbability")).toBeInTheDocument();
expect(screen.getByText("legacyFlag")).toBeInTheDocument();
expect(screen.getByText("personaBindings")).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run components/__tests__/ImportResultDisplay.test.tsx`

Expected: FAIL because `ImportResult` does not yet carry semantics buckets and the UI cannot render them.

**Step 3: Write the minimal implementation**

- Extend `ImportResult` with an optional `semantics` object.
- Render bucketed sections only when data exists.
- Keep the component data-driven; do not add material-specific UI branches.
- Populate the new structure in the import modals where Phase 4 material types are imported.

```ts
export interface ImportResultSemantics {
  retained: string[];
  ignored: string[];
  downgraded: string[];
  manualReview: string[];
  notes: string[];
}

export interface ImportResult {
  success: boolean;
  message: string;
  importedCount: number;
  skippedCount: number;
  semantics?: ImportResultSemantics;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run components/__tests__/ImportResultDisplay.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add components/import-modal/ImportResultDisplay.tsx components/import-modal/index.ts components/import-modal/README.md components/ImportWorldBookModal.tsx components/ImportRegexScriptModal.tsx components/ImportPresetModal.tsx components/ImportCharacterModal.tsx components/__tests__/ImportResultDisplay.test.tsx
git commit -m "feat: add phase4 import semantics reporting"
```

### Task 5: Verify the batch and record Phase 4 progress

**Files:**
- Modify: `docs/plan/2026-03-08-sillytavern-product-roadmap/tasks.md`
- Modify: `docs/plan/2026-03-08-sillytavern-product-roadmap/handoff.md`

**Step 1: Run focused tests**

Run:

```bash
pnpm vitest run \
  lib/import/migration-semantics/__tests__/phase4-checklist.test.ts \
  lib/core/__tests__/phase4-persona-macro-baseline.test.ts \
  lib/core/__tests__/phase4-worldbook-migration-baseline.test.ts \
  lib/core/__tests__/phase4-regex-flow-baseline.test.ts \
  components/__tests__/ImportResultDisplay.test.tsx
```

Expected: PASS.

**Step 2: Run the stage gate**

Run: `pnpm verify:stage`

Expected: PASS.

**Step 3: Update roadmap progress**

Record:

- the new migration semantics checklist
- the fresh-worktree asset reproducibility fix
- the baseline tests added in Batch 1
- the import-result reporting model status

**Step 4: Commit**

```bash
git add docs/plan/2026-03-08-sillytavern-product-roadmap/tasks.md docs/plan/2026-03-08-sillytavern-product-roadmap/handoff.md
git commit -m "docs: record phase4 migration semantics batch1 progress"
```
