# SAC-Phase 4 Blueprint Runtime Harness

## Decision

Phase 4 starts with an offline harness that consumes only `SessionBlueprint`.

Implementation:

- `lib/story-agent/runtime/world-module.ts`
- `lib/story-agent/runtime/prompt-context.ts`

This harness is not wired into `/session`. It exists to prove the clean runtime contract before hard replacement.

## Covered Semantics

| Area | Status |
| --- | --- |
| Constant worldbook entries | Implemented |
| Primary key OR matching | Implemented |
| Secondary key AND / OR / NOT families | Implemented |
| Regex keys | Implemented with fail-closed invalid regex handling |
| Case sensitivity | Implemented |
| Whole-word matching | Implemented |
| `sticky` activation state | Implemented |
| `cooldown` activation state | Implemented |
| `delay` activation state | Implemented |
| Stable hit ordering by `insertionOrder` | Implemented |
| Prompt provenance | Implemented as `source` and `sourcePath` on assembled messages |
| Budget trimming | Implemented as prompt stack > world > memory > history retention |

## Remaining Phase 4 Work

- Baseline diff harness against existing ST assembly.
- MVU / slash script / TavernHelper prompt convention inventory.
- Final Phase 4 diff report proving no open `bug` differences before `SAC-Phase 6a`.

## Verification

```bash
pnpm vitest run lib/story-agent/runtime/__tests__/phase4-runtime.test.ts lib/story-agent/blueprint/__tests__/compiler.test.ts
```
