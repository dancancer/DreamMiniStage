# POC-4.1 WorldModule Hits

## Purpose

Verify that real imported assets can produce world hits from compiled `WorldModule` data without reading raw ST worldbook files.

## Inputs

| Asset | Source path |
| --- | --- |
| PNG character | `test-baseline-assets/character-card/Sgw3.png` |
| External worldbook | `test-baseline-assets/worldbook/服装随机化.json` |
| Preset | `test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json` |

## Command

```bash
pnpm vitest run lib/story-agent/runtime/__tests__/phase4-runtime.test.ts
```

## Expected Output

The test compiles a `SessionBlueprint` and runs:

```ts
matchWorldModules(blueprint, "丰川祥子在RiNG排练春日影。")
```

Required assertions:

- at least one hit is returned
- the first hit comes from `character-book`
- the hit includes `sourcePath = test-baseline-assets/character-card/Sgw3.png`

## Result

- Status: `pass`
- Date: `2026-05-29`
- Evidence: `lib/story-agent/runtime/world-module.ts`, `phase4-runtime.test.ts`
