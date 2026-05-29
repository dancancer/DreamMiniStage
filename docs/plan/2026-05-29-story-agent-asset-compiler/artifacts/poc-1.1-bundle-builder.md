# POC-1.1 Bundle Builder

## Purpose

Verify that a real PNG character card plus external worldbook, preset and regex assets can be represented as a single `ImportedAssetBundle`.

## Inputs

| Asset | Role |
| --- | --- |
| `test-baseline-assets/character-card/Sgw3.png` | character card with embedded worldbook and regex |
| `test-baseline-assets/worldbook/服装随机化.json` | external worldbook |
| `test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json` | external preset |
| `test-baseline-assets/regex-scripts/sgw3-sample.json` | external regex scripts |

## Verification

Implemented test:

```bash
pnpm vitest run lib/adapters/import/__tests__/bundle-builder.test.ts
```

Expected facts:

- character name: `【Sgw】又看一集`
- worldbooks: 2 sources
- embedded character book entries: 140
- external worldbook entries: 3
- regex scripts: 47 total
- preset prompts: 124
- unsupported extension artifacts include `TavernHelper_scripts` and `tavern_helper`

## Result

- Status: `pass`
- Date: `2026-05-29`
- Evidence: `lib/adapters/import/bundle-builder.ts`, `lib/adapters/import/__tests__/bundle-builder.test.ts`

## Decision

Use `createImportedAssetBundle()` as the Phase 1 target for all ST asset import paths.
