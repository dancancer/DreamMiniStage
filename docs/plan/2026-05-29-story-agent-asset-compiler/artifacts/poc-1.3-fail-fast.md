# POC-1.3 Fail-Fast Import Diagnostics

## Purpose

Verify that clearly damaged character-card input does not produce a partial bundle that later leaks into runtime.

## Input

Synthetic character card:

```json
{ "data": { "description": "missing name" } }
```

## Verification

Implemented test:

```bash
pnpm vitest run lib/adapters/import/__tests__/bundle-builder.test.ts
```

Expected behavior:

- `createImportedAssetBundle()` throws `Character card is missing data.name`.
- No fallback name is invented.
- No partial bundle is returned.

## Result

- Status: `pass`
- Date: `2026-05-29`
- Evidence: `lib/adapters/import/__tests__/bundle-builder.test.ts`

## Decision

Phase 1 import uses fail-fast behavior for missing character identity. User-facing diagnostics can wrap this error in the product import wizard later, but the adapter contract does not silently repair it.
