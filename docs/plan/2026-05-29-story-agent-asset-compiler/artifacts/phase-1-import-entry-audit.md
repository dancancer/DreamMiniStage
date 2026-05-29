# SAC-Phase 1 Import Entry Audit

## Current Entry Points

| Entry point | Current behavior | Status |
| --- | --- | --- |
| `function/character/import.ts` | Parses PNG, creates character record, writes embedded `character_book` directly with `WorldBookOperations.updateWorldBook`, imports embedded regex via regex adapter | Must be refactored to use `ImportedAssetBundle` |
| `function/worldbook/import.ts` | Uses `importWorldBookEntries` adapter before writing worldbook store | Adapter-backed |
| `components/ImportWorldBookModal.tsx` | Calls `importWorldBookFromJson` | Adapter-backed through function layer |
| `components/ImportRegexScriptModal.tsx` | Calls regex import function | Adapter-backed through function layer |

## Confirmed Gap

`function/character/import.ts` still contains:

```ts
await WorldBookOperations.updateWorldBook(
  `character:${characterId}`,
  characterJson.data.character_book.entries,
);
```

That bypasses `NormalizedWorldBookEntry`, `selectiveLogic` numeric mapping, provenance and diagnostics. It must not survive Phase 1.

## New Target

`lib/adapters/import/bundle-builder.ts` now provides `createImportedAssetBundle()`:

- embedded `character_book` goes through `importWorldBookEntries`,
- embedded `regex_scripts` goes through `importRegexScripts`,
- external worldbooks, presets and regex scripts enter the same bundle shape,
- unsupported extensions become `extensionArtifacts`.

## Next Refactor

Refactor `function/character/import.ts` to:

1. Parse PNG into raw character JSON.
2. Build `ImportedAssetBundle`.
3. Persist character record and asset-library outputs from the bundle.
4. Stop writing raw `character_book.entries` directly.

This is an implementation task, not just documentation.
