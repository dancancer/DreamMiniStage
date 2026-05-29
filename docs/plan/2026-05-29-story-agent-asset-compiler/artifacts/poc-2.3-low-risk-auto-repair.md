# POC-2.3 Low-Risk Auto Repair

## Purpose

Verify that only computed low-risk patches can be auto-applied, and that semantic fields remain unchanged.

## Inputs

| Asset | Source path | Why this fixture |
| --- | --- | --- |
| JSON character | `test-baseline-assets/character-card/Sgw3.card.json` | Real imported character card |

## Commands

```bash
pnpm vitest run lib/adapters/import/__tests__/repair-patch.test.ts
```

## Expected Output

The test applies this low-risk repair:

```json
{
  "operation": "replace",
  "targetPath": "/character/version",
  "value": "imported-sgw3",
  "claimedRisk": "low"
}
```

Required assertions:

- computed risk is `low`
- `autoApply` is `true`
- `character.version` changes
- `character.firstMessage` remains unchanged

## Result

- Status: `pass`
- Date: `2026-05-29`
- Evidence: `lib/adapters/import/repair-patch.ts`, `lib/adapters/import/__tests__/repair-patch.test.ts`

## Decision

Auto repair is allowed only for display or metadata paths. Semantic content repair remains manual-confirmation work.
