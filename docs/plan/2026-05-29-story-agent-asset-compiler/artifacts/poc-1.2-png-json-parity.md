# POC-1.2 PNG / JSON Character Parity

## Purpose

Verify that the same character card imported from PNG and JSON produces equivalent bundle semantics for the fields Phase 1 currently owns.

## Inputs

| Asset | Role |
| --- | --- |
| `test-baseline-assets/character-card/Sgw3.png` | PNG card |
| `test-baseline-assets/character-card/Sgw3.card.json` | JSON card |

## Verification

Implemented test:

```bash
pnpm vitest run lib/adapters/import/__tests__/bundle-builder.test.ts
```

Checked parity:

- character name matches,
- embedded worldbook entry count matches,
- total regex script count matches,
- extension artifact keys match.

## Result

- Status: `pass`
- Date: `2026-05-29`
- Evidence: `lib/adapters/import/__tests__/bundle-builder.test.ts`

## Remaining Gap

This POC does not yet compare every text field byte-for-byte. Full semantic diff belongs to later compiler snapshot tests.
