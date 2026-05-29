# SAC-Phase 4 Baseline Diff Report

## Purpose

Compare the blueprint-only offline harness with the current ST-shaped Phase 4 baseline fixtures. This is a one-time migration check, not a product fallback.

## Commands

```bash
pnpm vitest run \
  lib/story-agent/runtime/__tests__/phase4-runtime.test.ts \
  lib/story-agent/blueprint/__tests__/compiler.test.ts \
  lib/core/__tests__/phase4-regex-flow-baseline.test.ts \
  lib/core/__tests__/phase4-worldbook-migration-baseline.test.ts
```

## Compared Fixtures

| Baseline | Blueprint check | Result |
| --- | --- | --- |
| `phase4-regex-flow-baseline.test.ts` | `applyTextTransforms()` + `matchWorldModules()` on `regex-flow.json` | No open bug diff |
| `phase4-worldbook-migration-baseline.test.ts` | `matchWorldModules()` on `worldbook-import.json` | No open bug diff |

## Diff Classification

| Difference | Classification | Rationale | Follow-up |
| --- | --- | --- | --- |
| ST helper mutates matched worldbook content after macro evaluation; blueprint harness keeps compiled world entries immutable. | `intentional` | New runtime state must not mutate static `WorldModule`. Macro replacement is not part of Phase 4 core harness. | Handle explicit macro policy in a later prompt/runtime phase if required. |
| Existing worldbook fixture uses `selective: true` without secondary keys and still matches by primary key. | `intentional` | Blueprint matcher follows the observed baseline behavior: missing secondary keys are diagnostic-worthy but do not block primary-key matching. | Keep Phase 2 warning; no cutover bug. |
| Probability/group scoring is preserved in compiled data but not randomized in the Phase 4 offline harness. | `unsupported` | Random probability policy needs deterministic runtime semantics before product use. Current fixture uses `probability: 100`, so no behavioral diff appears. | Revisit in Phase 6a runtime policy if non-100 probability is product-critical. |
| Full prompt string byte-for-byte parity is not asserted. | `intentional` | The new route compiles prompt units and provenance, not an ST-style monolithic prompt string. | Phase 6a replacement report must validate product session behavior, not ST string identity. |

## Gate

Open `bug` diffs: none.

This satisfies the Phase 4 precondition for these fixtures. It does not start the `/session` cutover; hard replacement remains in `SAC-Phase 6a`.
