# POC-3.1 SessionBlueprint Snapshot

## Purpose

Verify that real imported ST assets can compile into a single `SessionBlueprint` core JSON without requiring raw ST files at runtime.

## Inputs

| Asset | Source path | Why this fixture |
| --- | --- | --- |
| PNG character | `test-baseline-assets/character-card/Sgw3.png` | Embedded worldbook and embedded regex scripts |
| Worldbook | `test-baseline-assets/worldbook/服装随机化.json` | External worldbook |
| Preset | `test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json` | Large normalized prompt set |
| Regex | `test-baseline-assets/regex-scripts/sgw3-sample.json` | External regex scripts with HTML UI output |

## Commands

```bash
pnpm vitest run lib/story-agent/blueprint/__tests__/compiler.test.ts
```

## Snapshot Facts

The inline snapshot asserts:

- `schemaVersion = 1`
- profile name is `【Sgw】又看一集`
- `promptStack.messages.length = 125`
- world modules are `character-book: 140 entries` and `external-worldbook: 3 entries`
- `inputTransforms = 39`
- `outputTransforms = 47`
- `promptTransforms = 8`
- `contentRules = { markdown-only: 40, html-ui-unsupported: 39 }`
- `renderRules.status = deferred`
- `memoryPolicy.status = deferred` in Phase 3; this was superseded by the active schema v3 policy in `SAC-Phase 6b`.

## Result

- Status: `pass`
- Date: `2026-05-29`
- Evidence: `lib/story-agent/blueprint/__tests__/compiler.test.ts`

## Decision

Proceed with `SessionBlueprint` core as the Phase 4 input contract. Render and memory semantics were deferred by design at Phase 3, then graduated in Phase 5 and Phase 6b respectively.
