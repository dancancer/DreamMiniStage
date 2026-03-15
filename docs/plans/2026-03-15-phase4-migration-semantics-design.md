# Phase 4 Migration Semantics Design

**Date:** 2026-03-15

## Goal

Use Phase 4 to move DreamMiniStage from "materials can be imported" to "imported SillyTavern materials keep a stable, explainable runtime meaning."

The first batch should not start with UI polish. It should first make three things true:

1. `Persona -> prompt macros -> WorldBook -> Regex` ordering is explicit and regression-tested.
2. Import semantics are described in one place with clear `retained / ignored / downgraded / manual-review` outcomes.
3. Import result UI can later render those semantics from shared data instead of inventing its own explanations.

## Current Facts

- `Persona`, `WorldBook`, and `Regex` product surfaces already exist in the app.
- The dialogue runtime already has an implicit ordering:
  - prompt assembly consumes persona-driven macro state
  - `WorldBookNode` runs before `LLMNode`
  - `RegexNode` runs after `LLMNode`
- Existing tests already cover parts of the chain, but they are split across older baseline files and do not define a single Phase 4 migration contract.
- Fresh worktree verification exposed an environment gap:
  - `test-baseline-assets/` is present in the old workspace as local material, but absent in a fresh worktree from `origin/main`
  - this makes material-driven tests fail before runtime semantics are even exercised

## Problem Statement

Today the product can often say "import succeeded", but it cannot yet answer the more important questions:

- which upstream fields were actually preserved
- which fields were ignored on purpose
- which semantics were downgraded to a smaller local model
- whether imported Persona / WorldBook / Regex still compose in the same runtime order

Without that contract, any future import report UI risks becoming decorative instead of truthful.

## Recommended Approach

### 1. Make migration semantics a single fact source

Introduce a small structured semantics layer for Phase 4 instead of scattering decisions across modals, adapters, tests, and docs.

That layer should describe, per material type and field:

- field name
- status: `retained` | `ignored` | `downgraded` | `manual-review`
- runtime note
- user-facing note

Batch 1 only needs coverage for the first critical set:

- Persona macro contribution
- WorldBook import and matching semantics
- Regex placement and execution semantics

### 2. Prove runtime semantics before changing the import UI

Add focused baseline tests for:

- Persona resolution and macro injection priority
- WorldBook imported-field behavior in actual matching/injection flow
- Regex execution order relative to prompt assembly and worldbook injection

These tests should answer "what meaning survives import and runtime composition", not just "what JSON keys exist after parsing".

### 3. Prepare an import report model before UI rendering

Extend the import result data model so modals can eventually render:

- retained fields
- ignored fields
- downgraded fields
- notes / manual follow-up

But do not spend Batch 1 on broad UI restyling. The first goal is correctness and shared semantics.

## Alternatives Considered

### A. Import report first

Rejected for Batch 1.

It gives immediate visible UI, but the report would be built on unstable or implicit rules. That creates a high risk of lying to the user with polished output.

### B. Asset library first

Rejected for Batch 1.

Building a larger sample library before defining the semantic checklist would create more material to manage, but not a sharper contract.

### C. Runtime semantics first

Chosen.

It gives the strongest base for later docs, reports, and additional migration samples.

## Scope for Batch 1

### In scope

- Define the Phase 4 migration semantics checklist for Persona / WorldBook / Regex
- Add focused baseline tests for the composition chain
- Introduce a structured import-report model that can carry semantics summaries
- Document the fresh-worktree asset gap as a Phase 4 risk

### Out of scope

- Broad import modal redesign
- Large upstream sample library expansion
- MVU workflow changes
- Persona/WorldBook/Regex product UI redesign

## Proposed File Boundaries

- `docs/plans/2026-03-15-phase4-migration-semantics-design.md`
- `docs/plans/2026-03-15-phase4-migration-semantics.md`
- `docs/plan/2026-03-08-sillytavern-product-roadmap/tasks.md`
- `docs/plan/2026-03-08-sillytavern-product-roadmap/handoff.md`
- `lib/import/migration-semantics/`
- `components/import-modal/ImportResultDisplay.tsx`
- `components/import-modal/`
- `lib/core/__tests__/phase4-persona-macro-baseline.test.ts`
- `lib/core/__tests__/phase4-worldbook-migration-baseline.test.ts`
- `lib/core/__tests__/phase4-regex-flow-baseline.test.ts`

## Acceptance Criteria

Batch 1 is complete when all of the following are true:

1. There is a written Phase 4 migration semantics checklist for Persona / WorldBook / Regex.
2. Focused tests prove:
   - Persona affects macro environment predictably.
   - imported WorldBook fields keep their declared runtime meaning.
   - Regex execution order stays stable around the prompt/worldbook/LLM flow.
3. Import-report data can represent `retained / ignored / downgraded / manual-review`.
4. The asset gap in fresh worktrees is documented and handled explicitly instead of being silently assumed away.

## Risks

### Untracked baseline assets

The current material-driven tests depend on `test-baseline-assets/` content that is not present in a fresh worktree from `origin/main`.

This is not just a test nuisance. It means Phase 4 cannot claim "fresh-branch reproducibility" until those materials are either:

- committed into the branch in an intentional way, or
- replaced with committed minimal fixtures for the new baseline tests

### Existing large baseline files

The repo already has older broad baseline tests. Extending them blindly would increase obscurity. Batch 1 should prefer small new files with narrow intent.

## Design Summary

Phase 4 should begin by fixing truth, not presentation.

The first batch will define a shared migration semantics contract, lock the Persona/WorldBook/Regex composition chain with focused tests, and prepare the import result model that later UI can render honestly.
